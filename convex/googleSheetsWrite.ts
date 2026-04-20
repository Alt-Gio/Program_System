// ============================================================
// Google Sheets WRITE Actions
// Delegates all Sheets writes to Next.js /api/sync-trigger endpoint.
// This avoids the Windows Convex local backend ESM loader bug
// (Received protocol 'c:') that breaks "use node" actions.
//
// Required env vars:
//   In Convex:  DICT_ATTENDANCE_LOG_SHEET_ID, DICT_DTC_LOGBOOK_SHEET_ID,
//               DICT_SYNC_STATUS_SHEET_ID, SHEETS_WRITE_PROXY_URL
//   In .env.local (Next.js):  GOOGLE_SERVICE_ACCOUNT_KEY (or EMAIL + KEY)
// ============================================================

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ============================================================
// CRON ACTIONS — delegate to Next.js /api/sync-trigger
// The Next.js API handles JWT signing natively in Node.js,
// avoiding the Windows ESM loader bug with Convex "use node".
// ============================================================

function getSyncTriggerUrl(): string {
  return process.env.SHEETS_WRITE_PROXY_URL || "http://127.0.0.1:3000/api/sync-trigger";
}

async function callSyncTrigger(target: string): Promise<{ ok: boolean; message: string; synced?: number }> {
  const resp = await fetch(getSyncTriggerUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sync trigger HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ─── Sync pending intern attendance to DICT_Attendance_Log ──────────────────
export const syncPendingAttendance = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const result = await callSyncTrigger("syncAttendance");
      console.log("[syncPendingAttendance]", result.message);
      if (result.ok) {
        await ctx.runMutation(internal.syncMonitor.upsertStatus, {
          sheetName: "DICT_Attendance_Log",
          sheetId: process.env.DICT_ATTENDANCE_LOG_SHEET_ID ?? "",
          status: "success",
          recordsSynced: result.synced ?? 0,
        });
      }
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[syncPendingAttendance] Error:", msg);
      await ctx.runMutation(internal.syncMonitor.upsertStatus, {
        sheetName: "DICT_Attendance_Log",
        sheetId: process.env.DICT_ATTENDANCE_LOG_SHEET_ID ?? "",
        status: "error",
        lastError: msg.slice(0, 300),
      });
      return { ok: false, message: msg };
    }
  },
});

// ─── Sync pending DTC logs to DICT_DTC_Logbook ─────────────────────────────
export const syncPendingDTCLogs = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const result = await callSyncTrigger("syncDTC");
      console.log("[syncPendingDTCLogs]", result.message);
      if (result.ok) {
        await ctx.runMutation(internal.syncMonitor.upsertStatus, {
          sheetName: "DICT_DTC_Logbook",
          sheetId: process.env.DICT_DTC_LOGBOOK_SHEET_ID ?? "",
          status: "success",
          recordsSynced: result.synced ?? 0,
        });
      }
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[syncPendingDTCLogs] Error:", msg);
      await ctx.runMutation(internal.syncMonitor.upsertStatus, {
        sheetName: "DICT_DTC_Logbook",
        sheetId: process.env.DICT_DTC_LOGBOOK_SHEET_ID ?? "",
        status: "error",
        lastError: msg.slice(0, 300),
      });
      return { ok: false, message: msg };
    }
  },
});

// ─── Update DICT_Sync_Status sheet ──────────────────────────────────────────
export const updateSyncStatusSheet = internalAction({
  args: {},
  handler: async () => {
    try {
      const result = await callSyncTrigger("syncStatusSheet");
      console.log("[updateSyncStatusSheet]", result.message);
      return result;
    } catch (e) {
      console.error("[updateSyncStatusSheet] Error:", String(e));
      return { ok: false, message: String(e) };
    }
  },
});

// ─── Health check — verify connectivity to all sheets ───────────────────────
export const checkSyncHealth = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const result = await callSyncTrigger("health");
      console.log("[checkSyncHealth]", result.message);
      return result;
    } catch (e) {
      console.error("[checkSyncHealth] Error:", String(e));
      return { ok: false, message: String(e) };
    }
  },
});

// ─── Sync pending activities to project Google Sheets (DICT_Program) ───────
export const syncPendingActivities = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const result = await callSyncTrigger("syncActivities");
      console.log("[syncPendingActivities]", result.message);
      if (result.ok) {
        await ctx.runMutation(internal.syncMonitor.upsertStatus, {
          sheetName: "DICT_Program_Activities",
          sheetId: "auto-sync",
          status: "success",
          recordsSynced: result.synced ?? 0,
        });
      }
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[syncPendingActivities] Error:", msg);
      await ctx.runMutation(internal.syncMonitor.upsertStatus, {
        sheetName: "DICT_Program_Activities",
        sheetId: "auto-sync",
        status: "error",
        lastError: msg.slice(0, 300),
      });
      return { ok: false, message: msg };
    }
  },
});

// ─── Sync interns from Google Sheet → Convex (INTERN sheet) ────────────────
export const syncInternFromSheets = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const result = await callSyncTrigger("syncInterns");
      console.log("[syncInternFromSheets]", result.message);
      if (result.ok) {
        await ctx.runMutation(internal.syncMonitor.upsertStatus, {
          sheetName: "Intern_Sheet",
          sheetId: process.env.INTERN_SHEET_ID ?? "",
          status: "success",
          recordsSynced: result.synced ?? 0,
        });
      }
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[syncInternFromSheets] Error:", msg);
      await ctx.runMutation(internal.syncMonitor.upsertStatus, {
        sheetName: "Intern_Sheet",
        sheetId: process.env.INTERN_SHEET_ID ?? "",
        status: "error",
        lastError: msg.slice(0, 300),
      });
      return { ok: false, message: msg };
    }
  },
});

// ─── Manual trigger (for Convex HTTP action fallback) ───────────────────────
export const manualTrigger = internalAction({
  args: { target: v.string() },
  handler: async (_ctx, args): Promise<{ ok: boolean; message: string; data?: any }> => {
    try {
      const result = await callSyncTrigger(args.target);
      return { ok: result.ok, message: result.message };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
});
