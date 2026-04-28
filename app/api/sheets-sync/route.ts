export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { ConvexHttpClient } from "convex/browser";
import { authOptions } from "@/lib/auth";
import { api } from "@/convex/_generated/api";

// ============================================================
// POST /api/sheets-sync
// Reads a connected Google Sheet and bulk-upserts its rows
// into Convex via bulkUpsertFromSheets.
//
// Expected body:
//   { projectId, sheetId, sheetName? }
//
// Sheet column layout (matches the Apps Script column map):
//   A(0)  Province          — e.g. "Albay", "CAS"
//   B(1)  LGU               — municipality name
//   C(2)  Barangay          — stored in extraFields
//   D(3)  Year              — e.g. 2025
//   E(4)  Month             — name ("January") or number (1-12)
//   F(5)  Activity Title
//   G(6)  Venue
//   H(7)  Partner Organizations — comma or semicolon-separated
//   I(8)  Start Date        — MM/DD/YYYY or YYYY-MM-DD
//   J(9)  End Date
//   K(10) Mode of Conduct   — Face-to-Face / Online / Hybrid
//   L(11) Personnel         — comma or semicolon-separated
//   M(12) NGA Male
//   N(13) NGA Female
//   O(14) LGU Male
//   P(15) LGU Female
//   Q(16) SUC Male
//   R(17) SUC Female
//   S(18) Others Male
//   T(19) Others Female
//   U(20) Others Label
//   V(21) After Activity Report
//   W(22) FB Posting Link
//   X(23) Raw Photos Link
//   Y(24) Testimonials Link
//   Z(25) Remarks
//   AA(26) Status           — mapped to Draft/Submitted/Validated/Reported
//   AB(27) Drive Folder Link — stored in extraFields
//   AC(28) Total PAX        — formula column, ignored
//   AD(29) Last Updated     — auto-timestamp, ignored
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

function toMonthNumber(val: string): number {
  const n = parseInt(val);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  const map: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
    sep: 9, oct: 10, nov: 11, dec: 12,
  };
  return map[val.toLowerCase().trim()] ?? (new Date().getMonth() + 1);
}

// Maps Apps Script status values to the web app's status vocabulary
function mapStatus(raw: string): string {
  const map: Record<string, string> = {
    "completed":      "Reported",
    "ongoing":        "Submitted",
    "for submission": "Submitted",
    "pending":        "Draft",
    "cancelled":      "Draft",
    // Pass through values that already match
    "draft":      "Draft",
    "submitted":  "Submitted",
    "validated":  "Validated",
    "reported":   "Reported",
  };
  return map[raw.toLowerCase().trim()] ?? "Submitted";
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
    const { projectId, sheetId, sheetName = "Activities" } = body as {
      projectId: string;
      sheetId: string;
      sheetName?: string;
    };

    if (!projectId || !sheetId) {
      return NextResponse.json({ error: "projectId and sheetId are required" }, { status: 400 });
    }

    // ── Set up Google Sheets client ──
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });

    // ── Read sheet values (A:AD covers all 30 columns) ──
    let rawRows: string[][];
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:AD`,
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
          error: `Wrong tab name: the sheet has no tab called "${sheetName}". Go to Settings → expand the program → click "Change Tab" → Detect to see the actual tab names.`,
        }, { status: 400 });
      }
      return NextResponse.json({ error: `Google Sheets error: ${msg}` }, { status: 500 });
    }

    if (rawRows.length < 2) {
      return NextResponse.json(
        { error: "Sheet is empty or has only a header row. Add at least one data row." },
        { status: 400 }
      );
    }

    // ── Init Convex client (must be before any .query/.mutation calls) ──
    const convex = getConvexClient();

    // ── Fetch provinces for ID lookup ──
    const provinces = await convex.query(api.provinces.list, {});
    const provinceById: Record<string, string> = {};
    for (const p of provinces) {
      provinceById[p.name.toLowerCase().trim()] = p._id;
      provinceById[p.code.toLowerCase().trim()]  = p._id;
      provinceById[p.name.toLowerCase().replace(/^camarines /, "cam. ").trim()] = p._id;
    }

    // ── Header-based column map (same aliases as activity-to-sheet) ──
    // Column ORDER in the sheet no longer matters.
    const headerRow = ((rawRows[0] ?? []) as string[]).map((h: string) => h.trim());
    const headerIndex: Record<string, number> = {};
    headerRow.forEach((h, i) => { if (h) headerIndex[h] = i; });

    const colIdx = (aliases: string[]): number => {
      for (const a of aliases) { if (headerIndex[a] !== undefined) return headerIndex[a]; }
      return -1;
    };

    // Pre-compute field→column-index using STANDARD_ALIASES
    const COL = {
      province:    colIdx(["Province"]),
      lgu:         colIdx(["LGU/Municipality Name","LGU","Municipality","LGU Name"]),
      barangay:    colIdx(["Barangay","Brgy","Barangay/Sitio"]),
      year:        colIdx(["Year"]),
      month:       colIdx(["Month","Month (Do not Edit)","Month Name"]),
      title:       colIdx(["Activity Title","Title","Activity Name"]),
      venue:       colIdx(["Venue","Location"]),
      partners:    colIdx(["Name of Partner","Name of Partner (LGU/NGA/Private)","Partner Organizations","Partners"]),
      startDate:   colIdx(["Start Date","Start Date 1/1/2025","Date Start"]),
      endDate:     colIdx(["End Date","End Date 1/1/2025","Date End"]),
      mode:        colIdx(["Mode of Conduct","Mode","Conduct Mode"]),
      personnel:   colIdx(["DICT Personnel Involve","Personnel","DICT Personnel","Personnel Involved"]),
      ngaM:        colIdx(["NGA Male","NGA M"]),
      ngaF:        colIdx(["NGA Female","NGA F"]),
      lguM:        colIdx(["LGU Male","LGU M"]),
      lguF:        colIdx(["LGU Female","LGU F"]),
      sucM:        colIdx(["SUC Male","SUC M"]),
      sucF:        colIdx(["SUC Female","SUC F"]),
      othM:        colIdx(["Others Male","Other Male"]),
      othF:        colIdx(["Others Female","Other Female"]),
      othLbl:      colIdx(["Others Label","Other Category"]),
      aar:         colIdx(["After Activity Report","AAR"]),
      fb:          colIdx(["FB Posting Link","Facebook Link","FB Link"]),
      photos:      colIdx(["Raw Photos Link","Photos","Photos Link","Raw Photos"]),
      testimonials:colIdx(["Testimonials Link","Testimonials"]),
      drive:       colIdx(["Drive Folder Link","Drive Link","Google Drive Link"]),
      remarks:     colIdx(["Remarks","Notes"]),
      status:      colIdx(["Status","Status (Don't Edit)","Status (Do not Edit)"]),
    };

    const r = (row: string[], idx: number): string =>
      idx >= 0 ? (row[idx] ?? "").trim() : "";

    // ── Parse rows (row 0 = header, skip) ──
    const parsedRows: any[] = [];
    const parseErrors: string[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 1;

      if (!row || row.every((c: string) => !c?.trim())) continue;

      const provinceKey = r(row, COL.province).toLowerCase();
      const provinceId  = provinceById[provinceKey];
      if (!provinceId) {
        parseErrors.push(`Row ${rowNum}: Unknown province "${r(row, COL.province) || "(empty)"}".`);
        continue;
      }

      const activityTitle = r(row, COL.title);
      if (!activityTitle) {
        parseErrors.push(`Row ${rowNum}: Activity Title is required.`);
        continue;
      }

      const year      = safeInt(r(row, COL.year)) || new Date().getFullYear();
      const month     = toMonthNumber(r(row, COL.month));
      const rawStatus = r(row, COL.status);
      const status    = rawStatus ? mapStatus(rawStatus) : "Submitted";
      const startDate = normalizeDate(r(row, COL.startDate));

      const barangay        = r(row, COL.barangay);
      const driveFolderLink = r(row, COL.drive);
      const extraFieldsObj: Record<string, string> = {};
      if (barangay)        extraFieldsObj.barangay        = barangay;
      if (driveFolderLink) extraFieldsObj.driveFolderLink = driveFolderLink;

      parsedRows.push({
        provinceId,
        month:  Math.min(12, Math.max(1, month)),
        year,
        activityTitle,
        venue:                r(row, COL.venue) || "TBD",
        partnerOrganizations: r(row, COL.partners).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean),
        startDate,
        endDate:              normalizeDate(r(row, COL.endDate)) || startDate,
        modeOfConduct:        r(row, COL.mode) || "Face-to-Face",
        personnelRaw:         r(row, COL.personnel) || undefined,
        participants: {
          nga:    { male: safeInt(r(row, COL.ngaM)), female: safeInt(r(row, COL.ngaF)) },
          lgu:    { male: safeInt(r(row, COL.lguM)), female: safeInt(r(row, COL.lguF)) },
          suc:    { male: safeInt(r(row, COL.sucM)), female: safeInt(r(row, COL.sucF)) },
          others: { male: safeInt(r(row, COL.othM)), female: safeInt(r(row, COL.othF)),
                    label: r(row, COL.othLbl) || undefined },
        },
        afterActivityReport: r(row, COL.aar)          || undefined,
        fbPostingLink:       r(row, COL.fb)           || undefined,
        rawPhotosLink:       r(row, COL.photos)       || undefined,
        testimonialsLink:    r(row, COL.testimonials) || undefined,
        remarks:             r(row, COL.remarks)      || undefined,
        status,
        extraFields: Object.keys(extraFieldsObj).length > 0 ? JSON.stringify(extraFieldsObj) : undefined,
        sheetRowNumber: rowNum,
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({
        error: "No valid rows could be parsed.",
        parseErrors,
      }, { status: 400 });
    }

    // ── Call Convex bulk upsert ──
    const result = await convex.mutation(api.sheetsSync.bulkUpsertFromSheets, {
      projectId: projectId as any,
      sheetId,
      rows: parsedRows,
      syncedBy: session.user?.email ?? "sheets-sync",
    });

    return NextResponse.json({
      success: true,
      inserted:    result.inserted,
      updated:     result.updated,
      parseErrors,
      convexErrors: result.errors,
      totalRows:    parsedRows.length,
    });

  } catch (err) {
    console.error("[sheets-sync]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── GET — health check + column reference ──
export async function GET() {
  return NextResponse.json({
    status: "ok",
    columnFormat: {
      A: "Province (exact name or code, e.g. Albay, CAS)",
      B: "LGU / Municipality",
      C: "Barangay",
      D: "Year (e.g. 2025)",
      E: "Month (name: January, or number: 1-12)",
      F: "Activity Title *",
      G: "Venue",
      H: "Partner Organizations (comma or semicolon-separated)",
      I: "Start Date (MM/DD/YYYY)",
      J: "End Date (MM/DD/YYYY)",
      K: "Mode of Conduct (Face-to-Face / Online / Hybrid)",
      L: "Personnel (comma or semicolon-separated names)",
      M: "NGA Male",
      N: "NGA Female",
      O: "LGU Male",
      P: "LGU Female",
      Q: "SUC Male",
      R: "SUC Female",
      S: "Others Male",
      T: "Others Female",
      U: "Others Label",
      V: "After Activity Report URL",
      W: "FB Posting Link",
      X: "Raw Photos Link",
      Y: "Testimonials Link",
      Z: "Remarks",
      AA: "Status (Completed→Reported, Ongoing/For Submission→Submitted, Pending/Cancelled→Draft)",
      AB: "Drive Folder Link",
      AC: "Total PAX (formula — ignored)",
      AD: "Last Updated (auto — ignored)",
      AE: "Image URLs (newline-separated Drive image URLs)",
    },
  });
}
