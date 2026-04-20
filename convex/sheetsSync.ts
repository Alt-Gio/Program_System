import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// ============================================================
// Google Sheets ↔ Convex Sync Engine
// Google Sheet is the PRIMARY data source.
// All writes from Sheets propagate to Convex automatically.
// ============================================================

const participantsV = v.object({
  nga: v.object({ male: v.number(), female: v.number() }),
  lgu: v.object({ male: v.number(), female: v.number() }),
  suc: v.object({ male: v.number(), female: v.number() }),
  others: v.object({ male: v.number(), female: v.number(), label: v.optional(v.string()) }),
});

// ----------------------------------------------------------
// Connections CRUD
// ----------------------------------------------------------

export const listConnections = query({
  args: {},
  handler: async (ctx) => {
    const conns = await ctx.db.query("sheetsConnections").collect();
    return Promise.all(
      conns.map(async (c) => {
        const project = await ctx.db.get(c.projectId);
        return { ...c, project };
      })
    );
  },
});

export const getConnection = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sheetsConnections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();
  },
});

export const getConnectionBySheetId = query({
  args: { sheetId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sheetsConnections")
      .withIndex("by_sheet_id", (q) => q.eq("sheetId", args.sheetId))
      .first();
  },
});

export const saveConnection = mutation({
  args: {
    projectId: v.id("projects"),
    sheetUrl: v.string(),
    sheetName: v.string(),
    syncEnabled: v.boolean(),
    columnMap: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Extract sheet ID from URL
    const match = args.sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error("Invalid Google Sheets URL. Must be a full spreadsheet URL.");
    const sheetId = match[1];

    // Generate a secure webhook secret
    const secret = generateSecret();

    const existing = await ctx.db
      .query("sheetsConnections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sheetId,
        sheetUrl: args.sheetUrl,
        sheetName: args.sheetName,
        syncEnabled: args.syncEnabled,
        columnMap: args.columnMap,
        webhookSecret: existing.webhookSecret, // preserve existing secret
      });
      return { id: existing._id, webhookSecret: existing.webhookSecret, sheetId, isNew: false };
    } else {
      const id = await ctx.db.insert("sheetsConnections", {
        projectId: args.projectId,
        sheetId,
        sheetUrl: args.sheetUrl,
        sheetName: args.sheetName,
        webhookSecret: secret,
        syncEnabled: args.syncEnabled,
        columnMap: args.columnMap,
        createdBy: args.createdBy,
        createdAt: Date.now(),
      });
      return { id, webhookSecret: secret, sheetId, isNew: true };
    }
  },
});

export const deleteConnection = mutation({
  args: { id: v.id("sheetsConnections") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

export const toggleSync = mutation({
  args: { id: v.id("sheetsConnections"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { syncEnabled: args.enabled });
  },
});

// ----------------------------------------------------------
// Core Upsert — called by webhook AND manual sync
// Matches existing rows by (projectId + sheetRowId) or
// (projectId + activityTitle + startDate) to avoid duplicates.
// ----------------------------------------------------------

const upsertRowArgs = {
  projectId: v.id("projects"),
  sheetId: v.string(),
  sheetRowNumber: v.optional(v.number()),
  provinceId: v.id("provinces"),
  lguId: v.optional(v.id("lgus")),
  month: v.number(),
  year: v.number(),
  activityTitle: v.string(),
  venue: v.string(),
  partnerOrganizations: v.array(v.string()),
  startDate: v.string(),
  endDate: v.string(),
  modeOfConduct: v.string(),
  personnelRaw: v.optional(v.string()),
  participants: participantsV,
  afterActivityReport: v.optional(v.string()),
  fbPostingLink: v.optional(v.string()),
  rawPhotosLink: v.optional(v.string()),
  testimonialsLink: v.optional(v.string()),
  remarks: v.optional(v.string()),
  extraFields: v.optional(v.string()),
  status: v.optional(v.string()),
  syncedBy: v.string(),
};

export const upsertActivityFromSheet = mutation({
  args: upsertRowArgs,
  handler: async (ctx, args) => {
    const { syncedBy, sheetId, sheetRowNumber, ...activityData } = args;
    const now = Date.now();

    // Try to find existing activity: match by title + startDate + project
    const existing = await ctx.db
      .query("activities")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) =>
        q.and(
          q.eq(q.field("activityTitle"), args.activityTitle),
          q.eq(q.field("startDate"), args.startDate)
        )
      )
      .first();

    if (existing) {
      // Update — Sheet is master, overwrite all fields
      await ctx.db.patch(existing._id, {
        ...activityData,
        status: args.status ?? existing.status,
        updatedBy: syncedBy,
        importedFrom: "google_sheets",
        importedAt: now,
      });
      return { action: "updated", id: existing._id };
    } else {
      // Insert new
      const id = await ctx.db.insert("activities", {
        ...activityData,
        personnelIds: [],
        status: args.status ?? "Submitted",
        createdBy: syncedBy,
        importedFrom: "google_sheets",
        importedAt: now,
      });
      return { action: "inserted", id };
    }
  },
});

// ----------------------------------------------------------
// Bulk upsert — for manual full-sheet sync
// ----------------------------------------------------------

export const bulkUpsertFromSheets = mutation({
  args: {
    projectId: v.id("projects"),
    sheetId: v.string(),
    rows: v.array(v.object({
      subProjectId: v.optional(v.id("subProjects")),
      provinceId: v.id("provinces"),
      lguId: v.optional(v.id("lgus")),
      barangay: v.optional(v.string()),
      month: v.number(),
      year: v.number(),
      activityTitle: v.string(),
      venue: v.string(),
      partnerOrganizations: v.array(v.string()),
      startDate: v.string(),
      endDate: v.string(),
      modeOfConduct: v.string(),
      personnelRaw: v.optional(v.string()),
      participants: participantsV,
      afterActivityReport: v.optional(v.string()),
      fbPostingLink: v.optional(v.string()),
      rawPhotosLink: v.optional(v.string()),
      testimonialsLink: v.optional(v.string()),
      driveFolderLink: v.optional(v.string()),
      remarks: v.optional(v.string()),
      extraFields: v.optional(v.string()),
      status: v.optional(v.string()),
      sheetRowNumber: v.optional(v.number()),
      images: v.optional(v.array(v.object({
        url: v.string(),
        uploadedAt: v.number(),
        driveId: v.optional(v.string()),
        caption: v.optional(v.string()),
      }))),
    })),
    syncedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of args.rows) {
      try {
        const existing = await ctx.db
          .query("activities")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .filter((q) =>
            q.and(
              q.eq(q.field("activityTitle"), row.activityTitle),
              q.eq(q.field("startDate"), row.startDate)
            )
          )
          .first();

        const { status, sheetRowNumber, ...rowData } = row;

        if (existing) {
          await ctx.db.patch(existing._id, {
            ...rowData,
            status: status ?? existing.status,
            updatedBy: args.syncedBy,
            importedFrom: "google_sheets",
            importedAt: now,
            syncedToSheets: true,
            lastSyncedAt: now,
          });
          updated++;
        } else {
          await ctx.db.insert("activities", {
            projectId: args.projectId,
            ...rowData,
            personnelIds: [],
            status: status ?? "Submitted",
            createdBy: args.syncedBy,
            importedFrom: "google_sheets",
            importedAt: now,
            syncedToSheets: true,
            lastSyncedAt: now,
          });
          inserted++;
        }
      } catch (e) {
        errors.push(String(e));
      }
    }

    // Update connection sync status
    const conn = await ctx.db
      .query("sheetsConnections")
      .withIndex("by_sheet_id", (q) => q.eq("sheetId", args.sheetId))
      .first();
    if (conn) {
      await ctx.db.patch(conn._id, {
        lastSyncAt: now,
        lastSyncStatus: errors.length > 0 ? "partial" : "success",
        lastSyncRowCount: inserted + updated,
        lastSyncError: errors.length > 0 ? errors.slice(0, 3).join("; ") : undefined,
      });
    }

    // Log the sync
    await ctx.db.insert("sheetsSyncLog", {
      projectId: args.projectId,
      sheetId: args.sheetId,
      sheetName: "Activities",
      syncDirection: "import",
      rowsAffected: inserted + updated,
      status: errors.length > 0 ? "partial" : "success",
      errorMessage: errors.length > 0 ? errors.slice(0, 3).join("; ") : undefined,
      syncedAt: now,
      syncedBy: args.syncedBy,
    });

    return { inserted, updated, errors };
  },
});

// ----------------------------------------------------------
// Sync log query
// ----------------------------------------------------------

export const getSyncLog = query({
  args: { projectId: v.optional(v.id("projects")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let logs;
    if (args.projectId) {
      logs = await ctx.db
        .query("sheetsSyncLog")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .order("desc")
        .collect();
    } else {
      logs = await ctx.db.query("sheetsSyncLog").order("desc").collect();
    }
    const limited = (args.limit ? logs.slice(0, args.limit) : logs.slice(0, 20));
    return Promise.all(
      limited.map(async (l) => {
        const project = await ctx.db.get(l.projectId);
        return { ...l, projectName: project?.shortName ?? "?" };
      })
    );
  },
});

// ----------------------------------------------------------
// Mark connection error (called by sheetsActions on failure)
// ----------------------------------------------------------

export const markConnectionError = internalMutation({
  args: { id: v.id("sheetsConnections"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastSyncAt: Date.now(),
      lastSyncStatus: "error",
      lastSyncError: args.error.slice(0, 300),
    });
  },
});

// ----------------------------------------------------------
// Mark sync status after webhook push
// ----------------------------------------------------------

export const markSyncSuccess = internalMutation({
  args: {
    sheetId: v.string(),
    rowsAffected: v.number(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db
      .query("sheetsConnections")
      .withIndex("by_sheet_id", (q) => q.eq("sheetId", args.sheetId))
      .first();
    if (conn) {
      await ctx.db.patch(conn._id, {
        lastSyncAt: Date.now(),
        lastSyncStatus: "success",
        lastSyncRowCount: args.rowsAffected,
        lastSyncError: undefined,
      });
    }
  },
});

// ----------------------------------------------------------
// Utility
// ----------------------------------------------------------

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
