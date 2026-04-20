import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";

// ============================================================
// Sync Status Monitor — Tracks sync health for each Google Sheet
// ============================================================

// ─── Upsert sync status (internal — called by sync actions) ─────────────────
export const upsertStatus = internalMutation({
  args: {
    sheetName: v.string(),
    sheetId: v.string(),
    status: v.string(),
    recordsSynced: v.optional(v.number()),
    totalPending: v.optional(v.number()),
    lastError: v.optional(v.string()),
    nextScheduledSync: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("syncStatus")
      .withIndex("by_sheetName", (q) => q.eq("sheetName", args.sheetName))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sheetId: args.sheetId,
        status: args.status,
        lastSyncTime: args.status === "success" || args.status === "error" ? now : existing.lastSyncTime,
        recordsSynced: args.recordsSynced ?? existing.recordsSynced,
        totalPending: args.totalPending ?? existing.totalPending,
        lastError: args.status === "error" ? args.lastError : args.status === "success" ? undefined : existing.lastError,
        nextScheduledSync: args.nextScheduledSync ?? existing.nextScheduledSync,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("syncStatus", {
        sheetName: args.sheetName,
        sheetId: args.sheetId,
        status: args.status,
        lastSyncTime: args.status === "success" ? now : undefined,
        recordsSynced: args.recordsSynced,
        totalPending: args.totalPending,
        lastError: args.lastError,
        nextScheduledSync: args.nextScheduledSync,
        updatedAt: now,
      });
    }
  },
});

// ─── Get all sync statuses (public — for admin dashboard) ───────────────────
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("syncStatus").order("desc").take(20);
  },
});

// ─── Get status for a specific sheet (public) ───────────────────────────────
export const getBySheet = query({
  args: { sheetName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("syncStatus")
      .withIndex("by_sheetName", (q) => q.eq("sheetName", args.sheetName))
      .first();
  },
});

// ─── Get all statuses (internal — used by health check) ─────────────────────
export const getAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("syncStatus").take(20);
  },
});
