import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Get Active Announcements ─────────────────────────────────────────────────
export const getActive = query({
  handler: async (ctx) => {
    const announcements = await ctx.db
      .query("dtcAnnouncements")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();

    return announcements;
  },
});

// ─── Get All Announcements ────────────────────────────────────────────────────
export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("dtcAnnouncements").order("desc").collect();
  },
});

// ─── Create Announcement ──────────────────────────────────────────────────────
export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    type: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("dtcAnnouncements", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
    return id;
  },
});

// ─── Update Announcement ──────────────────────────────────────────────────────
export const update = mutation({
  args: {
    id: v.id("dtcAnnouncements"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    type: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return { success: true };
  },
});

// ─── Delete Announcement ──────────────────────────────────────────────────────
export const remove = mutation({
  args: { id: v.id("dtcAnnouncements") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
