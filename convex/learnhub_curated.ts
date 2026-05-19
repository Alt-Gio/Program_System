/**
 * Org-Partner-curated YouTube content for the /learnhub/watch page.
 *
 * Authoring rules:
 *   • Only `org_partner`, `coordinator`, and `admin` can add or remove
 *     curated items. The frontend hides the UI for everyone else, but
 *     this module enforces the gate too — never trust the caller's role
 *     coming over the wire.
 *
 * Read side:
 *   • `listCuratedFeed` returns the active curated items ordered by
 *     `addedAt` desc, joined with their authoring org's display name and
 *     verification status. Anonymous viewers can read (the watch feed is
 *     public-ish to learners signed in to LearnHub).
 *
 * Why one table for both channels and videos:
 *   • Org Partners think in "we surfaced these YouTubers / these clips" —
 *     the management page should show one chronological list. Splitting
 *     into two tables would force a UNION query and a two-form UI.
 */

import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

type CuratorRole = "org_partner" | "coordinator" | "admin";

async function requireCurator(
  ctx: QueryCtx,
  actorId: Id<"learnhub_users">,
): Promise<{ actor: Doc<"learnhub_users">; role: CuratorRole }> {
  const actor = await ctx.db.get(actorId);
  if (!actor) throw new Error("Actor not found");
  if (
    actor.role !== "org_partner" &&
    actor.role !== "coordinator" &&
    actor.role !== "admin"
  ) {
    throw new Error("FORBIDDEN: only Org Partners, Coordinators, and Admins may curate.");
  }
  return { actor, role: actor.role as CuratorRole };
}

/**
 * Public feed of active curated items. Each item is hydrated with the
 * authoring org's display name + isVerified flag so the watch page can
 * stamp a "Curated by [Org] ✓" tag without an extra round-trip.
 */
export const listCuratedFeed = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
    kind: v.optional(v.union(v.literal("channel"), v.literal("video"))),
    orgId: v.optional(v.id("learnhub_users")),
    tag: v.optional(v.string()),
    // Optional filter on the `format` field. Only meaningful for
    // `kind === "video"` items; ignored for channel rows.
    format: v.optional(v.union(v.literal("video"), v.literal("short"))),
  },
  handler: async (ctx, args) => {
    const pageSize = Math.min(args.limit ?? 30, 60);

    // Use the by_active_added index to filter at the storage layer; we
    // re-sort by addedAt desc in memory because the index sorts addedAt
    // ascending after the boolean field.
    let items = await ctx.db
      .query("learnhub_org_curated_channels")
      .withIndex("by_active_added", (q) => q.eq("isActive", true))
      .collect();
    items.sort((a, b) => b.addedAt - a.addedAt);

    if (typeof args.cursor === "number") {
      items = items.filter((i) => i.addedAt < (args.cursor as number));
    }
    if (args.kind) items = items.filter((i) => i.kind === args.kind);
    if (args.orgId) items = items.filter((i) => i.orgId === args.orgId);
    if (args.tag) {
      const want = args.tag.toLowerCase();
      items = items.filter((i) =>
        (i.tags ?? []).some((t) => t.toLowerCase() === want),
      );
    }
    if (args.format) {
      items = items.filter(
        (i) => i.kind !== "video" || (i.format ?? "video") === args.format,
      );
    }
    // Float featured items to the top while preserving chronological
    // ordering within each bucket.
    items.sort((a, b) => {
      const af = a.isFeatured ? 1 : 0;
      const bf = b.isFeatured ? 1 : 0;
      if (af !== bf) return bf - af;
      return b.addedAt - a.addedAt;
    });

    const page = items.slice(0, pageSize);

    // Hydrate org identity once per unique orgId.
    const orgIds = Array.from(new Set(page.map((i) => i.orgId as unknown as string)));
    const orgs = new Map<string, { id: Id<"learnhub_users">; name: string; isVerified: boolean }>();
    for (const id of orgIds) {
      const user = await ctx.db.get(id as unknown as Id<"learnhub_users">);
      if (!user) continue;
      const profile = await ctx.db
        .query("learnhub_org_profiles")
        .withIndex("by_org", (q) => q.eq("orgId", id as unknown as Id<"learnhub_users">))
        .unique();
      orgs.set(id, {
        id: user._id,
        name: user.organization || user.name,
        isVerified: profile?.isVerified ?? false,
      });
    }

    return {
      items: page.map((item) => ({
        ...item,
        org: orgs.get(item.orgId as unknown as string) ?? null,
      })),
      nextCursor: items.length > pageSize ? page[page.length - 1].addedAt : null,
    };
  },
});

/**
 * List the orgs that have curated at least one active item — used to
 * render the chip-strip filter at the top of the watch page.
 */
export const listCuratingOrgs = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("learnhub_org_curated_channels")
      .withIndex("by_active_added", (q) => q.eq("isActive", true))
      .collect();
    const orgIds = Array.from(new Set(items.map((i) => i.orgId as unknown as string)));
    const out: Array<{ id: Id<"learnhub_users">; name: string; isVerified: boolean; count: number }> = [];
    for (const id of orgIds) {
      const user = await ctx.db.get(id as unknown as Id<"learnhub_users">);
      if (!user) continue;
      const profile = await ctx.db
        .query("learnhub_org_profiles")
        .withIndex("by_org", (q) => q.eq("orgId", id as unknown as Id<"learnhub_users">))
        .unique();
      out.push({
        id: user._id,
        name: user.organization || user.name,
        isVerified: profile?.isVerified ?? false,
        count: items.filter((i) => (i.orgId as unknown as string) === id).length,
      });
    }
    out.sort((a, b) => b.count - a.count);
    return out;
  },
});

/**
 * Returns what the caller's org has curated, regardless of active state —
 * used by the management page so they can re-activate paused items.
 */
export const orgListCurated = query({
  args: { actorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const { actor } = await requireCurator(ctx, args.actorId);
    const items = await ctx.db
      .query("learnhub_org_curated_channels")
      .withIndex("by_org", (q) => q.eq("orgId", actor._id))
      .collect();
    items.sort((a, b) => b.addedAt - a.addedAt);
    return items;
  },
});

export const orgAddChannel = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    youtubeChannelId: v.string(),
    displayName: v.string(),
    thumbnailUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    channelFocus: v.optional(
      v.union(v.literal("videos"), v.literal("shorts"), v.literal("both")),
    ),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireCurator(ctx, args.actorId);
    const id = args.youtubeChannelId.trim();
    if (!id) throw new Error("youtubeChannelId is required");
    const display = args.displayName.trim();
    if (!display) throw new Error("displayName is required");

    const existing = await ctx.db
      .query("learnhub_org_curated_channels")
      .withIndex("by_org", (q) => q.eq("orgId", actor._id))
      .collect();
    const dup = existing.find((e) => e.kind === "channel" && e.youtubeChannelId === id);
    if (dup) {
      await ctx.db.patch(dup._id, {
        isActive: true,
        displayName: display,
        tags: args.tags,
        channelFocus: args.channelFocus,
      });
      return dup._id;
    }

    return await ctx.db.insert("learnhub_org_curated_channels", {
      orgId: actor._id,
      kind: "channel",
      youtubeChannelId: id,
      displayName: display,
      thumbnailUrl: args.thumbnailUrl,
      description: args.description,
      tags: args.tags,
      channelFocus: args.channelFocus ?? "videos",
      addedAt: Date.now(),
      isActive: true,
    });
  },
});

export const orgAddVideo = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    youtubeVideoId: v.string(),
    displayName: v.string(),
    thumbnailUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    durationLabel: v.optional(v.string()),
    // "short" stores vertical 9:16 YouTube Shorts. "video" (default) is
    // the standard 16:9 long-form. Same table, different render path on
    // the watch page.
    format: v.optional(v.union(v.literal("video"), v.literal("short"))),
  },
  handler: async (ctx, args) => {
    const { actor } = await requireCurator(ctx, args.actorId);
    const id = args.youtubeVideoId.trim();
    if (!id) throw new Error("youtubeVideoId is required");
    const display = args.displayName.trim() || id;
    const fmt = args.format ?? "video";

    const existing = await ctx.db
      .query("learnhub_org_curated_channels")
      .withIndex("by_org", (q) => q.eq("orgId", actor._id))
      .collect();
    const dup = existing.find((e) => e.kind === "video" && e.youtubeVideoId === id);
    if (dup) {
      await ctx.db.patch(dup._id, {
        isActive: true,
        displayName: display,
        tags: args.tags,
        durationLabel: args.durationLabel,
        format: fmt,
      });
      return dup._id;
    }

    return await ctx.db.insert("learnhub_org_curated_channels", {
      orgId: actor._id,
      kind: "video",
      youtubeVideoId: id,
      displayName: display,
      thumbnailUrl: args.thumbnailUrl ?? `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      description: args.description,
      tags: args.tags,
      durationLabel: args.durationLabel,
      format: fmt,
      addedAt: Date.now(),
      isActive: true,
    });
  },
});

/**
 * Toggle the highlight/feature flag on a curated item. Highlighted items
 * float to the top of /learnhub/watch with a "FEATURED" badge. Honors the
 * same actor-ownership rules as remove/set-active.
 */
export const orgSetFeatured = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    itemId: v.id("learnhub_org_curated_channels"),
    isFeatured: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { actor, role } = await requireCurator(ctx, args.actorId);
    const item = await ctx.db.get(args.itemId);
    if (!item) return;
    if (role === "org_partner" && item.orgId !== actor._id) {
      throw new Error("FORBIDDEN: cannot feature another org's curated item.");
    }
    await ctx.db.patch(args.itemId, { isFeatured: args.isFeatured });
  },
});

/**
 * Convert a legacy channel entry to a video entry. Lets a curator upgrade
 * an "informational only" channel bookmark into something that actually
 * surfaces on the watch page once they identify a featured video. The
 * channel id, display name, and description are preserved as metadata
 * so the org-of-record stays intact.
 */
export const orgConvertChannelToVideo = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    itemId: v.id("learnhub_org_curated_channels"),
    youtubeVideoId: v.string(),
    displayName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { actor, role } = await requireCurator(ctx, args.actorId);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (role === "org_partner" && item.orgId !== actor._id) {
      throw new Error("FORBIDDEN: cannot edit another org's curated item.");
    }
    const vid = args.youtubeVideoId.trim();
    if (!vid) throw new Error("youtubeVideoId is required");
    await ctx.db.patch(args.itemId, {
      kind: "video",
      youtubeVideoId: vid,
      // Keep the channel id around as breadcrumb context.
      displayName: (args.displayName?.trim() || item.displayName).trim(),
      thumbnailUrl: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
      tags: args.tags ?? item.tags,
    });
  },
});

export const orgRemoveCurated = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    itemId: v.id("learnhub_org_curated_channels"),
  },
  handler: async (ctx, args) => {
    const { actor, role } = await requireCurator(ctx, args.actorId);
    const item = await ctx.db.get(args.itemId);
    if (!item) return;
    // org_partner can only remove their own; coordinator / admin can
    // remove any.
    if (role === "org_partner" && item.orgId !== actor._id) {
      throw new Error("FORBIDDEN: cannot remove another org's curated item.");
    }
    await ctx.db.delete(args.itemId);
  },
});

export const orgSetActive = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    itemId: v.id("learnhub_org_curated_channels"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { actor, role } = await requireCurator(ctx, args.actorId);
    const item = await ctx.db.get(args.itemId);
    if (!item) return;
    if (role === "org_partner" && item.orgId !== actor._id) {
      throw new Error("FORBIDDEN: cannot toggle another org's curated item.");
    }
    await ctx.db.patch(args.itemId, { isActive: args.isActive });
  },
});
