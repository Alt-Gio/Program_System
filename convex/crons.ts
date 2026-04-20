import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// ============================================================
// Convex Cron Jobs
//
// 1. Sheets → Convex import (existing)
// 2. Convex → Sheets sync for attendance + DTC logs (new)
// 3. Sync status dashboard sheet update (new)
// 4. Health check — verify connectivity to all sheets (new)
//
// Requires service account credentials in Convex env vars:
//   GOOGLE_SERVICE_ACCOUNT_KEY
//   DICT_ATTENDANCE_LOG_SHEET_ID
//   DICT_DTC_LOGBOOK_SHEET_ID
//   DICT_SYNC_STATUS_SHEET_ID
// ============================================================

const crons = cronJobs();

// ── Existing: Import from Google Sheets → Convex (every 15 min) ─────────────
crons.interval(
  "auto-sync-all-sheets",
  { minutes: 15 },
  internal.sheetsActions.syncAllEnabled,
  {}
);

// ── NEW: Sync intern attendance + audit logs → DICT_Attendance_Log (every 5 min)
crons.interval(
  "sync-attendance-to-sheets",
  { minutes: 5 },
  internal.googleSheetsWrite.syncPendingAttendance,
  {}
);

// ── NEW: Sync DTC logs → DICT_DTC_Logbook (every 5 min) ────────────────────
crons.interval(
  "sync-dtc-logs-to-sheets",
  { minutes: 5 },
  internal.googleSheetsWrite.syncPendingDTCLogs,
  {}
);

// ── NEW: Sync activities (Convex → project Google Sheets) every 15 min ──────
crons.interval(
  "sync-activities-to-sheets",
  { minutes: 15 },
  internal.googleSheetsWrite.syncPendingActivities,
  {}
);

// ── NEW: Sync interns (Google Sheets → Convex) every 15 min ─────────────────
crons.interval(
  "sync-interns-from-sheets",
  { minutes: 15 },
  internal.googleSheetsWrite.syncInternFromSheets,
  {}
);

// ── NEW: Update DICT_Sync_Status sheet (every 30 min) ───────────────────────
crons.interval(
  "update-sync-status-sheet",
  { minutes: 30 },
  internal.googleSheetsWrite.updateSyncStatusSheet,
  {}
);

// ── NEW: Health check — verify sheet connectivity (every hour) ──────────────
crons.interval(
  "check-sync-health",
  { hours: 1 },
  internal.googleSheetsWrite.checkSyncHealth,
  {}
);

export default crons;
