export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// ============================================================
// Comprehensive Sync Test Endpoint
// POST /api/test-sync
//   { "action": "createSampleDTC" | "createSampleActivity" |
//               "testInternSync" | "triggerActivitySync" |
//               "triggerInternSync" | "triggerAll" | "stats" }
//
// Tests the full sync pipeline for all sheet types:
//   - DTC Logbook
//   - DICT_Program (activities + images)
//   - Intern Sheet
// ============================================================

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function getSyncTriggerUrl(): string {
  return process.env.SHEETS_WRITE_PROXY_URL || "http://127.0.0.1:3000/api/sync-trigger";
}

async function callSyncTrigger(target: string): Promise<any> {
  const resp = await fetch(getSyncTriggerUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  return resp.json();
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    switch (action) {
      // ─── Create a sample DTC log to test DTC sync pipeline ──
      case "createSampleDTC": {
        const result = await convex.mutation(api.dtcLogs.create, {
          fullName: "Test User (Sync Demo)",
          agency: "DICT Region V",
          purpose: "Testing Google Sheets sync pipeline",
          equipmentUsed: ["PC", "Internet"],
          plannedDurationHours: 1,
          serviceType: "Internet Access",
        });
        return NextResponse.json({
          success: true,
          action: "createSampleDTC",
          result,
          message: "DTC log created with syncedToSheets=false. Cron will push to Sheets in ~5 min.",
        });
      }

      // ─── Create a sample activity to test DICT_Program sync ─
      case "createSampleActivity": {
        // Get first project and province for sample data
        const projects = await convex.query(api.projects.list, {});
        const provinces = await convex.query(api.provinces.list, {});

        if (projects.length === 0 || provinces.length === 0) {
          return NextResponse.json({
            success: false,
            error: "No projects or provinces found. Seed the database first.",
          }, { status: 400 });
        }

        const project = projects[0];
        const province = provinces[0];
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);

        const activityId = await convex.mutation(api.activities.createActivity, {
          projectId: project._id,
          provinceId: province._id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          activityTitle: `Test Activity (Auto-Sync Demo) - ${dateStr}`,
          venue: "DICT Region V Office",
          partnerOrganizations: ["Test Partner Org"],
          startDate: dateStr,
          endDate: dateStr,
          modeOfConduct: "Face-to-Face",
          personnelIds: [],
          personnelRaw: "Test Personnel",
          participants: {
            nga: { male: 5, female: 3 },
            lgu: { male: 2, female: 4 },
            suc: { male: 1, female: 1 },
            others: { male: 0, female: 0 },
          },
          remarks: "Auto-created by test-sync for sync pipeline verification",
          createdBy: "test-sync",
        });

        return NextResponse.json({
          success: true,
          action: "createSampleActivity",
          activityId,
          projectCode: project.code,
          provinceName: province.name,
          message: `Activity created (syncedToSheets=false). Cron will push to project sheet in ~15 min, or use triggerActivitySync to push now.`,
        });
      }

      // ─── Manually trigger activity → sheets sync ────────────
      case "triggerActivitySync": {
        const result = await callSyncTrigger("syncActivities");
        return NextResponse.json({
          success: result.ok,
          action: "triggerActivitySync",
          ...result,
        });
      }

      // ─── Manually trigger intern sheets → Convex sync ───────
      case "triggerInternSync": {
        const result = await callSyncTrigger("syncInterns");
        return NextResponse.json({
          success: result.ok,
          action: "triggerInternSync",
          ...result,
        });
      }

      // ─── Test intern sync: verify data is in the right places
      case "testInternSync": {
        // Check intern sheet connection
        const internConn = await convex.query(api.internSheetsSync.getInternConnection, {});

        // Get intern count and recent sync logs
        const interns = await convex.query(api.interns.list, {});
        const syncLogs = await convex.query(api.internSheetsSync.getInternSyncLog, { limit: 5 });

        // Check intern sheet mapping
        const pendingCounts = await convex.query(api.attendanceSync.countPendingPublic, {});

        return NextResponse.json({
          success: true,
          action: "testInternSync",
          internConnection: internConn ? {
            sheetId: internConn.sheetId,
            syncEnabled: internConn.syncEnabled,
            lastSyncAt: internConn.lastSyncAt ? new Date(internConn.lastSyncAt).toISOString() : "Never",
            lastSyncStatus: internConn.lastSyncStatus ?? "unknown",
            lastSyncRowCount: internConn.lastSyncRowCount ?? 0,
          } : "NOT_CONFIGURED",
          internCount: interns.length,
          sampleInterns: interns.slice(0, 3).map((i: any) => ({
            name: i.fullName,
            school: i.school,
            status: i.status,
            totalHours: i.totalHours,
          })),
          recentSyncLogs: syncLogs.map((l: any) => ({
            direction: l.syncDirection,
            status: l.status,
            rowsAffected: l.rowsAffected,
            syncedAt: new Date(l.syncedAt).toISOString(),
            syncedBy: l.syncedBy,
          })),
          pendingSync: pendingCounts,
        });
      }

      // ─── Trigger all syncs at once ──────────────────────────
      case "triggerAll": {
        const result = await callSyncTrigger("syncAll");
        return NextResponse.json({
          success: result.ok,
          action: "triggerAll",
          ...result,
        });
      }

      // ─── Comprehensive stats across all sync types ──────────
      case "stats": {
        const todayStats = await convex.query(api.auditLog.getTodayStats);
        const syncStatuses = await convex.query(api.syncMonitor.getAll);
        const recent = await convex.query(api.auditLog.getRecentActivity, { limit: 10 });
        const pendingCounts = await convex.query(api.attendanceSync.countPendingPublic, {});

        // Activity sync status
        const unsyncedActivities = await convex.query(api.attendanceSync.getUnsyncedActivitiesPublic, { limit: 5 });

        // Intern connection status
        const internConn = await convex.query(api.internSheetsSync.getInternConnection, {});

        return NextResponse.json({
          success: true,
          action: "stats",
          todayStats,
          pendingSync: pendingCounts,
          syncStatuses: syncStatuses.map((s: any) => ({
            sheet: s.sheetName,
            status: s.status,
            lastSync: s.lastSyncTime ? new Date(s.lastSyncTime).toISOString() : "Never",
            recordsSynced: s.recordsSynced ?? 0,
            lastError: s.lastError,
          })),
          unsyncedActivities: {
            count: unsyncedActivities.length,
            sample: unsyncedActivities.slice(0, 3).map((a: any) => ({
              title: a.activityTitle,
              project: a.projectCode,
              sheetConnected: !!a.sheetId,
            })),
          },
          internConnection: internConn ? {
            syncEnabled: internConn.syncEnabled,
            lastSync: internConn.lastSyncAt ? new Date(internConn.lastSyncAt).toISOString() : "Never",
            status: internConn.lastSyncStatus ?? "unknown",
          } : "NOT_CONFIGURED",
          recentAuditEvents: recent.length,
          cronSchedule: {
            "sync-attendance-to-sheets": "every 5 min",
            "sync-dtc-logs-to-sheets": "every 5 min",
            "sync-activities-to-sheets": "every 15 min",
            "sync-interns-from-sheets": "every 15 min",
            "auto-sync-all-sheets": "every 15 min (Sheets → Convex)",
            "update-sync-status-sheet": "every 30 min",
            "check-sync-health": "every 1 hour",
          },
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            availableActions: [
              "createSampleDTC",
              "createSampleActivity",
              "triggerActivitySync",
              "triggerInternSync",
              "testInternSync",
              "triggerAll",
              "stats",
            ],
          },
          { status: 400 }
        );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[test-sync]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── GET — health check + available actions ──
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "test-sync",
    availableActions: [
      "createSampleDTC — Creates a test DTC log entry (syncs to DICT_DTC_Logbook in ~5 min)",
      "createSampleActivity — Creates a test activity (syncs to DICT_Program sheet in ~15 min)",
      "triggerActivitySync — Immediately push unsynced activities to project sheets",
      "triggerInternSync — Immediately pull intern data from INTERN sheet into Convex",
      "testInternSync — Verify intern data is correctly placed in Convex",
      "triggerAll — Run all sync operations at once",
      "stats — Comprehensive sync status across all sheet types",
    ],
    cronSchedule: {
      "DTC Logs → Sheets": "every 5 min",
      "Attendance → Sheets": "every 5 min",
      "Activities → Project Sheets": "every 15 min",
      "Intern Sheet → Convex": "every 15 min",
      "All Sheets → Convex (import)": "every 15 min",
      "Sync Status Sheet": "every 30 min",
      "Health Check": "every 1 hour",
    },
  });
}
