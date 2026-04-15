import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// ============================================================
// GET /api/looker-export
// Returns a CSV file ready for import into Google Looker Studio.
//
// Query params:
//   year     — Filter by fiscal year (e.g. 2025)
//   project  — Filter by project code (e.g. EGOV)
//   month    — Filter by month number (1–12)
//
// Looker Studio Setup:
//   1. Open Looker Studio → Add Data Source → File Upload
//   2. Upload the downloaded CSV, or
//   3. Use Google Sheets: Paste into a Sheet, then connect in Looker Studio
// ============================================================

// Helper to get Convex client (moved from module scope to avoid build-time validation)
function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }
  return new ConvexHttpClient(url);
}

export async function GET(request: NextRequest) {
  try {
    const convex = getConvexClient();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const projectCode = searchParams.get("project");
    const monthParam = searchParams.get("month");

    const year = yearParam ? Number(yearParam) : undefined;
    const month = monthParam ? Number(monthParam) : undefined;

    // Resolve project ID from code if provided
    let projectId: string | undefined;
    if (projectCode) {
      const project = await convex.query(api.projects.getByCode, { code: projectCode });
      projectId = project?._id;
    }

    // Fetch flat export rows from Convex
    const rows = await convex.query(api.activities.lookerExport, {
      projectId: projectId as any,
      year,
      month,
    });

    if (!rows || rows.length === 0) {
      return new NextResponse("No data found for the selected filters.", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Build CSV
    const headers = [
      "record_id", "year", "month", "month_name", "quarter",
      "project_code", "project_name", "project_short_name", "division",
      "province", "province_code", "lgu",
      "activity_title", "venue",
      "start_date", "end_date", "mode_of_conduct",
      "partner_organizations", "personnel", "status",
      "nga_male", "nga_female",
      "lgu_male", "lgu_female",
      "suc_male", "suc_female",
      "others_male", "others_female", "others_label",
      "total_male", "total_female", "total_participants",
      "after_activity_report", "fb_posting_link",
      "raw_photos_link", "testimonials_link",
      "remarks", "imported_from",
    ];

    const escapeCSV = (val: unknown): string => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines = [
      headers.join(","),
      ...rows.map(row =>
        headers.map(h => escapeCSV((row as Record<string, unknown>)[h])).join(",")
      ),
    ];

    const csv = csvLines.join("\r\n");
    const filename = [
      "DICT_R5",
      projectCode ?? "ALL",
      year ?? "ALL",
      "export",
    ].join("_") + ".csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Looker export error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
