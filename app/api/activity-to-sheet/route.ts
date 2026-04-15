import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";
import { DICT_PROJECTS } from "@/lib/types";

// ============================================================
// POST /api/activity-to-sheet
// Appends a single new activity row to the project's
// connected Google Sheet, using the project's sheetsColumnMap
// to correctly place values into the right columns.
// ============================================================

const MONTHS_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Standard column aliases ────────────────────────────────────────────────────
// Maps our fieldKey → possible header names in any project sheet.
// This is used as a FALLBACK when the project's sheetsColumnMap doesn't cover a field.
const STANDARD_ALIASES: Record<string, string[]> = {
  province:            ["Province"],
  lgu:                 ["LGU/Municipality Name", "LGU", "Municipality", "LGU Name"],
  barangay:            ["Barangay", "Brgy", "Barangay/Sitio"],
  year:                ["Year"],
  month:               ["Month", "Month (Do not Edit)", "Month Name"],
  activityTitle:       ["Activity Title", "Title", "Activity Name"],
  venue:               ["Venue", "Location"],
  partnerOrganizations:["Name of Partner", "Name of Partner (LGU/NGA/Private)", "Partner Organizations", "Partners"],
  startDate:           ["Start Date", "Start Date 1/1/2025", "Date Start"],
  endDate:             ["End Date", "End Date 1/1/2025", "Date End"],
  modeOfConduct:       ["Mode of Conduct", "Mode", "Conduct Mode"],
  personnelRaw:        ["DICT Personnel Involve", "Personnel", "DICT Personnel", "Personnel Involved"],
  ngaMale:             ["NGA Male", "NGA M"],
  ngaFemale:           ["NGA Female", "NGA F"],
  lguMale:             ["LGU Male", "LGU M"],
  lguFemale:           ["LGU Female", "LGU F"],
  sucMale:             ["SUC Male", "SUC M"],
  sucFemale:           ["SUC Female", "SUC F"],
  othersMale:          ["Others Male", "Other Male"],
  othersFemale:        ["Others Female", "Other Female"],
  othersLabel:         ["Others Label", "Other Category"],
  totalParticipants:   ["Total PAX", "Total Participants", "Total"],
  status:              ["Status", "Status (Don't Edit)", "Status (Do not Edit)"],
  afterActivityReport: ["After Activity Report", "AAR"],
  fbPostingLink:       ["FB Posting Link", "Facebook Link", "FB Link"],
  rawPhotosLink:       ["Raw Photos Link", "Photos", "Photos Link", "Raw Photos"],
  testimonialsLink:    ["Testimonials Link", "Testimonials"],
  driveFolderLink:     ["Drive Folder Link", "Drive Link", "Google Drive Link"],
  remarks:             ["Remarks", "Notes"],
  lastUpdated:         ["Last Updated", "Date Updated"],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectCode,
      sheetId,
      sheetName,
      activity,
    } = body as {
      projectCode: string;
      sheetId: string;
      sheetName: string;
      activity: {
        month: number;
        year: number;
        provinceName: string;
        lguName?: string;
        barangay?: string;
        activityTitle: string;
        venue: string;
        partnerOrganizations: string[];
        startDate: string;
        endDate: string;
        modeOfConduct: string;
        personnelRaw?: string;
        status: string;
        remarks?: string;
        afterActivityReport?: string;
        fbPostingLink?: string;
        rawPhotosLink?: string;
        imageUrl?: string;
        testimonialsLink?: string;
        driveFolderLink?: string;
        extraFields?: Record<string, string | number>;
        participants: {
          nga: { male: number; female: number };
          lgu: { male: number; female: number };
          suc: { male: number; female: number };
          others: { male: number; female: number; label?: string };
        };
      };
    };

    if (!projectCode || !sheetId || !activity) {
      return NextResponse.json({ error: "projectCode, sheetId, and activity are required" }, { status: 400 });
    }

    const projectDef = DICT_PROJECTS.find(p => p.code === projectCode.toUpperCase());
    if (!projectDef) {
      return NextResponse.json({ error: `Unknown project code: ${projectCode}` }, { status: 400 });
    }

    // ── Authenticate: try OAuth2 session first, fall back to service account ──
    let sheets: ReturnType<typeof google.sheets>;

    const session = await getServerSession(authOptions);

    if (session?.accessToken) {
      // Use the user's OAuth2 token — same access as sheets-sync
      const oAuth2 = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      oAuth2.setCredentials({ access_token: session.accessToken as string });
      sheets = google.sheets({ version: "v4", auth: oAuth2 });
    } else if (
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ) {
      // Fall back to service account (only works if sheet is shared with it)
      const saAuth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      sheets = google.sheets({ version: "v4", auth: saAuth });
    } else {
      return NextResponse.json({
        error: "Not authenticated with Google. Please sign in with Google to sync to Sheets.",
      }, { status: 401 });
    }

    // ── Read header row to find column positions ──
    let headerRow: string[];
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!1:1`,
      });
      headerRow = ((resp.data.values?.[0] ?? []) as string[]).map((h: string) => h.trim());
    } catch (err: any) {
      const msg = (err?.message ?? String(err)).toLowerCase();
      if (msg.includes("403") || msg.includes("permission_denied") || msg.includes("forbidden")) {
        return NextResponse.json({
          error: "Permission denied. Make sure the Google Sheet is shared with your Google account (Editor access).",
        }, { status: 403 });
      }
      if (msg.includes("parse range") || msg.includes("unable to parse")) {
        return NextResponse.json({
          error: `Tab not found: the sheet has no tab called "${sheetName}". Check Settings → program connection.`,
        }, { status: 400 });
      }
      return NextResponse.json({
        error: `Could not read sheet headers: ${err?.message ?? String(err)}`,
      }, { status: 500 });
    }

    if (headerRow.length === 0) {
      return NextResponse.json({
        error: "Sheet has no header row. Please set up the sheet with headers first.",
      }, { status: 400 });
    }

    // ── Build column-index map from header names ──
    const headerIndexMap: Record<string, number> = {};
    for (let i = 0; i < headerRow.length; i++) {
      headerIndexMap[headerRow[i]] = i;
    }

    // ── Build flat field → value map ──
    const totalPax =
      activity.participants.nga.male + activity.participants.nga.female +
      activity.participants.lgu.male + activity.participants.lgu.female +
      activity.participants.suc.male + activity.participants.suc.female +
      activity.participants.others.male + activity.participants.others.female;

    // For the photo column: if an imageUrl exists, use =IMAGE(url) so it renders inline
    const photoValue = activity.imageUrl
      ? `=IMAGE("${activity.imageUrl}")`
      : (activity.rawPhotosLink ?? "");

    const now = new Date();
    const lastUpdatedStr = `${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

    const fieldToValue: Record<string, string> = {
      month:               MONTHS_NAMES[(activity.month ?? 1) - 1],
      year:                String(activity.year ?? new Date().getFullYear()),
      province:            activity.provinceName ?? "",
      lgu:                 activity.lguName ?? "",
      barangay:            activity.barangay ?? "",
      activityTitle:       activity.activityTitle ?? "",
      venue:               activity.venue ?? "",
      partnerOrganizations: activity.partnerOrganizations.join(", "),
      startDate:           activity.startDate ?? "",
      endDate:             activity.endDate ?? "",
      modeOfConduct:       activity.modeOfConduct ?? "",
      personnelRaw:        activity.personnelRaw ?? "",
      status:              activity.status ?? "Draft",
      remarks:             activity.remarks ?? "",
      afterActivityReport: activity.afterActivityReport ?? "",
      fbPostingLink:       activity.fbPostingLink ?? "",
      rawPhotosLink:       photoValue,
      testimonialsLink:    activity.testimonialsLink ?? "",
      driveFolderLink:     activity.driveFolderLink ?? "",
      // Participant breakdown
      ngaMale:             String(activity.participants.nga.male),
      ngaFemale:           String(activity.participants.nga.female),
      lguMale:             String(activity.participants.lgu.male),
      lguFemale:           String(activity.participants.lgu.female),
      sucMale:             String(activity.participants.suc.male),
      sucFemale:           String(activity.participants.suc.female),
      othersMale:          String(activity.participants.others.male),
      othersFemale:        String(activity.participants.others.female),
      othersLabel:         activity.participants.others.label ?? "",
      totalParticipants:   String(totalPax),
      lastUpdated:         lastUpdatedStr,
    };

    // ── Merge extra fields ──
    if (activity.extraFields) {
      for (const [key, val] of Object.entries(activity.extraFields)) {
        fieldToValue[key] = String(val ?? "");
      }
    }

    // ── Build the row array ──
    // Step 1: project-specific sheetsColumnMap (exact priority)
    // Step 2: STANDARD_ALIASES fallback for every other field
    const rowLength = Math.max(headerRow.length, 1);
    const rowData = new Array(rowLength).fill("");
    const filledByProject = new Set<string>();

    const colMap = projectDef.sheetsColumnMap;
    for (const [fieldKey, colHeader] of Object.entries(colMap)) {
      const colIdx = headerIndexMap[colHeader as string];
      if (colIdx !== undefined && fieldToValue[fieldKey] !== undefined) {
        rowData[colIdx] = fieldToValue[fieldKey];
        filledByProject.add(fieldKey);
      }
    }

    // Standard aliases fallback — fills columns not covered by sheetsColumnMap
    for (const [fieldKey, aliases] of Object.entries(STANDARD_ALIASES)) {
      if (filledByProject.has(fieldKey)) continue;
      if (fieldToValue[fieldKey] === undefined || fieldToValue[fieldKey] === "") continue;
      for (const alias of aliases) {
        const colIdx = headerIndexMap[alias];
        if (colIdx !== undefined) {
          rowData[colIdx] = fieldToValue[fieldKey];
          break;
        }
      }
    }

    // ── Append the row to the sheet ──
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowData] },
    });

    return NextResponse.json({
      success: true,
      message: `Activity "${activity.activityTitle}" appended to sheet "${sheetName}".`,
      rowData,
    });

  } catch (err) {
    console.error("[activity-to-sheet]", err);
    return NextResponse.json({
      error: "Failed to append to sheet",
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
