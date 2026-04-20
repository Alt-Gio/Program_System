import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

// ============================================================
// Internal queries/mutations for attendance + DTC sync tracking
// Used by googleSheetsWrite.ts actions to fetch unsynced records
// and mark them as synced after writing to Google Sheets.
// ============================================================

// ─── Get unsynced intern attendance records ─────────────────────────────────
export const getUnsyncedAttendance = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("internAttendance")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(args.limit ?? 100);

    // Enrich with intern name
    const enriched = await Promise.all(
      records.map(async (r) => {
        const intern = await ctx.db.get(r.internId);
        return {
          ...r,
          internName: intern?.fullName ?? "Unknown",
          internSchool: intern?.school ?? "",
          internDepartment: intern?.department ?? "",
        };
      })
    );

    return enriched;
  },
});

// ─── Mark intern attendance records as synced ───────────────────────────────
export const markAttendanceSynced = internalMutation({
  args: { ids: v.array(v.id("internAttendance")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, { syncedToSheets: true, lastSyncedAt: now });
    }
  },
});

// ─── Get unsynced DTC log records ───────────────────────────────────────────
export const getUnsyncedDTCLogs = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("dtcLogs")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(args.limit ?? 100);

    // Enrich with PC name
    const enriched = await Promise.all(
      records.map(async (r) => {
        let pcName = null;
        if (r.pcId) {
          const pc = await ctx.db.get(r.pcId);
          pcName = pc?.name ?? null;
        }
        return { ...r, pcName };
      })
    );

    return enriched;
  },
});

// ─── Mark DTC log records as synced ─────────────────────────────────────────
export const markDTCLogsSynced = internalMutation({
  args: { ids: v.array(v.id("dtcLogs")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, { syncedToSheets: true, lastSyncedAt: now });
    }
  },
});

// ─── Count pending sync records (internal — for sync status dashboard) ──────
export const countPending = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pendingAttendance = await ctx.db
      .query("internAttendance")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(500);

    const pendingDTC = await ctx.db
      .query("dtcLogs")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(500);

    const pendingAudit = await ctx.db
      .query("auditLog")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(500);

    return {
      attendance: pendingAttendance.length,
      dtcLogs: pendingDTC.length,
      auditLogs: pendingAudit.length,
    };
  },
});

// ============================================================
// Public wrappers — used by Next.js /api/sync-trigger route
// ============================================================

export const getUnsyncedAttendancePublic = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("internAttendance")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(args.limit ?? 50);

    const enriched = await Promise.all(
      records.map(async (r) => {
        const intern = await ctx.db.get(r.internId);
        return {
          _id: r._id,
          date: r.date,
          timeIn: r.timeIn,
          timeOut: r.timeOut,
          hours: r.hours,
          checkInMethod: r.checkInMethod,
          faceConfidence: r.faceConfidence,
          status: r.status,
          internName: intern?.fullName ?? "Unknown",
          internSchool: intern?.school ?? "",
          internDepartment: intern?.department ?? "",
        };
      })
    );
    return enriched;
  },
});

export const getUnsyncedDTCLogsPublic = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("dtcLogs")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(args.limit ?? 50);

    const enriched = await Promise.all(
      records.map(async (r) => {
        let pcName = null;
        if (r.pcId) {
          const pc = await ctx.db.get(r.pcId);
          pcName = pc?.name ?? null;
        }
        return {
          _id: r._id,
          fullName: r.fullName,
          agency: r.agency,
          purpose: r.purpose,
          equipmentUsed: r.equipmentUsed,
          pcName,
          serviceType: r.serviceType,
          timeIn: r.timeIn,
          timeOut: r.timeOut,
          plannedDurationHours: r.plannedDurationHours,
          satisfactionRating: r.satisfactionRating,
          remarks: r.remarks,
          contactEmail: r.contactEmail,
          contactPhone: r.contactPhone,
        };
      })
    );
    return enriched;
  },
});

export const markAttendanceSyncedPublic = mutation({
  args: { ids: v.array(v.id("internAttendance")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, { syncedToSheets: true, lastSyncedAt: now });
    }
    return { marked: args.ids.length };
  },
});

export const markDTCLogsSyncedPublic = mutation({
  args: { ids: v.array(v.id("dtcLogs")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, { syncedToSheets: true, lastSyncedAt: now });
    }
    return { marked: args.ids.length };
  },
});

export const countPendingPublic = query({
  args: {},
  handler: async (ctx) => {
    const pendingAttendance = await ctx.db
      .query("internAttendance")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(500);
    const pendingDTC = await ctx.db
      .query("dtcLogs")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(500);
    const pendingAudit = await ctx.db
      .query("auditLog")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(500);
    return {
      attendance: pendingAttendance.length,
      dtcLogs: pendingDTC.length,
      auditLogs: pendingAudit.length,
    };
  },
});
