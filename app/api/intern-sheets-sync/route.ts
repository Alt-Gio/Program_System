import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { ConvexHttpClient } from "convex/browser";
import { authOptions } from "@/lib/auth";
import { api } from "@/convex/_generated/api";

// ============================================================
// POST /api/intern-sheets-sync
// Reads a Google Sheet with intern data and bulk-upserts
// into Convex via bulkUpsertInternsFromSheets.
//
// Expected body:
//   { sheetId, sheetName? }
//
// Sheet column layout:
//   A(0)  Full Name *
//   B(1)  Email
//   C(2)  Phone
//   D(3)  School *
//   E(4)  Course *
//   F(5)  Department
//   G(6)  Supervisor
//   H(7)  Start Date (YYYY-MM-DD or MM/DD/YYYY) *
//   I(8)  End Date (YYYY-MM-DD or MM/DD/YYYY) *
//   J(9)  Required Hours *
//   K(10) Status (ACTIVE, COMPLETED, INACTIVE, ON_LEAVE)
//   L(11) Notes
// ============================================================

// Helper to get Convex client (moved from module scope to avoid build-time validation)
function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }
  return new ConvexHttpClient(url);
}

function normalizeDate(val: string): string {
  if (!val?.trim()) return "";
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mmddyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, "0")}-${mmddyyyy[2].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function safeInt(v: unknown): number {
  const n = parseInt(String(v ?? "0").replace(/,/g, "").trim());
  return isNaN(n) ? 0 : Math.abs(n);
}

function mapStatus(raw: string): string {
  const map: Record<string, string> = {
    "active": "ACTIVE",
    "completed": "COMPLETED",
    "inactive": "INACTIVE",
    "on leave": "ON_LEAVE",
    "on-leave": "ON_LEAVE",
    "leave": "ON_LEAVE",
  };
  const normalized = raw.toLowerCase().trim();
  return map[normalized] ?? "ACTIVE";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please connect your Google account in Settings." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sheetId, sheetName = "Interns" } = body as {
      sheetId: string;
      sheetName?: string;
    };

    if (!sheetId) {
      return NextResponse.json({ error: "sheetId is required" }, { status: 400 });
    }

    // ── Set up Google Sheets client ──
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });

    // ── Read sheet values (A:L covers all 12 columns) ──
    let rawRows: string[][];
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:L`,
      });
      rawRows = (resp.data.values ?? []) as string[][];
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
        return NextResponse.json(
          { error: "Permission denied. Make sure the sheet is shared with your Google account." },
          { status: 403 }
        );
      }
      if (msg.toLowerCase().includes("unable to parse range") || msg.toLowerCase().includes("parse range")) {
        return NextResponse.json({
          error: `Wrong tab name: the sheet has no tab called "${sheetName}". Check the tab name at the bottom of your Google Sheet.`,
        }, { status: 400 });
      }
      return NextResponse.json({ error: `Google Sheets error: ${msg}` }, { status: 500 });
    }

    if (rawRows.length < 2) {
      return NextResponse.json(
        { error: "Sheet is empty or has only a header row. Add at least one intern data row." },
        { status: 400 }
      );
    }

    // ── Parse rows (row 0 = header, skip) ──
    const parsedRows: any[] = [];
    const parseErrors: string[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 1;

      // Skip entirely empty rows
      if (!row || row.every(c => !c?.trim())) continue;

      // A(0): Full Name — required
      const fullName = (row[0] ?? "").trim();
      if (!fullName) {
        parseErrors.push(`Row ${rowNum}: Full Name (column A) is required.`);
        continue;
      }

      // D(3): School — required
      const school = (row[3] ?? "").trim();
      if (!school) {
        parseErrors.push(`Row ${rowNum}: School (column D) is required.`);
        continue;
      }

      // E(4): Course — required
      const course = (row[4] ?? "").trim();
      if (!course) {
        parseErrors.push(`Row ${rowNum}: Course (column E) is required.`);
        continue;
      }

      // H(7): Start Date — required
      const startDate = normalizeDate(row[7] ?? "");
      if (!startDate) {
        parseErrors.push(`Row ${rowNum}: Start Date (column H) is required.`);
        continue;
      }

      // I(8): End Date — required
      const endDate = normalizeDate(row[8] ?? "");
      if (!endDate) {
        parseErrors.push(`Row ${rowNum}: End Date (column I) is required.`);
        continue;
      }

      // J(9): Required Hours — required
      const requiredHours = safeInt(row[9]);
      if (requiredHours <= 0) {
        parseErrors.push(`Row ${rowNum}: Required Hours (column J) must be a positive number.`);
        continue;
      }

      // K(10): Status
      const rawStatus = (row[10] ?? "ACTIVE").trim();
      const status = mapStatus(rawStatus);

      parsedRows.push({
        fullName,
        email: (row[1] ?? "").trim() || undefined,           // B(1)
        phone: (row[2] ?? "").trim() || undefined,           // C(2)
        school,
        course,
        department: (row[5] ?? "").trim() || undefined,      // F(5)
        supervisor: (row[6] ?? "").trim() || undefined,      // G(6)
        startDate,
        endDate,
        requiredHours,
        status,
        notes: (row[11] ?? "").trim() || undefined,          // L(11)
        sheetsRowNumber: rowNum,
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({
        error: "No valid rows could be parsed.",
        parseErrors,
      }, { status: 400 });
    }

    // ── Call Convex bulk upsert ──
    const convex = getConvexClient();
    const result = await convex.mutation(api.internSheetsSync.bulkUpsertInternsFromSheets, {
      sheetId,
      rows: parsedRows,
      syncedBy: session.user?.email ?? "intern-sheets-sync",
    });

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      parseErrors,
      convexErrors: result.errors,
      totalRows: parsedRows.length,
    });

  } catch (err) {
    console.error("[intern-sheets-sync]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── GET — health check + column reference ──
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "intern-sheets-sync",
    columnFormat: {
      A: "Full Name * (required)",
      B: "Email (recommended for sync)",
      C: "Phone",
      D: "School * (required)",
      E: "Course * (required)",
      F: "Department",
      G: "Supervisor",
      H: "Start Date * (YYYY-MM-DD or MM/DD/YYYY, required)",
      I: "End Date * (YYYY-MM-DD or MM/DD/YYYY, required)",
      J: "Required Hours * (number, required)",
      K: "Status (ACTIVE, COMPLETED, INACTIVE, ON_LEAVE)",
      L: "Notes",
    },
    note: "Email (column B) is used to match existing interns. If email matches, the intern will be updated; otherwise, a new intern will be created.",
  });
}
