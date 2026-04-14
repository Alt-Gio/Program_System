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

// ── Date & number helpers (mirrors app/api/sheets-sync/route.ts) ──

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

  // Fetch province lookup
  const provinces = await ctx.runQuery(api.provinces.list, {});
  const provinceMap: Record<string, string> = {};
  for (const p of provinces) {
    provinceMap[p.name.toLowerCase().trim()] = p._id;
    provinceMap[p.code.toLowerCase().trim()] = p._id;
  }

  // Read the sheet
  const range = encodeURIComponent(`${params.sheetName}!A:Z`);
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

  // Parse rows
  const parsedRows: any[] = [];
  const parseErrors: string[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => !c?.trim())) continue;

    const pKey = (row[0] ?? "").trim().toLowerCase();
    const provinceId = provinceMap[pKey];
    if (!provinceId) {
      parseErrors.push(`Row ${i + 1}: Unknown province "${row[0] ?? ""}"`);
      continue;
    }

    const activityTitle = (row[4] ?? "").trim();
    if (!activityTitle) {
      parseErrors.push(`Row ${i + 1}: Missing Activity Title (col E)`);
      continue;
    }

    const year  = safeInt(row[2]) || new Date().getFullYear();
    const month = Math.min(12, Math.max(1, safeInt(row[3]) || new Date().getMonth() + 1));

    parsedRows.push({
      provinceId,
      month, year,
      activityTitle,
      venue:                (row[5] ?? "").trim() || "TBD",
      partnerOrganizations: (row[6] ?? "").split(";").map((s) => s.trim()).filter(Boolean),
      startDate:            normalizeDate(row[7] ?? ""),
      endDate:              normalizeDate(row[8] ?? row[7] ?? ""),
      modeOfConduct:        (row[9] ?? "Face-to-face").trim(),
      personnelRaw:         row[10]?.trim() || undefined,
      participants: {
        nga:    { male: safeInt(row[11]), female: safeInt(row[12]) },
        lgu:    { male: safeInt(row[13]), female: safeInt(row[14]) },
        suc:    { male: safeInt(row[15]), female: safeInt(row[16]) },
        others: { male: safeInt(row[17]), female: safeInt(row[18]), label: row[19]?.trim() || undefined },
      },
      afterActivityReport: row[20]?.trim() || undefined,
      fbPostingLink:       row[21]?.trim() || undefined,
      rawPhotosLink:       row[22]?.trim() || undefined,
      testimonialsLink:    row[23]?.trim() || undefined,
      remarks:             row[24]?.trim() || undefined,
      status:              row[25]?.trim() || undefined,
      sheetRowNumber:      i + 1,
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
