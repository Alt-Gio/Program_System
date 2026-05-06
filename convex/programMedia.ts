/**
 * Per-program media — logo + highlights gallery.
 *
 * Two distinct concerns live in this file:
 *
 *   1. Program LOGO — single uploaded image, stored as
 *      `projects.logoStorageId`. Replaces the hard-coded
 *      `/logo/<code>.png` mapping in the sidebar when present.
 *
 *   2. Program HIGHLIGHTS — ordered gallery of images and videos
 *      stored in the `programHighlights` table. Used as a visual
 *      showcase on the program page and (later) as background
 *      media on activity headers.
 *
 * Both use Convex File Storage. The upload flow is:
 *
 *     // client
 *     const url = await generateUploadUrl();
 *     const res = await fetch(url, { method: "POST", body: file });
 *     const { storageId } = await res.json();
 *     await setProgramLogo({ projectId, storageId, ... });
 *
 * URLs returned to the client are short-lived signed URLs from
 * `ctx.storage.getUrl()` — refresh by re-querying.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ──────────────────────────────────────────────────────────────
// Upload URL — shared for both logo and highlight uploads.
// ──────────────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

// ──────────────────────────────────────────────────────────────
// LOGO
// ──────────────────────────────────────────────────────────────

export const setProgramLogo = mutation({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
  },
  handler: async (ctx, { projectId, storageId }) => {
    const proj = await ctx.db.get(projectId);
    if (!proj) throw new Error("Program not found.");

    // Delete previous logo blob — keeps storage tidy.
    if (proj.logoStorageId && proj.logoStorageId !== storageId) {
      try { await ctx.storage.delete(proj.logoStorageId as Id<"_storage">); }
      catch { /* missing blob = already gone, fine */ }
    }

    await ctx.db.patch(projectId, { logoStorageId: storageId });
    return { success: true };
  },
});

export const clearProgramLogo = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const proj = await ctx.db.get(projectId);
    if (!proj) throw new Error("Program not found.");

    if (proj.logoStorageId) {
      try { await ctx.storage.delete(proj.logoStorageId as Id<"_storage">); }
      catch { /* tolerate orphan deletes */ }
    }
    await ctx.db.patch(projectId, { logoStorageId: undefined });
    return { success: true };
  },
});

export const getProgramLogoUrl = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const proj = await ctx.db.get(projectId);
    if (!proj?.logoStorageId) return null;
    return await ctx.storage.getUrl(proj.logoStorageId as Id<"_storage">);
  },
});

/** Bulk lookup keyed by project id — used by the sidebar so it
 *  doesn't have to fire one query per program. */
export const listLogosByProject = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    const out: Record<string, { code: string; url: string | null }> = {};
    await Promise.all(
      projects.map(async (p) => {
        const url = p.logoStorageId
          ? await ctx.storage.getUrl(p.logoStorageId as Id<"_storage">)
          : null;
        out[p._id] = { code: p.code, url };
      })
    );
    return out;
  },
});

// ──────────────────────────────────────────────────────────────
// HIGHLIGHTS — image / video gallery per program.
// ──────────────────────────────────────────────────────────────

export const addHighlight = mutation({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    caption:   v.optional(v.string()),
    fileName:  v.optional(v.string()),
    fileSize:  v.optional(v.number()),
    mimeType:  v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const proj = await ctx.db.get(args.projectId);
    if (!proj) throw new Error("Program not found.");

    // Append to end — order = (max existing order) + 1, starting at 0.
    const last = await ctx.db
      .query("programHighlights")
      .withIndex("by_project_order", q => q.eq("projectId", args.projectId))
      .order("desc")
      .first();
    const order = last ? last.order + 1 : 0;

    return await ctx.db.insert("programHighlights", {
      projectId: args.projectId,
      storageId: args.storageId,
      mediaType: args.mediaType,
      caption:   args.caption,
      order,
      fileName:  args.fileName,
      fileSize:  args.fileSize,
      mimeType:  args.mimeType,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });
  },
});

export const updateHighlight = mutation({
  args: {
    id:      v.id("programHighlights"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, { id, caption }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Highlight not found.");
    await ctx.db.patch(id, { caption });
    return { success: true };
  },
});

export const removeHighlight = mutation({
  args: { id: v.id("programHighlights") },
  handler: async (ctx, { id }) => {
    const h = await ctx.db.get(id);
    if (!h) return { success: true }; // already gone
    try { await ctx.storage.delete(h.storageId as Id<"_storage">); }
    catch { /* tolerate orphan deletes */ }
    await ctx.db.delete(id);
    return { success: true };
  },
});

/** Move a highlight up or down by swapping the `order` value with
 *  its neighbour — simpler than a fractional-index reorder and good
 *  enough for a small gallery. */
export const moveHighlight = mutation({
  args: {
    id:        v.id("programHighlights"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { id, direction }) => {
    const me = await ctx.db.get(id);
    if (!me) throw new Error("Highlight not found.");

    // Find the immediate neighbour in the requested direction.
    const siblings = await ctx.db
      .query("programHighlights")
      .withIndex("by_project_order", q => q.eq("projectId", me.projectId))
      .collect();
    const sorted = siblings.slice().sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s._id === me._id);
    const target = direction === "up" ? sorted[idx - 1] : sorted[idx + 1];
    if (!target) return { success: true, moved: false };

    // Swap orders.
    await ctx.db.patch(me._id,    { order: target.order });
    await ctx.db.patch(target._id, { order: me.order });
    return { success: true, moved: true };
  },
});

export const listHighlights = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const rows = await ctx.db
      .query("programHighlights")
      .withIndex("by_project_order", q => q.eq("projectId", projectId))
      .collect();
    const sorted = rows.slice().sort((a, b) => a.order - b.order);
    return await Promise.all(
      sorted.map(async (r) => ({
        ...r,
        url: await ctx.storage.getUrl(r.storageId as Id<"_storage">),
      }))
    );
  },
});

/** Convenience: highlights by program CODE — useful for places that
 *  only know the public code (e.g. an activity row tagged with
 *  projectCode "EGOV"). */
export const listHighlightsByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const proj = await ctx.db
      .query("projects")
      .withIndex("by_code", q => q.eq("code", code))
      .first();
    if (!proj) return [];
    const rows = await ctx.db
      .query("programHighlights")
      .withIndex("by_project_order", q => q.eq("projectId", proj._id))
      .collect();
    const sorted = rows.slice().sort((a, b) => a.order - b.order);
    return await Promise.all(
      sorted.map(async (r) => ({
        ...r,
        url: await ctx.storage.getUrl(r.storageId as Id<"_storage">),
      }))
    );
  },
});
