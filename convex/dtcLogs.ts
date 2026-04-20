import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Create Log Entry ─────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    fullName: v.string(),
    agency: v.string(),
    purpose: v.string(),
    equipmentUsed: v.array(v.string()),
    pcId: v.optional(v.id("dtcPcs")),
    photoDataUrl: v.optional(v.string()),
    plannedDurationHours: v.number(),
    serviceType: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timeIn = new Date().toISOString();
    
    // If PC is selected, mark it as IN_USE
    if (args.pcId) {
      await ctx.db.patch(args.pcId, { status: "IN_USE" });
    }

    const logId = await ctx.db.insert("dtcLogs", {
      ...args,
      timeIn,
      timeOut: undefined,
      satisfactionRating: undefined,
      remarks: undefined,
      syncedToSheets: false,
      createdAt: Date.now(),
    });

    // Audit log entry for DTC client check-in
    await ctx.runMutation(internal.auditLog.logEntry, {
      type: "DTC_CLIENT_CHECKIN",
      entityId: logId,
      userName: args.fullName,
      timestamp: timeIn,
      method: "WALK_IN",
      pcId: args.pcId ?? undefined,
      metadata: JSON.stringify({
        agency: args.agency,
        purpose: args.purpose,
        serviceType: args.serviceType,
        equipmentUsed: args.equipmentUsed,
      }),
    });

    return { id: logId, timeIn };
  },
});

// ─── Update Log (for checkout or rating) ──────────────────────────────────────
export const update = mutation({
  args: {
    id: v.id("dtcLogs"),
    timeOut: v.optional(v.string()),
    satisfactionRating: v.optional(v.number()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const log = await ctx.db.get(id);
    
    if (!log) throw new Error("Log not found");

    // If checking out, free up the PC
    if (updates.timeOut && log.pcId) {
      await ctx.db.patch(log.pcId, { status: "ONLINE" });
    }

    // Mark as needing re-sync if checking out
    if (updates.timeOut) {
      await ctx.db.patch(id, { ...updates, syncedToSheets: false });

      // Audit log entry for DTC client check-out
      await ctx.runMutation(internal.auditLog.logEntry, {
        type: "DTC_CLIENT_CHECKOUT",
        entityId: id,
        userName: log.fullName,
        timestamp: updates.timeOut,
        method: "WALK_IN",
        pcId: log.pcId ?? undefined,
        metadata: JSON.stringify({
          satisfactionRating: updates.satisfactionRating,
          remarks: updates.remarks,
        }),
      });
    } else {
      await ctx.db.patch(id, updates);
    }

    return { success: true };
  },
});

// ─── Get Recent Logs ──────────────────────────────────────────────────────────
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("dtcLogs")
      .order("desc")
      .take(args.limit ?? 50);

    // Populate PC info
    const logsWithPc = await Promise.all(
      logs.map(async (log) => {
        if (!log.pcId) return { ...log, pc: null };
        const pc = await ctx.db.get(log.pcId);
        return { ...log, pc };
      })
    );

    return logsWithPc;
  },
});

// ─── Get Active Sessions ──────────────────────────────────────────────────────
export const getActiveSessions = query({
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("dtcLogs")
      .order("desc")
      .filter((q) => q.eq(q.field("timeOut"), undefined))
      .take(100);

    return logs;
  },
});

// ─── Get Logs by Date Range ───────────────────────────────────────────────────
export const getByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("dtcLogs")
      .order("desc")
      .collect();

    return logs.filter(
      (log) => log.timeIn >= args.startDate && log.timeIn <= args.endDate
    );
  },
});

// ─── Get Stats ────────────────────────────────────────────────────────────────
export const getStats = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db.query("dtcLogs").order("desc").collect();

    if (args.startDate && args.endDate) {
      logs = logs.filter(
        (log) => log.timeIn >= args.startDate! && log.timeIn <= args.endDate!
      );
    }

    const totalVisitors = logs.length;
    const pcUsers = logs.filter((l) => l.equipmentUsed.includes("Desktop Computer")).length;
    const wifiUsers = logs.filter((l) => l.equipmentUsed.includes("Internet Only")).length;
    const avgRating =
      logs.filter((l) => l.satisfactionRating).reduce((sum, l) => sum + (l.satisfactionRating ?? 0), 0) /
      logs.filter((l) => l.satisfactionRating).length || 0;

    return {
      totalVisitors,
      pcUsers,
      wifiUsers,
      avgRating: avgRating.toFixed(1),
    };
  },
});
