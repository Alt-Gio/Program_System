import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================
// INTERN GOOGLE SHEETS SYNC
// Similar to sheetsSync.ts but for intern management
// ============================================================

/** Get connection for a specific intern sheet */
export const getInternConnection = query({
  args: {},
  handler: async (ctx) => {
    const connection = await ctx.db
      .query("sheetsConnections")
      .filter((q) => q.eq(q.field("projectId"), "INTERNS" as any))
      .first();
    
    return connection;
  },
});

/** Save or update intern sheet connection */
export const saveInternConnection = mutation({
  args: {
    sheetId: v.string(),
    sheetUrl: v.string(),
    sheetName: v.string(),
    webhookSecret: v.string(),
    syncEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sheetsConnections")
      .filter((q) => q.eq(q.field("projectId"), "INTERNS" as any))
      .first();
    
    const now = Date.now();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        sheetId: args.sheetId,
        sheetUrl: args.sheetUrl,
        sheetName: args.sheetName,
        webhookSecret: args.webhookSecret,
        syncEnabled: args.syncEnabled,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("sheetsConnections", {
        projectId: "INTERNS" as any,
        sheetId: args.sheetId,
        sheetUrl: args.sheetUrl,
        sheetName: args.sheetName,
        webhookSecret: args.webhookSecret,
        syncEnabled: args.syncEnabled,
        createdBy: "system",
        createdAt: now,
      });
    }
  },
});

/** Toggle sync enabled/disabled */
export const toggleInternSync = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("sheetsConnections")
      .filter((q) => q.eq(q.field("projectId"), "INTERNS" as any))
      .first();
    
    if (!connection) {
      throw new Error("No intern sheet connection found");
    }
    
    await ctx.db.patch(connection._id, {
      syncEnabled: args.enabled,
    });
    
    return connection._id;
  },
});

/** Delete intern sheet connection */
export const deleteInternConnection = mutation({
  args: {},
  handler: async (ctx) => {
    const connection = await ctx.db
      .query("sheetsConnections")
      .filter((q) => q.eq(q.field("projectId"), "INTERNS" as any))
      .first();
    
    if (connection) {
      await ctx.db.delete(connection._id);
    }
    
    return { success: true };
  },
});

/** Bulk upsert interns from Google Sheets */
export const bulkUpsertInternsFromSheets = mutation({
  args: {
    sheetId: v.string(),
    rows: v.array(v.object({
      fullName: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      school: v.string(),
      course: v.string(),
      department: v.optional(v.string()),
      supervisor: v.optional(v.string()),
      startDate: v.string(),
      endDate: v.string(),
      requiredHours: v.number(),
      status: v.string(),
      notes: v.optional(v.string()),
      sheetsRowNumber: v.number(),
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
        // Try to find existing intern by email
        let existingIntern = null;
        if (row.email) {
          existingIntern = await ctx.db
            .query("interns")
            .filter((q) => q.eq(q.field("email"), row.email))
            .first();
        }
        
        if (existingIntern) {
          // Update existing intern
          await ctx.db.patch(existingIntern._id, {
            fullName: row.fullName,
            school: row.school,
            course: row.course,
            department: row.department,
            supervisor: row.supervisor,
            startDate: row.startDate,
            endDate: row.endDate,
            requiredHours: row.requiredHours,
            status: row.status,
            phone: row.phone,
            notes: row.notes,
            updatedAt: now,
          });
          updated++;
        } else {
          // Create new intern
          const internId = await ctx.db.insert("interns", {
            fullName: row.fullName,
            school: row.school,
            course: row.course,
            department: row.department,
            supervisor: row.supervisor,
            startDate: row.startDate,
            endDate: row.endDate,
            requiredHours: row.requiredHours,
            totalHours: 0,
            status: row.status,
            email: row.email,
            phone: row.phone,
            notes: row.notes,
            createdAt: now,
            updatedAt: now,
          });
          
          // Create gamification account
          await ctx.db.insert("internAccounts", {
            internId,
            level: 1,
            xp: 0,
            health: 100,
            streak: 0,
            achievements: [],
            createdAt: now,
          });
          
          // Create mapping if email exists
          if (row.email) {
            await ctx.db.insert("internSheetMapping", {
              sheetsInternId: row.email,
              convexInternId: internId,
              email: row.email,
              fullName: row.fullName,
              createdAt: now,
              lastSyncAt: now,
            });
          }
          
          inserted++;
        }
      } catch (error: any) {
        errors.push(`Row ${row.sheetsRowNumber}: ${error.message}`);
      }
    }
    
    // Log sync
    const connection = await ctx.db
      .query("sheetsConnections")
      .filter((q) => q.eq(q.field("projectId"), "INTERNS" as any))
      .first();
    
    if (connection) {
      await ctx.db.patch(connection._id, {
        lastSyncAt: now,
        lastSyncStatus: errors.length > 0 ? "partial" : "success",
        lastSyncRowCount: inserted + updated,
        lastSyncError: errors.length > 0 ? errors.join("; ") : undefined,
      });
      
      await ctx.db.insert("sheetsSyncLog", {
        projectId: "INTERNS" as any,
        sheetId: args.sheetId,
        sheetName: "Interns",
        syncDirection: "sheets-to-convex",
        rowsAffected: inserted + updated,
        status: errors.length > 0 ? "partial" : "success",
        errorMessage: errors.length > 0 ? errors.join("; ") : undefined,
        syncedAt: now,
        syncedBy: args.syncedBy,
      });
    }
    
    return {
      inserted,
      updated,
      errors,
    };
  },
});

/** Get sync log for interns */
export const getInternSyncLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("sheetsSyncLog")
      .filter((q) => q.eq(q.field("projectId"), "INTERNS" as any))
      .order("desc")
      .take(args.limit ?? 10);
    
    return logs;
  },
});
