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

// ─── Get unsynced activities (for auto-sync to DICT_Program sheets) ─────────
export const getUnsyncedActivitiesPublic = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("activities")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(args.limit ?? 50);

    const enriched = await Promise.all(
      records.map(async (r) => {
        const project = await ctx.db.get(r.projectId);
        const province = await ctx.db.get(r.provinceId);
        const lgu = r.lguId ? await ctx.db.get(r.lguId) : null;
        // Find sheet connection for this project
        const connection = await ctx.db
          .query("sheetsConnections")
          .withIndex("by_project", (q) => q.eq("projectId", r.projectId))
          .first();

        return {
          _id: r._id,
          projectId: r.projectId,
          projectCode: project?.code ?? "",
          provinceName: province?.name ?? "",
          lguName: lgu?.name ?? "",
          month: r.month,
          year: r.year,
          activityTitle: r.activityTitle,
          venue: r.venue,
          partnerOrganizations: r.partnerOrganizations,
          startDate: r.startDate,
          endDate: r.endDate,
          modeOfConduct: r.modeOfConduct,
          personnelRaw: r.personnelRaw,
          participants: r.participants,
          status: r.status,
          remarks: r.remarks,
          afterActivityReport: r.afterActivityReport,
          fbPostingLink: r.fbPostingLink,
          rawPhotosLink: r.rawPhotosLink,
          testimonialsLink: r.testimonialsLink,
          driveFolderLink: r.driveFolderLink,
          extraFields: r.extraFields,
          images: r.images,
          sheetId: connection?.sheetId,
          sheetName: connection?.sheetName,
          sheetSyncEnabled: connection?.syncEnabled ?? false,
        };
      })
    );
    return enriched;
  },
});

// ─── Mark activities as synced to sheets ────────────────────────────────────
export const markActivitiesSyncedPublic = mutation({
  args: { ids: v.array(v.id("activities")) },
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
    const pendingActivities = await ctx.db
      .query("activities")
      .withIndex("by_syncedToSheets", (q) => q.eq("syncedToSheets", false))
      .take(500);
    return {
      attendance: pendingAttendance.length,
      dtcLogs: pendingDTC.length,
      auditLogs: pendingAudit.length,
      activities: pendingActivities.length,
    };
  },
});
