import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createSign } from "crypto";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================
// Sync Trigger API — runs in Next.js Node.js runtime
// Handles: health, syncDTC, syncAttendance, syncActivities,
//          syncInterns, syncStatusSheet, setupTabs, syncAll
// No Convex "use node" needed — JWT signing runs natively here.
//
// POST /api/sync-trigger  { target: string }
// ============================================================

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ── All Google Sheet IDs ────────────────────────────────────────────────────
const SHEET_IDS = {
  attendance:
    process.env.DICT_ATTENDANCE_LOG_SHEET_ID ||
    process.env.ATTENDANCE_LOG_SHEET_ID ||
    "1XgHuvgjYbQjNJOqJLjatj2MvspHnnLdtDW2CjqHPy4Y",
  dtcLogbook:
    process.env.DICT_DTC_LOGBOOK_SHEET_ID ||
    process.env.DTC_LOGBOOK_SHEET_ID ||
    "1_UOkMr7qba-NfoS9Wl8Pu92elFk-DLFbnPWmKaUxlp4",
  syncStatus:
    process.env.DICT_SYNC_STATUS_SHEET_ID ||
    process.env.SYNC_STATUS_SHEET_ID ||
    "1feIZuIyRsw-Qf8KbIsms7oO_-NgL32x_AejmolrNc3c",
  results:
    process.env.GOOGLE_SHEETS_TARGET_ID ||
    "1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv8p6WUrhDM",
  intern:
    process.env.INTERN_SHEET_ID ||
    "1r0mDKN8Y6A0y4I-6wVN8td_6UEvg7cNQWEHZm22dHcw",
};

// ── Standard column aliases for activity → sheet sync ──────────────────────
const ACTIVITY_ALIASES: Record<string, string[]> = {
  province:            ["Province"],
  lgu:                 ["LGU/Municipality Name", "LGU", "Municipality", "LGU Name"],
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

const MONTHS_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Required tabs per sheet
const REQUIRED_TABS: Record<string, string[]> = {
  attendance: ["Attendance", "AuditTrail"],
  dtcLogbook: ["Logbook"],
  syncStatus: ["Status"],
  // results sheet already has its own tabs — we don't create new ones
};

// ── Service Account JWT → Google OAuth token ────────────────────────────────

async function getGoogleToken(): Promise<string> {
  let email: string;
  let privateKey: string;

  const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let parsed: { client_email?: string; private_key?: string } | null = null;
  if (saKeyJson && saKeyJson.length > 10) {
    try { parsed = JSON.parse(saKeyJson); } catch { /* fall through */ }
  }

  if (parsed?.client_email && parsed?.private_key) {
    email = parsed.client_email;
    privateKey = parsed.private_key;
  } else {
    email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
    privateKey = rawKey.replace(/\\n/g, "\n");
  }

  if (!email || !privateKey) {
    throw new Error(
      "Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_KEY (JSON) or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local"
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.write(`${h}.${p}`);
  signer.end();
  const sig = signer.sign(privateKey, "base64url");
  const jwt = `${h}.${p}.${sig}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await resp.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) throw new Error(`Google token: ${data.error} — ${data.error_description ?? ""}`);
  return data.access_token;
}

// ── Tab management ──────────────────────────────────────────────────────────

async function getExistingTabs(token: string, sheetId: string): Promise<string[]> {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Cannot read sheet ${sheetId}: ${resp.status}`);
  const d = (await resp.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
  return d.sheets?.map((s) => s.properties?.title ?? "") ?? [];
}

async function createTab(token: string, sheetId: string, title: string): Promise<void> {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    }
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Create tab "${title}" failed: ${err.slice(0, 200)}`);
  }
}

async function ensureTabsExist(
  token: string,
  sheetKey: string,
  sheetId: string
): Promise<{ created: string[]; existing: string[] }> {
  const required = REQUIRED_TABS[sheetKey] ?? [];
  if (required.length === 0) return { created: [], existing: [] };

  const existing = await getExistingTabs(token, sheetId);
  const created: string[] = [];

  for (const tab of required) {
    if (!existing.includes(tab)) {
      await createTab(token, sheetId, tab);
      created.push(tab);
    }
  }
  return { created, existing };
}

// ── Sheets read/write helpers ───────────────────────────────────────────────

async function appendRows(token: string, sheetId: string, tab: string, rows: string[][]) {
  const range = encodeURIComponent(`${tab}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets append (${tab}) ${resp.status}: ${err.slice(0, 300)}`);
  }
  const result = (await resp.json()) as { updates?: { updatedRows?: number } };
  return result.updates?.updatedRows ?? rows.length;
}

async function overwriteSheet(token: string, sheetId: string, tab: string, rows: string[][]) {
  const range = encodeURIComponent(`${tab}!A1:Z${Math.max(rows.length, 1)}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets overwrite (${tab}) ${resp.status}: ${err.slice(0, 300)}`);
  }
}

async function readSheet(token: string, sheetId: string, tab: string): Promise<string[][]> {
  const range = encodeURIComponent(`${tab}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { values?: string[][] };
  return data.values ?? [];
}

async function checkSheetAccess(token: string, sheetId: string): Promise<{ title: string; tabs: string[] }> {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Sheet access failed (${resp.status})`);
  const data = (await resp.json()) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  return {
    title: data.properties?.title ?? "Unknown",
    tabs: data.sheets?.map((s) => s.properties?.title ?? "") ?? [],
  };
}

// ── Format helpers ──────────────────────────────────────────────────────────

function normalizeInternDate(val: string): string {
  if (!val?.trim()) return "";
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mmddyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, "0")}-${mmddyyyy[2].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return iso; }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { target } = await req.json();

    switch (target) {
      // ─── Setup: auto-create missing tabs in all sheets ─────
      case "setupTabs": {
        const token = await getGoogleToken();
        const report: Array<{ sheet: string; created: string[]; existing: string[] }> = [];
        for (const [key, id] of Object.entries(SHEET_IDS)) {
          const result = await ensureTabsExist(token, key, id);
          report.push({ sheet: key, ...result });
        }
        return NextResponse.json({ ok: true, message: "Tabs verified/created", report });
      }

      // ─── Health: verify token + sheet access + tabs ────────
      case "health": {
        const token = await getGoogleToken();
        const results: Array<{ name: string; ok: boolean; title?: string; tabs?: string[]; error?: string }> = [];
        for (const [name, id] of Object.entries(SHEET_IDS)) {
          try {
            const info = await checkSheetAccess(token, id);
            results.push({ name, ok: true, title: info.title, tabs: info.tabs });
          } catch (e) {
            results.push({ name, ok: false, error: String(e) });
          }
        }
        const allOk = results.every((r) => r.ok);
        return NextResponse.json({
          ok: allOk,
          message: allOk ? `All ${results.length} sheets accessible` : "Some sheets failed",
          results,
        });
      }

      // ─── Sync DTC logs → DICT_DTC_Logbook / Logbook tab ───
      case "syncDTC": {
        const records = await convex.query(api.attendanceSync.getUnsyncedDTCLogsPublic, { limit: 50 });
        if (records.length === 0) {
          return NextResponse.json({ ok: true, message: "No pending DTC logs", synced: 0 });
        }

        const token = await getGoogleToken();
        await ensureTabsExist(token, "dtcLogbook", SHEET_IDS.dtcLogbook);

        const rows = records.map((r: any) => [
          fmtDate(r.timeIn), r.fullName ?? "", r.agency ?? "", r.purpose ?? "",
          (r.equipmentUsed ?? []).join(", "), r.pcName ?? "", r.serviceType ?? "",
          fmtTime(r.timeIn), fmtTime(r.timeOut),
          r.plannedDurationHours?.toString() ?? "",
          r.satisfactionRating?.toString() ?? "", r.remarks ?? "",
          r.contactEmail ?? "", r.contactPhone ?? "",
        ]);

        // Append header row if tab is empty
        const existingData = await readSheet(token, SHEET_IDS.dtcLogbook, "Logbook");
        if (existingData.length === 0) {
          await appendRows(token, SHEET_IDS.dtcLogbook, "Logbook", [
            ["Date", "Full Name", "Agency", "Purpose", "Equipment Used", "PC", "Service Type",
             "Time In", "Time Out", "Planned Hours", "Rating", "Remarks", "Email", "Phone"],
          ]);
        }

        const synced = await appendRows(token, SHEET_IDS.dtcLogbook, "Logbook", rows);
        const ids = records.map((r: any) => r._id as Id<"dtcLogs">);
        await convex.mutation(api.attendanceSync.markDTCLogsSyncedPublic, { ids });

        return NextResponse.json({ ok: true, message: `Synced ${synced} DTC logs`, synced });
      }

      // ─── Sync attendance → DICT_Attendance_Log / Attendance + AuditTrail ──
      case "syncAttendance": {
        const records = await convex.query(api.attendanceSync.getUnsyncedAttendancePublic, { limit: 50 });
        if (records.length === 0) {
          return NextResponse.json({ ok: true, message: "No pending attendance records", synced: 0 });
        }

        const token = await getGoogleToken();
        await ensureTabsExist(token, "attendance", SHEET_IDS.attendance);

        // Header if empty
        const existingAtt = await readSheet(token, SHEET_IDS.attendance, "Attendance");
        if (existingAtt.length === 0) {
          await appendRows(token, SHEET_IDS.attendance, "Attendance", [
            ["Date", "Intern Name", "School", "Department", "Time In", "Time Out",
             "Hours", "Check-In Method", "Face Confidence", "Status"],
          ]);
        }

        const rows = records.map((r: any) => [
          r.date ?? "", r.internName ?? "", r.internSchool ?? "", r.internDepartment ?? "",
          fmtTime(r.timeIn), fmtTime(r.timeOut), r.hours?.toFixed(2) ?? "",
          r.checkInMethod ?? "",
          r.faceConfidence != null ? (r.faceConfidence * 100).toFixed(0) + "%" : "",
          r.status ?? "",
        ]);

        const synced = await appendRows(token, SHEET_IDS.attendance, "Attendance", rows);
        const ids = records.map((r: any) => r._id as Id<"internAttendance">);
        await convex.mutation(api.attendanceSync.markAttendanceSyncedPublic, { ids });

        // Also sync audit trail
        let auditCount = 0;
        try {
          const auditRecords = await convex.query(api.auditLog.getRecentActivity, { limit: 20 });
          const unsyncedAudit = auditRecords.filter((a: any) => !a.syncedToSheets);
          if (unsyncedAudit.length > 0) {
            const existingAudit = await readSheet(token, SHEET_IDS.attendance, "AuditTrail");
            if (existingAudit.length === 0) {
              await appendRows(token, SHEET_IDS.attendance, "AuditTrail", [
                ["Timestamp", "Type", "User", "Method", "Confidence", "Details"],
              ]);
            }
            const auditRows = unsyncedAudit.map((a: any) => [
              a.timestamp ?? "", a.type ?? "", a.userName ?? "", a.method ?? "",
              a.confidence != null ? (a.confidence * 100).toFixed(0) + "%" : "",
              a.metadata ?? "",
            ]);
            await appendRows(token, SHEET_IDS.attendance, "AuditTrail", auditRows);
            const auditIds = unsyncedAudit.map((a: any) => a._id as Id<"auditLog">);
            await convex.mutation(api.auditLog.markSyncedPublic, { ids: auditIds });
            auditCount = unsyncedAudit.length;
          }
        } catch (e) {
          console.warn("[syncAttendance] AuditTrail:", String(e));
        }

        return NextResponse.json({
          ok: true,
          message: `Synced ${synced} attendance + ${auditCount} audit records`,
          synced,
        });
      }

      // ─── Update DICT_Sync_Status / Status tab ─────────────
      case "syncStatusSheet": {
        const pending = await convex.query(api.attendanceSync.countPendingPublic, {});
        const syncStatuses = await convex.query(api.syncMonitor.getAll, {});

        const token = await getGoogleToken();
        await ensureTabsExist(token, "syncStatus", SHEET_IDS.syncStatus);

        const headerRow = ["Sheet Name", "Status", "Last Sync", "Records Synced", "Pending", "Last Error", "Updated At"];
        const dataRows = syncStatuses.map((s: any) => [
          s.sheetName ?? "", s.status ?? "",
          s.lastSyncTime ? new Date(s.lastSyncTime).toISOString() : "Never",
          s.recordsSynced?.toString() ?? "0",
          s.totalPending?.toString() ?? "0",
          s.lastError ?? "",
          s.updatedAt ? new Date(s.updatedAt).toISOString() : "",
        ]);
        const summaryRows: string[][] = [
          [],
          ["=== PENDING SYNC COUNTS ==="],
          ["Intern Attendance", pending.attendance.toString()],
          ["DTC Logs", pending.dtcLogs.toString()],
          ["Audit Logs", pending.auditLogs.toString()],
          ["Total", (pending.attendance + pending.dtcLogs + pending.auditLogs).toString()],
          [],
          ["Last Updated", new Date().toISOString()],
        ];

        await overwriteSheet(token, SHEET_IDS.syncStatus, "Status", [headerRow, ...dataRows, ...summaryRows]);
        return NextResponse.json({ ok: true, message: "Sync status sheet updated" });
      }

      // ─── Sync activities → project Google Sheets (DICT_Program) ──
      case "syncActivities": {
        const activities = await convex.query(api.attendanceSync.getUnsyncedActivitiesPublic, { limit: 50 });
        if (activities.length === 0) {
          return NextResponse.json({ ok: true, message: "No pending activities to sync", synced: 0 });
        }

        const token = await getGoogleToken();

        // Group activities by sheetId
        const bySheet: Record<string, typeof activities> = {};
        for (const act of activities) {
          if (!act.sheetId || !act.sheetSyncEnabled) continue;
          if (!bySheet[act.sheetId]) bySheet[act.sheetId] = [];
          bySheet[act.sheetId].push(act);
        }

        const syncedIds: Id<"activities">[] = [];
        let totalSynced = 0;

        for (const [sheetId, sheetActivities] of Object.entries(bySheet)) {
          const sheetName = sheetActivities[0].sheetName ?? "Sheet1";

          // Read header row to build column map
          let headerRow: string[];
          try {
            const existingData = await readSheet(token, sheetId, sheetName);
            headerRow = (existingData[0] ?? []).map((h: string) => h.trim());
          } catch {
            console.warn(`[syncActivities] Cannot read headers from sheet ${sheetId}`);
            continue;
          }

          if (headerRow.length === 0) continue;

          // Build header→index map
          const headerIndexMap: Record<string, number> = {};
          for (let i = 0; i < headerRow.length; i++) {
            if (headerRow[i]) headerIndexMap[headerRow[i]] = i;
          }

          const rows: string[][] = [];

          for (const act of sheetActivities) {
            const p = act.participants;
            const totalPax = p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
              p.suc.male + p.suc.female + p.others.male + p.others.female;

            // Build image URL for the photos column
            const imageUrls = (act.images ?? []).map((img: any) => img.url).filter(Boolean);
            const photoValue = imageUrls.length > 0
              ? (imageUrls.length === 1 ? `=IMAGE("${imageUrls[0]}")` : imageUrls.join("\n"))
              : (act.rawPhotosLink ?? "");

            const now = new Date();
            const lastUpdatedStr = `${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

            const fieldToValue: Record<string, string> = {
              month: MONTHS_NAMES[(act.month ?? 1) - 1],
              year: String(act.year ?? new Date().getFullYear()),
              province: act.provinceName,
              lgu: act.lguName ?? "",
              activityTitle: act.activityTitle,
              venue: act.venue,
              partnerOrganizations: act.partnerOrganizations.join(", "),
              startDate: act.startDate,
              endDate: act.endDate,
              modeOfConduct: act.modeOfConduct,
              personnelRaw: act.personnelRaw ?? "",
              status: act.status,
              remarks: act.remarks ?? "",
              afterActivityReport: act.afterActivityReport ?? "",
              fbPostingLink: act.fbPostingLink ?? "",
              rawPhotosLink: photoValue,
              testimonialsLink: act.testimonialsLink ?? "",
              driveFolderLink: act.driveFolderLink ?? "",
              ngaMale: String(p.nga.male),
              ngaFemale: String(p.nga.female),
              lguMale: String(p.lgu.male),
              lguFemale: String(p.lgu.female),
              sucMale: String(p.suc.male),
              sucFemale: String(p.suc.female),
              othersMale: String(p.others.male),
              othersFemale: String(p.others.female),
              othersLabel: p.others.label ?? "",
              totalParticipants: String(totalPax),
              lastUpdated: lastUpdatedStr,
            };

            // Build the row using header-based column mapping
            const rowData = new Array(headerRow.length).fill("");
            for (const [fieldKey, aliases] of Object.entries(ACTIVITY_ALIASES)) {
              if (fieldToValue[fieldKey] === undefined || fieldToValue[fieldKey] === "") continue;
              for (const alias of aliases) {
                const colIdx = headerIndexMap[alias];
                if (colIdx !== undefined) {
                  rowData[colIdx] = fieldToValue[fieldKey];
                  break;
                }
              }
            }

            rows.push(rowData);
            syncedIds.push(act._id as Id<"activities">);
          }

          if (rows.length > 0) {
            await appendRows(token, sheetId, sheetName, rows);
            totalSynced += rows.length;
          }
        }

        // Also mark activities with no sheet connection as synced (nothing to push)
        const noSheetIds = activities
          .filter((a) => !a.sheetId || !a.sheetSyncEnabled)
          .map((a) => a._id as Id<"activities">);
        const allSyncedIds = [...syncedIds, ...noSheetIds];

        if (allSyncedIds.length > 0) {
          await convex.mutation(api.attendanceSync.markActivitiesSyncedPublic, { ids: allSyncedIds });
        }

        return NextResponse.json({
          ok: true,
          message: `Synced ${totalSynced} activities to sheets, ${noSheetIds.length} skipped (no sheet connection)`,
          synced: totalSynced,
        });
      }

      // ─── Sync interns from INTERN sheet → Convex ──────────────
      case "syncInterns": {
        const token = await getGoogleToken();

        let rawRows: string[][];
        try {
          rawRows = await readSheet(token, SHEET_IDS.intern, "Interns");
        } catch (e) {
          // Try without tab name (default first sheet)
          try {
            rawRows = await readSheet(token, SHEET_IDS.intern, "Sheet1");
          } catch {
            return NextResponse.json({ ok: false, message: `Cannot read intern sheet: ${String(e)}` }, { status: 500 });
          }
        }

        if (rawRows.length < 2) {
          return NextResponse.json({ ok: true, message: "Intern sheet has no data rows", synced: 0 });
        }

        // Parse rows — same column layout as intern-sheets-sync
        // A(0):FullName B(1):Email C(2):Phone D(3):School E(4):Course
        // F(5):Department G(6):Supervisor H(7):StartDate I(8):EndDate
        // J(9):RequiredHours K(10):Status L(11):Notes
        const parsedRows: any[] = [];
        const parseErrors: string[] = [];

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.every((c) => !c?.trim())) continue;

          const fullName = (row[0] ?? "").trim();
          if (!fullName) { parseErrors.push(`Row ${i+1}: Missing Full Name`); continue; }

          const school = (row[3] ?? "").trim();
          if (!school) { parseErrors.push(`Row ${i+1}: Missing School`); continue; }

          const course = (row[4] ?? "").trim();
          if (!course) { parseErrors.push(`Row ${i+1}: Missing Course`); continue; }

          const startDate = normalizeInternDate(row[7] ?? "");
          if (!startDate) { parseErrors.push(`Row ${i+1}: Missing Start Date`); continue; }

          const endDate = normalizeInternDate(row[8] ?? "");
          if (!endDate) { parseErrors.push(`Row ${i+1}: Missing End Date`); continue; }

          const reqHours = parseInt(String(row[9] ?? "0").replace(/,/g, "").trim());
          if (isNaN(reqHours) || reqHours <= 0) {
            parseErrors.push(`Row ${i+1}: Invalid Required Hours`); continue;
          }

          const rawStatus = (row[10] ?? "ACTIVE").trim().toLowerCase();
          const statusMap: Record<string, string> = {
            active: "ACTIVE", completed: "COMPLETED", inactive: "INACTIVE",
            "on leave": "ON_LEAVE", "on-leave": "ON_LEAVE", leave: "ON_LEAVE",
          };

          parsedRows.push({
            fullName,
            email: (row[1] ?? "").trim() || undefined,
            phone: (row[2] ?? "").trim() || undefined,
            school,
            course,
            department: (row[5] ?? "").trim() || undefined,
            supervisor: (row[6] ?? "").trim() || undefined,
            startDate,
            endDate,
            requiredHours: reqHours,
            status: statusMap[rawStatus] ?? "ACTIVE",
            notes: (row[11] ?? "").trim() || undefined,
            sheetsRowNumber: i + 1,
          });
        }

        if (parsedRows.length === 0) {
          return NextResponse.json({ ok: true, message: "No valid intern rows parsed", synced: 0, parseErrors });
        }

        const result = await convex.mutation(api.internSheetsSync.bulkUpsertInternsFromSheets, {
          sheetId: SHEET_IDS.intern,
          rows: parsedRows,
          syncedBy: "auto-sync",
        });

        return NextResponse.json({
          ok: true,
          message: `Intern sync: ${result.inserted} inserted, ${result.updated} updated`,
          synced: result.inserted + result.updated,
          parseErrors,
          errors: result.errors,
        });
      }

      // ─── Sync all: run DTC + Attendance + Activities + Interns + Status in sequence ─
      case "syncAll": {
        const results: Array<{ target: string; ok: boolean; message: string }> = [];
        for (const t of ["syncDTC", "syncAttendance", "syncActivities", "syncInterns", "syncStatusSheet"]) {
          try {
            const inner = await POST(new NextRequest("http://localhost/api/sync-trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target: t }),
            }));
            const d = await inner.json();
            results.push({ target: t, ok: d.ok, message: d.message });
          } catch (e) {
            results.push({ target: t, ok: false, message: String(e) });
          }
        }
        const allOk = results.every((r) => r.ok);
        return NextResponse.json({
          ok: allOk,
          message: allOk ? "All syncs completed" : "Some syncs failed",
          results,
        });
      }

      default:
        return NextResponse.json({ ok: false, message: `Unknown target: ${target}` }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-trigger]", msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
