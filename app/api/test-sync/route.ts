import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// ============================================================
// Manual Sync Test Endpoint
// POST /api/test-sync
//   { "action": "createSampleDTC" | "stats" }
//
// Creates sample data in Convex and reads stats.
// (Internal actions are triggered via `npx convex run`)
// ============================================================

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    switch (action) {
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

      case "stats": {
        const todayStats = await convex.query(api.auditLog.getTodayStats);
        const syncStatuses = await convex.query(api.syncMonitor.getAll);
        const recent = await convex.query(api.auditLog.getRecentActivity, { limit: 10 });
        return NextResponse.json({
          success: true,
          action: "stats",
          todayStats,
          syncStatuses,
          recentAuditEvents: recent.length,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[test-sync]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
