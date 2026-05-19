/**
 * Read-only event queries used by the feed (and eventually a dedicated
 * events page). The events themselves are created by the calendar API
 * routes / Meet post lifecycle — this module only adds query helpers.
 *
 * Note: there is no schema change here. Indexing/inserts live wherever
 * the original event creation flow already does. We only consume.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeHashtag } from "../lib/learnhub/interests";

/**
 * Small digest of upcoming events for the feed carousel. Returns the next
 * N scheduled or live events starting within `withinDays`. If a viewerId
 * is supplied, events whose `category` or `campaignTag` matches one of
 * the viewer's interests float to the top (we still keep the rest so the
 * carousel isn't empty for viewers with no interests yet).
 */
export const getUpcomingDigest = query({
  args: {
    viewerId: v.optional(v.id("learnhub_users")),
    withinDays: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const window = (args.withinDays ?? 14) * 86_400_000;
    const cutoff = now + window;
    const limit = Math.min(args.limit ?? 5, 12);

    const events = await ctx.db
      .query("learnhub_events")
      .withIndex("by_start", (q) => q.gte("startTime", now))
      .take(60);
    const upcoming = events.filter(
      (e) => e.startTime <= cutoff && (e.status === "scheduled" || e.status === "live"),
    );

    const viewer = args.viewerId ? await ctx.db.get(args.viewerId) : null;
    const interestSet = new Set(
      (viewer?.interests ?? []).map((i) => normalizeHashtag(i)).filter(Boolean),
    );

    function matchScore(e: (typeof upcoming)[number]): number {
      if (interestSet.size === 0) return 0;
      let s = 0;
      const cat = normalizeHashtag(e.category ?? "");
      const tag = normalizeHashtag(e.campaignTag ?? "");
      if (cat && interestSet.has(cat)) s += 2;
      if (tag && interestSet.has(tag)) s += 1;
      return s;
    }

    const scored = upcoming
      .map((e) => ({ e, s: matchScore(e) }))
      .sort((a, b) => b.s - a.s || a.e.startTime - b.e.startTime);

    return scored.slice(0, limit).map(({ e }) => ({
      _id: e._id,
      title: e.title,
      description: e.description,
      coverImageUrl: e.coverImageUrl ?? null,
      type: e.type,
      startTime: e.startTime,
      endTime: e.endTime,
      meetLink: e.meetLink ?? null,
      location: e.location ?? null,
      registrantCount: e.registrantCount,
      maxSlots: e.maxSlots,
      category: e.category ?? null,
    }));
  },
});
