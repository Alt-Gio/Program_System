"use node";

// ============================================================
// Google Sheets Auto-Sync Actions
// Uses a Google Service Account (no user session needed).
// Set these in Convex dashboard → Settings → Environment Variables:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  — the service account email
//   GOOGLE_SERVICE_ACCOUNT_KEY    — the full JSON key as a string
// Then share each Google Sheet with the service account email (Viewer).
// ============================================================

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { createSign } from "node:crypto";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Shared column aliases (MUST match activity-to-sheet/route.ts) ──────────────
// These map our internal field keys to possible header names in any sheet.
// When reading a sheet, we find the column with a matching header, so the
// column ORDER in the sheet does not matter.
const COL_ALIASES: Record<string, string[]> = {
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
  afterActivityReport: ["After Activity Report", "AAR"],
  fbPostingLink:       ["FB Posting Link", "Facebook Link", "FB Link"],
  rawPhotosLink:       ["Raw Photos Link", "Photos", "Photos Link", "Raw Photos"],
  testimonialsLink:    ["Testimonials Link", "Testimonials"],
  driveFolderLink:     ["Drive Folder Link", "Drive Link", "Google Drive Link"],
  remarks:             ["Remarks", "Notes"],
  status:              ["Status", "Status (Don't Edit)", "Status (Do not Edit)"],
};

/** Build a field→column-index map from a header row. */
function buildColMap(headers: string[]): Record<string, number> {
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => { if (h.trim()) headerIndex[h.trim()] = i; });

  const cm: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    for (const alias of aliases) {
      if (headerIndex[alias] !== undefined) {
        cm[field] = headerIndex[alias];
        break;
      }
    }
  }
  return cm;
}

// ── Date & number helpers ─────────────────────────────────────────────────────

function normalizeDate(val: string): string {
  if (!val?.trim()) return "";
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
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
    january:1, february:2, march:3, april:4, may:5, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12,
    jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  };
  return map[val.toLowerCase().trim()] ?? (new Date().getMonth() + 1);
}

function mapStatus(raw: string): string {
  const map: Record<string, string> = {
    "completed": "Reported", "ongoing": "Submitted", "for submission": "Submitted",
    "pending": "Draft", "cancelled": "Draft",
    "draft": "Draft", "submitted": "Submitted", "validated": "Validated", "reported": "Reported",
  };
  return map[raw.toLowerCase().trim()] ?? "Submitted";
}

// ── Service account JWT → access token ──────────────────────

async function getServiceAccountToken(
  email: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.write(`${header}.${payload}`);
  signer.end();
  const sig = signer.sign(privateKey, "base64url");
  const jwt = `${header}.${payload}.${sig}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = (await resp.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`Service account token error: ${data.error ?? "unknown"}`);
  }
  return data.access_token;
}

// ── Core sync helper (called by both actions) ────────────────

async function doSync(
  ctx: ActionCtx,
  params: {
    connectionId: Id<"sheetsConnections">;
    sheetId: string;
    sheetName: string;
    projectId: Id<"projects">;
  }
): Promise<{ inserted?: number; updated?: number; parseErrors?: string[]; error?: string }> {
  const saEmail   = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!saEmail || !saKeyJson) {
    const errMsg =
      "Service account not configured. Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY to Convex env vars.";
    await ctx.runMutation(internal.sheetsSync.markConnectionError, {
      id: params.connectionId,
      error: errMsg,
    });
    return { error: errMsg };
  }

  let privateKey: string;
  try {
    const parsed = JSON.parse(saKeyJson) as { private_key?: string };
    if (!parsed.private_key) throw new Error("missing private_key field");
    privateKey = parsed.private_key;
  } catch (e) {
    return { error: `Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON: ${String(e)}` };
  }

  // Get access token
  let accessToken: string;
  try {
    accessToken = await getServiceAccountToken(saEmail, privateKey);
  } catch (e) {
    const err = String(e);
    await ctx.runMutation(internal.sheetsSync.markConnectionError, {
      id: params.connectionId, error: err,
    });
    return { error: err };
  }

  // Read the sheet — A:AH covers up to column 34, enough for any standard layout
  const range = encodeURIComponent(`${params.sheetName}!A:AH`);
  const sheetResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${params.sheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!sheetResp.ok) {
    const errText = (await sheetResp.text()).slice(0, 300);
    await ctx.runMutation(internal.sheetsSync.markConnectionError, {
      id: params.connectionId, error: errText,
    });
    return { error: errText };
  }

  const sheetData = (await sheetResp.json()) as { values?: string[][] };
  const rawRows = sheetData.values ?? [];

  if (rawRows.length < 2) {
    return { error: "Sheet has no data rows (only header or empty)", inserted: 0, updated: 0 };
  }

  // ── Header-based column map — column ORDER in sheet no longer matters ──
  const headerRow = (rawRows[0] ?? []).map((h: string) => h.trim());
  const cm = buildColMap(headerRow);
  // Helper: get a field value from a data row using the header map
  const g = (row: string[], field: string): string =>
    (row[cm[field] ?? -1] ?? "").trim();

  // Province lookup
  const provinces = await ctx.runQuery(api.provinces.list, {});
  const provinceMap: Record<string, string> = {};
  for (const p of provinces) {
    provinceMap[p.name.toLowerCase().trim()] = p._id;
    provinceMap[p.code.toLowerCase().trim()] = p._id;
  }

  // ── Parse data rows ──
  const parsedRows: any[] = [];
  const parseErrors: string[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => !c?.trim())) continue;

    const pKey = g(row, "province").toLowerCase();
    const provinceId = provinceMap[pKey];
    if (!provinceId) {
      parseErrors.push(`Row ${i + 1}: Unknown province "${g(row, "province") || "(empty)"}"`);
      continue;
    }

    const activityTitle = g(row, "activityTitle");
    if (!activityTitle) {
      parseErrors.push(`Row ${i + 1}: Missing Activity Title`);
      continue;
    }

    const year  = safeInt(g(row, "year")) || new Date().getFullYear();
    const month = Math.min(12, Math.max(1, toMonthNumber(g(row, "month"))));

    const barangay        = g(row, "barangay");
    const driveFolderLink = g(row, "driveFolderLink");
    const extraFieldsObj: Record<string, string> = {};
    if (barangay)        extraFieldsObj.barangay        = barangay;
    if (driveFolderLink) extraFieldsObj.driveFolderLink = driveFolderLink;
    const extraFields = Object.keys(extraFieldsObj).length > 0
      ? JSON.stringify(extraFieldsObj)
      : undefined;

    const rawStatus = g(row, "status");
    const status = rawStatus ? mapStatus(rawStatus) : "Submitted";
    const startDate = normalizeDate(g(row, "startDate"));

    parsedRows.push({
      provinceId,
      month, year,
      activityTitle,
      venue:                g(row, "venue") || "TBD",
      partnerOrganizations: g(row, "partnerOrganizations").split(/[,;]/).map((s: string) => s.trim()).filter(Boolean),
      startDate,
      endDate:              normalizeDate(g(row, "endDate")) || startDate,
      modeOfConduct:        g(row, "modeOfConduct") || "Face-to-Face",
      personnelRaw:         g(row, "personnelRaw") || undefined,
      participants: {
        nga:    { male: safeInt(g(row, "ngaMale")),    female: safeInt(g(row, "ngaFemale"))    },
        lgu:    { male: safeInt(g(row, "lguMale")),    female: safeInt(g(row, "lguFemale"))    },
        suc:    { male: safeInt(g(row, "sucMale")),    female: safeInt(g(row, "sucFemale"))    },
        others: { male: safeInt(g(row, "othersMale")), female: safeInt(g(row, "othersFemale")),
                  label: g(row, "othersLabel") || undefined },
      },
      afterActivityReport: g(row, "afterActivityReport") || undefined,
      fbPostingLink:       g(row, "fbPostingLink")       || undefined,
      rawPhotosLink:       g(row, "rawPhotosLink")       || undefined,
      testimonialsLink:    g(row, "testimonialsLink")    || undefined,
      remarks:             g(row, "remarks")             || undefined,
      status,
      extraFields,
      sheetRowNumber: i + 1,
    });
  }

  if (parsedRows.length === 0) {
    return { error: "No valid rows could be parsed", parseErrors, inserted: 0, updated: 0 };
  }

  const result = (await ctx.runMutation(api.sheetsSync.bulkUpsertFromSheets, {
    projectId: params.projectId,
    sheetId:   params.sheetId,
    rows:      parsedRows,
    syncedBy:  "auto-sync",
  })) as { inserted: number; updated: number; errors: string[] };

  // ── Update connection metadata so the UI can show "Last synced X min ago" ──
  await ctx.runMutation(internal.sheetsSync.markSyncSuccess, {
    sheetId:      params.sheetId,
    rowsAffected: result.inserted + result.updated,
    projectId:    params.projectId,
  });

  return { inserted: result.inserted, updated: result.updated, parseErrors };
}

// ── Exported actions ─────────────────────────────────────────

/** Sync a single sheet connection. Called directly by the cron. */
export const syncOneConnection = internalAction({
  args: {
    connectionId: v.id("sheetsConnections"),
    sheetId:      v.string(),
    sheetName:    v.string(),
    projectId:    v.id("projects"),
  },
  handler: async (ctx, args) => doSync(ctx, args),
});

/** Sync every enabled sheet connection. Called by the 6-hour cron. */
export const syncAllEnabled = internalAction({
  args: {},
  handler: async (ctx) => {
    const connections = (await ctx.runQuery(
      api.sheetsSync.listConnections, {}
    )) as Array<{
      _id: Id<"sheetsConnections">;
      sheetId: string;
      sheetName: string;
      projectId: Id<"projects">;
      syncEnabled: boolean;
      project?: { shortName?: string } | null;
    }>;

    const enabled = connections.filter((c) => c.syncEnabled);
    const results: Array<{ project: string; [k: string]: unknown }> = [];

    for (const conn of enabled) {
      const r = await doSync(ctx, {
        connectionId: conn._id,
        sheetId:      conn.sheetId,
        sheetName:    conn.sheetName,
        projectId:    conn.projectId,
      });
      results.push({ project: conn.project?.shortName ?? String(conn.projectId), ...r });
    }

    console.log("[sheetsActions] syncAllEnabled results:", JSON.stringify(results));
    return results;
  },
});
