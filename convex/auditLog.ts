import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

// ============================================================
// Audit Log — Immutable trail of all check-in/out events
// Types: INTERN_CHECKIN, INTERN_CHECKOUT, DTC_CLIENT_CHECKIN, DTC_CLIENT_CHECKOUT
// ============================================================

// ─── Insert an audit log entry (internal only) ──────────────────────────────
export const logEntry = internalMutation({
  args: {
    type: v.string(),
    entityId: v.string(),
    userId: v.optional(v.string()),
    userName: v.string(),
    timestamp: v.string(),
    method: v.optional(v.string()),
    confidence: v.optional(v.number()),
    pcId: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLog", {
      ...args,
      syncedToSheets: false,
      createdAt: Date.now(),
    });
  },
});

// ─── Get today's audit entries (public query for dashboard) ─────────────────
export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    return logs.filter((l) => l.timestamp.startsWith(today));
  },
});

// ─── Get audit entries by date range ────────────────────────────────────────
export const getByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logs;
    if (args.type) {
      logs = await ctx.db
        .query("auditLog")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(args.limit ?? 500);
    } else {
      logs = await ctx.db
        .query("auditLog")
        .withIndex("by_timestamp")
        .order("desc")
        .take(args.limit ?? 500);
    }

    return logs.filter(
      (l) => l.timestamp >= args.startDate && l.timestamp <= args.endDate + "T23:59:59"
    );
  },
});

// ─── Get unsynced records (internal — used by Google Sheets writer) ─────────
export const getUnsynced = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLog")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(args.limit ?? 100);
  },
});

// ─── Mark records as synced (internal — called after Sheets write) ──────────
export const markSynced = internalMutation({
  args: {
    ids: v.array(v.id("auditLog")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, { syncedToSheets: true, lastSyncedAt: now });
    }
  },
});

// ─── Mark records as synced (public — called by Next.js /api/sync-trigger) ───
export const markSyncedPublic = mutation({
  args: {
    ids: v.array(v.id("auditLog")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, { syncedToSheets: true, lastSyncedAt: now });
    }
    return { marked: args.ids.length };
  },
});

// ─── Stats for today (public — used by dashboard) ──────────────────────────
export const getTodayStats = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);

    const todayLogs = logs.filter((l) => l.timestamp.startsWith(today));

    const internCheckIns = todayLogs.filter((l) => l.type === "INTERN_CHECKIN").length;
    const internCheckOuts = todayLogs.filter((l) => l.type === "INTERN_CHECKOUT").length;
    const dtcCheckIns = todayLogs.filter((l) => l.type === "DTC_CLIENT_CHECKIN").length;
    const dtcCheckOuts = todayLogs.filter((l) => l.type === "DTC_CLIENT_CHECKOUT").length;

    const byMethod: Record<string, number> = {};
    for (const log of todayLogs) {
      const method = log.method ?? "UNKNOWN";
      byMethod[method] = (byMethod[method] ?? 0) + 1;
    }

    return {
      internCheckIns,
      internCheckOuts,
      dtcCheckIns,
      dtcCheckOuts,
      totalEvents: todayLogs.length,
      byMethod,
      pendingSync: todayLogs.filter((l) => !l.syncedToSheets).length,
    };
  },
});

// ─── Recent activity feed (public — used by dashboard timeline) ─────────────
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
