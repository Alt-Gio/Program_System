export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { google } from "googleapis";

// ============================================================
// POST /api/export-to-sheets
// Exports data directly to the DICT_Results Google Sheet
//
// Query params:
//   year     — Filter by fiscal year (e.g. 2025)
//   project  — Filter by project code (e.g. EGOV)
//   month    — Filter by month number (1–12)
//
// This endpoint updates the existing "DICT_Results" spreadsheet
// instead of creating a new one, making it perfect for:
// - Looker Studio dashboards (stable data source)
// - Google Apps Script automation
// - Scheduled data refreshes
// ============================================================

// Helper to get Convex client (moved from module scope to avoid build-time validation)
function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
  try {
    const convex = getConvexClient();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const projectCode = searchParams.get("project");
    const monthParam = searchParams.get("month");

    const year = yearParam ? Number(yearParam) : undefined;
    const month = monthParam ? Number(monthParam) : undefined;

    // Get the target spreadsheet ID from environment
    const targetSpreadsheetId = process.env.GOOGLE_SHEETS_TARGET_ID;
    
    if (!targetSpreadsheetId) {
      return NextResponse.json(
        { 
          error: "Target spreadsheet not configured. Please set GOOGLE_SHEETS_TARGET_ID in .env.local",
          hint: "Get the ID from your Google Sheets URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit"
        },
        { status: 500 }
      );
    }

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
      return NextResponse.json(
        { error: "No data found for the selected filters." },
        { status: 404 }
      );
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Prepare data for sheets
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

    const values = [
      headers,
      ...rows.map(row =>
        headers.map(h => (row as Record<string, unknown>)[h] ?? "")
      ),
    ];

    // Determine the sheet name based on filters
    let sheetName = "Activity Data";
    if (projectCode && year) {
      sheetName = `${projectCode}_${year}`;
    } else if (projectCode) {
      sheetName = projectCode;
    } else if (year) {
      sheetName = `FY_${year}`;
    }

    // Check if the sheet exists, create if it doesn't
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: targetSpreadsheetId,
      });

      const existingSheet = spreadsheet.data.sheets?.find(
        s => s.properties?.title === sheetName
      );

      if (!existingSheet) {
        // Create new sheet with the name
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: targetSpreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        });
      } else {
        // Clear existing data in the sheet
        await sheets.spreadsheets.values.clear({
          spreadsheetId: targetSpreadsheetId,
          range: `${sheetName}!A:AZ`,
        });
      }
    } catch (error) {
      console.error("Error checking/creating sheet:", error);
      return NextResponse.json(
        { 
          error: "Failed to access the target spreadsheet. Make sure the service account has edit access.",
          details: error instanceof Error ? error.message : "Unknown error",
          hint: "Share the DICT_Results spreadsheet with: " + process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        },
        { status: 500 }
      );
    }

    // Write data to the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    // Get the sheet ID for formatting
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: targetSpreadsheetId,
    });
    const sheet = spreadsheet.data.sheets?.find(
      s => s.properties?.title === sheetName
    );
    const sheetId = sheet?.properties?.sheetId ?? 0;

    // Format the header row and auto-resize columns
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: targetSpreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                  },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headers.length,
              },
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      },
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit#gid=${sheetId}`;

    // Add metadata about the export
    const timestamp = new Date().toISOString();
    const filterInfo = [
      year ? `Year: ${year}` : null,
      projectCode ? `Project: ${projectCode}` : null,
      month ? `Month: ${month}` : null,
    ].filter(Boolean).join(", ") || "All data";

    return NextResponse.json({
      success: true,
      sheetUrl,
      sheetId: targetSpreadsheetId,
      sheetName,
      rowCount: rows.length,
      timestamp,
      filters: filterInfo,
      message: `Successfully exported ${rows.length} records to DICT_Results spreadsheet!`,
    });
  } catch (err) {
    console.error("Google Sheets export error:", err);
    return NextResponse.json(
      { 
        error: "Export failed",
        details: err instanceof Error ? err.message : String(err),
        hint: "Check that GOOGLE_SHEETS_TARGET_ID is set correctly and the service account has access to the spreadsheet"
      },
      { status: 500 }
    );
  }
}
