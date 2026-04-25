import { defineTable } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============================================================
// IMPORT LOG — staging + audit for the Import & Activity Log page
// Spread into convex/schema.ts via `...importLogTables`
// ============================================================

export const importLogTables = {
  import_sessions: defineTable({
    program: v.string(),
    importMode: v.union(
      v.literal("sheets"),
      v.literal("csv"),
      v.literal("paste"),
      v.literal("manual"),
      v.literal("voice"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("validated"),
      v.literal("completed"),
      v.literal("partial"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    totalRows: v.number(),
    insertedRows: v.number(),
    updatedRows: v.number(),
    skippedRows: v.number(),
    duplicatesFound: v.number(),
    validationErrors: v.number(),
    importedBy: v.optional(v.string()),
    sourceSheetTab: v.optional(v.string()),
    sourceFileName: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_program", ["program"])
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"]),

  import_row_log: defineTable({
    sessionId: v.id("import_sessions"),
    program: v.string(),
    rowIndex: v.number(),
    rowData: v.any(),
    status: v.union(
      v.literal("inserted"),
      v.literal("updated"),
      v.literal("skipped_duplicate"),
      v.literal("skipped_invalid"),
      v.literal("failed"),
    ),
    duplicateOf: v.optional(v.id("import_row_log")),
    validationErrors: v.array(
      v.object({ field: v.string(), message: v.string() }),
    ),
    insertedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_program", ["program"])
    .index("by_status", ["status"]),

  activity_log: defineTable({
    program: v.string(),
    action: v.union(
      v.literal("import"),
      v.literal("manual_add"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("sync"),
      v.literal("export"),
      v.literal("voice_add"),
      v.literal("bulk_delete"),
    ),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    detail: v.optional(v.any()),
    affectedRows: v.number(),
    performedBy: v.optional(v.string()),
    sessionId: v.optional(v.id("import_sessions")),
    timestamp: v.number(),
    isVoiceInitiated: v.boolean(),
  })
    .index("by_program", ["program"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"]),

  import_fingerprints: defineTable({
    program: v.string(),
    fingerprint: v.string(),
    sourceRowId: v.optional(v.string()),
    rowData: v.any(),
    createdAt: v.number(),
    sessionId: v.id("import_sessions"),
  })
    .index("by_program_fingerprint", ["program", "fingerprint"])
    .index("by_program", ["program"]),
};

// ------------------------------------------------------------
// QUERIES
// ------------------------------------------------------------

export const getActivityLog = query({
  args: {
    program: v.optional(v.string()),
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { program, action, limit }) => {
    const take = limit ?? 50;
    const raw = await ctx.db
      .query("activity_log")
      .withIndex("by_timestamp")
      .order("desc")
      .take(take * 3);

    return raw
      .filter(
        (entry) =>
          (!program || entry.program === program) &&
          (!action || entry.action === action),
      )
      .slice(0, take);
  },
});

export const getImportSessions = query({
  args: { program: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { program, limit }) => {
    const take = limit ?? 50;
    const sessions = await ctx.db
      .query("import_sessions")
      .withIndex("by_started")
      .order("desc")
      .take(program ? take * 3 : take);

    return program
      ? sessions.filter((s) => s.program === program).slice(0, take)
      : sessions;
  },
});

export const getSessionRows = query({
  args: { sessionId: v.id("import_sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("import_row_log")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});

export const getExistingFingerprints = query({
  args: { program: v.string() },
  handler: async (ctx, { program }) => {
    return await ctx.db
      .query("import_fingerprints")
      .withIndex("by_program", (q) => q.eq("program", program))
      .collect();
  },
});

export const getProgramCounts = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("activity_log").collect();
    const totals: Record<string, number> = {};
    for (const l of logs) {
      totals[l.program] = (totals[l.program] || 0) + l.affectedRows;
    }
    return totals;
  },
});

// ------------------------------------------------------------
// MUTATIONS
// ------------------------------------------------------------

export const createImportSession = mutation({
  args: {
    program: v.string(),
    importMode: v.union(
      v.literal("sheets"),
      v.literal("csv"),
      v.literal("paste"),
      v.literal("manual"),
      v.literal("voice"),
    ),
    totalRows: v.number(),
    importedBy: v.optional(v.string()),
    sourceFileName: v.optional(v.string()),
    sourceSheetTab: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("import_sessions", {
      ...args,
      status: "pending",
      insertedRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      duplicatesFound: 0,
      validationErrors: 0,
      startedAt: Date.now(),
    });
  },
});

export const logRow = mutation({
  args: {
    sessionId: v.id("import_sessions"),
    program: v.string(),
    rowIndex: v.number(),
    rowData: v.any(),
    status: v.union(
      v.literal("inserted"),
      v.literal("updated"),
      v.literal("skipped_duplicate"),
      v.literal("skipped_invalid"),
      v.literal("failed"),
    ),
    duplicateOf: v.optional(v.id("import_row_log")),
    validationErrors: v.array(
      v.object({ field: v.string(), message: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("import_row_log", {
      ...args,
      insertedAt: Date.now(),
    });
  },
});

export const completeImportSession = mutation({
  args: {
    sessionId: v.id("import_sessions"),
    insertedRows: v.number(),
    updatedRows: v.number(),
    skippedRows: v.number(),
    duplicatesFound: v.number(),
    validationErrors: v.number(),
    status: v.union(
      v.literal("completed"),
      v.literal("partial"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, ...updates }) => {
    await ctx.db.patch(sessionId, {
      ...updates,
      completedAt: Date.now(),
    });

    const session = await ctx.db.get(sessionId);
    if (!session) return;

    await ctx.db.insert("activity_log", {
      program: session.program,
      action: "import",
      entityType: "activity",
      summary: `Imported ${updates.insertedRows} rows to ${session.program} via ${session.importMode}`,
      detail: {
        inserted: updates.insertedRows,
        updated: updates.updatedRows,
        skipped: updates.skippedRows,
        errors: updates.validationErrors,
        duplicates: updates.duplicatesFound,
        sourceFile: session.sourceFileName,
        sourceSheet: session.sourceSheetTab,
        mode: session.importMode,
      },
      affectedRows: updates.insertedRows + updates.updatedRows,
      performedBy: session.importedBy,
      sessionId,
      timestamp: Date.now(),
      isVoiceInitiated: session.importMode === "voice",
    });
  },
});

export const saveFingerprints = mutation({
  args: {
    program: v.string(),
    fingerprints: v.array(
      v.object({
        fingerprint: v.string(),
        rowData: v.any(),
      }),
    ),
    sessionId: v.id("import_sessions"),
  },
  handler: async (ctx, { program, fingerprints, sessionId }) => {
    for (const fp of fingerprints) {
      await ctx.db.insert("import_fingerprints", {
        program,
        fingerprint: fp.fingerprint,
        rowData: fp.rowData,
        createdAt: Date.now(),
        sessionId,
      });
    }
    return fingerprints.length;
  },
});

// ------------------------------------------------------------
// CONFIRM TO PRODUCTION — flat staged rows → real activities table
// ------------------------------------------------------------

const stagedRow = v.object({
  activityTitle: v.string(),
  date: v.optional(v.string()),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  venue: v.optional(v.string()),
  province: v.optional(v.string()),
  municipality: v.optional(v.string()),
  participants: v.optional(v.string()),
  male: v.optional(v.string()),
  female: v.optional(v.string()),
  remarks: v.optional(v.string()),
  // Allow any extra fields — we only use the known ones above
});

// Distribute total/male/female across the nested NGA/LGU/SUC/others buckets.
type SplitBucket = "nga" | "lgu" | "suc" | "others";

export const confirmImportToActivities = mutation({
  args: {
    sessionId: v.id("import_sessions"),
    projectCode: v.string(), // e.g. "EGOV"
    rows: v.array(stagedRow),
    // Which bucket the total/male/female values flow into
    bucket: v.union(
      v.literal("nga"),
      v.literal("lgu"),
      v.literal("suc"),
      v.literal("others"),
    ),
    othersLabel: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_code", (q) => q.eq("code", args.projectCode))
      .first();
    if (!project) {
      throw new Error(
        `Project with code "${args.projectCode}" not found. Seed the projects table first.`,
      );
    }

    const provinces = await ctx.db.query("provinces").collect();

    let inserted = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      try {
        const participants = buildParticipants(
          row.participants,
          row.male,
          row.female,
          args.bucket,
          args.othersLabel,
        );

        const provinceId = matchProvince(row.province, provinces);
        if (!provinceId) {
          throw new Error(
            `No province match for "${row.province ?? "(empty)"}". Row skipped.`,
          );
        }

        const { startDate, endDate, month, year } = normalizeDates(
          row.date,
          row.startDate,
          row.endDate,
        );
        if (!startDate) {
          throw new Error("Missing or invalid date.");
        }

        await ctx.db.insert("activities", {
          projectId: project._id,
          provinceId,
          barangay: row.municipality || undefined,
          month,
          year,
          activityTitle: row.activityTitle,
          venue: row.venue ?? "",
          partnerOrganizations: [],
          startDate,
          endDate: endDate ?? startDate,
          modeOfConduct: "Onsite",
          personnelIds: [],
          participants,
          status: "Draft",
          remarks: row.remarks || undefined,
          createdBy: args.createdBy,
          importedFrom: `import_session:${args.sessionId}`,
          importedAt: Date.now(),
          syncedToSheets: false,
        });
        inserted++;
      } catch (e: any) {
        skipped++;
        errors.push({ row: i, message: e?.message ?? String(e) });
      }
    }

    // Log the promotion to activity_log so it appears in the timeline
    await ctx.db.insert("activity_log", {
      program: project.shortName,
      action: "import",
      entityType: "activity",
      summary: `Promoted ${inserted} row${inserted === 1 ? "" : "s"} from staging to ${project.shortName} activities${
        skipped > 0 ? ` (${skipped} skipped)` : ""
      }`,
      detail: {
        inserted,
        skipped,
        errors: errors.slice(0, 20),
        bucket: args.bucket,
        projectCode: args.projectCode,
        fromSession: args.sessionId,
      },
      affectedRows: inserted,
      performedBy: args.createdBy,
      sessionId: args.sessionId,
      timestamp: Date.now(),
      isVoiceInitiated: false,
    });

    return { inserted, skipped, errors };
  },
});

// ------------------------------------------------------------
// Helpers (pure — live inside the mutation file for convenience)
// ------------------------------------------------------------

function toInt(v?: string): number {
  if (!v) return 0;
  const n = parseInt(String(v).replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function buildParticipants(
  total: string | undefined,
  male: string | undefined,
  female: string | undefined,
  bucket: SplitBucket,
  othersLabel: string | undefined,
) {
  const zero = { male: 0, female: 0 };
  const result = {
    nga: { ...zero },
    lgu: { ...zero },
    suc: { ...zero },
    others: { ...zero, label: undefined as string | undefined },
  };

  const m = toInt(male);
  const f = toInt(female);
  const t = toInt(total);

  let finalMale = m;
  let finalFemale = f;

  if (m === 0 && f === 0 && t > 0) {
    // Split total evenly if no breakdown was provided
    finalMale = Math.floor(t / 2);
    finalFemale = t - finalMale;
  }

  if (bucket === "nga") result.nga = { male: finalMale, female: finalFemale };
  else if (bucket === "lgu") result.lgu = { male: finalMale, female: finalFemale };
  else if (bucket === "suc") result.suc = { male: finalMale, female: finalFemale };
  else {
    result.others = {
      male: finalMale,
      female: finalFemale,
      label: othersLabel || "Partner",
    };
  }
  return result;
}

function normalizeDates(
  date: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
): { startDate?: string; endDate?: string; month: number; year: number } {
  const pick = startDate || date;
  if (!pick) {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }
  const parsed = parseDateFlexible(pick);
  if (!parsed) {
    return { month: 1, year: new Date().getFullYear() };
  }
  const iso = parsed.toISOString().slice(0, 10);
  const end = endDate ? parseDateFlexible(endDate)?.toISOString().slice(0, 10) : undefined;
  return {
    startDate: iso,
    endDate: end ?? iso,
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
  };
}

function parseDateFlexible(s: string): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slash) {
    const [, m, d, y] = slash;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const p = new Date(trimmed);
  return Number.isNaN(p.getTime()) ? null : p;
}

function matchProvince(
  nameFromRow: string | undefined,
  provinces: Array<{ _id: any; name: string; code: string }>,
): any | null {
  if (!nameFromRow) {
    // Fall back to the first province so we don't block imports when the
    // source doesn't carry province info (user can correct in the activities UI)
    return provinces[0]?._id ?? null;
  }
  const q = nameFromRow.toLowerCase().trim();
  const exact = provinces.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact._id;
  const contains = provinces.find(
    (p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()),
  );
  if (contains) return contains._id;
  const byCode = provinces.find((p) => p.code.toLowerCase() === q);
  return byCode?._id ?? null;
}

export const logManualAction = mutation({
  args: {
    program: v.string(),
    action: v.union(
      v.literal("import"),
      v.literal("manual_add"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("sync"),
      v.literal("export"),
      v.literal("voice_add"),
      v.literal("bulk_delete"),
    ),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    detail: v.optional(v.any()),
    affectedRows: v.number(),
    performedBy: v.optional(v.string()),
    isVoiceInitiated: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activity_log", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
