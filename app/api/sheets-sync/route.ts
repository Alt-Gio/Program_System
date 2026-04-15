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

    // ── Fetch provinces for ID lookup ──
    const provinces = await convex.query(api.provinces.list, {});
    const provinceById: Record<string, string> = {};
    for (const p of provinces) {
      provinceById[p.name.toLowerCase().trim()] = p._id;
      provinceById[p.code.toLowerCase().trim()]  = p._id;
      provinceById[p.name.toLowerCase().replace(/^camarines /, "cam. ").trim()] = p._id;
    }

    // ── Parse rows (row 0 = header, skip) ──
    const parsedRows: any[] = [];
    const parseErrors: string[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 1;

      // Skip entirely empty rows
      if (!row || row.every(c => !c?.trim())) continue;

      // A(0): Province
      const provinceKey = (row[0] ?? "").trim().toLowerCase();
      const provinceId  = provinceById[provinceKey];
      if (!provinceId) {
        parseErrors.push(`Row ${rowNum}: Unknown province "${row[0] ?? "(empty)"}".`);
        continue;
      }

      // F(5): Activity Title — required
      const activityTitle = (row[5] ?? "").trim();
      if (!activityTitle) {
        parseErrors.push(`Row ${rowNum}: Activity Title (column F) is required.`);
        continue;
      }

      // D(3): Year, E(4): Month
      const year  = safeInt(row[3]) || new Date().getFullYear();
      const month = toMonthNumber(row[4] ?? "");

      // AA(26): Status — map from Apps Script values to web app values
      const rawStatus = (row[26] ?? "").trim();
      const status = rawStatus ? mapStatus(rawStatus) : "Submitted";

      // C(2): Barangay, AB(27): Drive Folder Link — stored in extraFields
      const barangay       = (row[2] ?? "").trim();
      const driveFolderLink = (row[27] ?? "").trim();
      const extraFields = JSON.stringify({
        ...(barangay        ? { barangay }        : {}),
        ...(driveFolderLink ? { driveFolderLink } : {}),
      });

      // AE(30): Image URLs — newline-separated Drive image URLs
      const imageUrlsRaw = (row[30] ?? "").trim();
      const images = imageUrlsRaw
        ? imageUrlsRaw.split('\n')
            .map((url: string) => url.trim())
            .filter(Boolean)
            .map((url: string) => ({
              url,
              uploadedAt: Date.now(),
            }))
        : undefined;

      parsedRows.push({
        provinceId,
        month:  Math.min(12, Math.max(1, month)),
        year,
        activityTitle,
        venue:                (row[6]  ?? "").trim() || "TBD",       // G(6)
        partnerOrganizations: (row[7]  ?? "").split(/[,;]/).map((s: string) => s.trim()).filter(Boolean), // H(7)
        startDate:            normalizeDate(row[8]  ?? ""),           // I(8)
        endDate:              normalizeDate(row[9]  ?? row[8] ?? ""), // J(9)
        modeOfConduct:        (row[10] ?? "Face-to-Face").trim(),     // K(10)
        personnelRaw:         (row[11] ?? "").trim() || undefined,    // L(11)
        participants: {
          nga:    { male: safeInt(row[12]), female: safeInt(row[13]) }, // M(12), N(13)
          lgu:    { male: safeInt(row[14]), female: safeInt(row[15]) }, // O(14), P(15)
          suc:    { male: safeInt(row[16]), female: safeInt(row[17]) }, // Q(16), R(17)
          others: {
            male:   safeInt(row[18]),                                  // S(18)
            female: safeInt(row[19]),                                  // T(19)
            label:  (row[20] ?? "").trim() || undefined,               // U(20)
          },
        },
        afterActivityReport: (row[21] ?? "").trim() || undefined,    // V(21)
        fbPostingLink:       (row[22] ?? "").trim() || undefined,    // W(22)
        rawPhotosLink:       (row[23] ?? "").trim() || undefined,    // X(23)
        testimonialsLink:    (row[24] ?? "").trim() || undefined,    // Y(24)
        remarks:             (row[25] ?? "").trim() || undefined,    // Z(25)
        status,
        images,                                                       // AE(30)
        extraFields: extraFields !== "{}" ? extraFields : undefined,
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
    const convex = getConvexClient();
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
