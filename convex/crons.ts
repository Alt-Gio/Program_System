import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// ============================================================
// Convex Cron Jobs
// Auto-sync all enabled Google Sheet connections every 6 hours.
// Requires service account credentials in Convex env vars:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_SERVICE_ACCOUNT_KEY
// See convex/sheetsActions.ts for details.
// ============================================================

const crons = cronJobs();

crons.interval(
  "auto-sync-all-sheets",
  { minutes: 15 },
  internal.sheetsActions.syncAllEnabled,
  {}
);

export default crons;
