import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createSign } from "crypto";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================
// Sync Trigger API — runs in Next.js Node.js runtime
// Handles: health, syncDTC, syncAttendance, syncStatusSheet, setupTabs
// No Convex "use node" needed — JWT signing runs natively here.
//
// POST /api/sync-trigger  { target: string }
// ============================================================

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ── All 4 Google Sheet IDs ──────────────────────────────────────────────────
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
};

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

      // ─── Sync all: run DTC + Attendance + Status in sequence ─
      case "syncAll": {
        const results: Array<{ target: string; ok: boolean; message: string }> = [];
        for (const t of ["syncDTC", "syncAttendance", "syncStatusSheet"]) {
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
