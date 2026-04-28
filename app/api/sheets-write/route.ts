export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { createSign } from "crypto";

// ============================================================
// Google Sheets Write Proxy — Next.js API Route
// Runs in Node.js natively (no Convex "use node" issues on Windows).
//
// POST /api/sheets-write
//   Body: { action, sheetId, sheetTab, rows, writeMode }
//   Header: Authorization: Bearer <API_KEY>
//
// This is the workaround for the Windows Convex local backend
// ESM loader bug with "use node" files.
// ============================================================

const API_KEY = process.env.SHEETS_WRITE_API_KEY || "dict-sync-2024";

// ── Service account JWT → access token ──────────────────────

async function getWriteToken(): Promise<string> {
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
    throw new Error("Missing credentials. Set GOOGLE_SERVICE_ACCOUNT_KEY or EMAIL+PRIVATE_KEY in .env.local");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
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

  const data = (await resp.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Token error: ${data.error ?? "unknown"} — ${data.error_description ?? ""}`);
  }
  return data.access_token;
}

// ── Append rows ─────────────────────────────────────────────

async function appendRows(token: string, sheetId: string, sheetTab: string, rows: string[][]) {
  const range = encodeURIComponent(`${sheetTab}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Sheets append failed (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const result = (await resp.json()) as { updates?: { updatedRows?: number } };
  return { updatedRows: result.updates?.updatedRows ?? rows.length };
}

// ── Write full sheet (overwrite) ────────────────────────────

async function writeSheet(token: string, sheetId: string, sheetTab: string, rows: string[][]) {
  const range = encodeURIComponent(`${sheetTab}!A1:Z${rows.length}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Sheets write failed (${resp.status}): ${errText.slice(0, 300)}`);
  }
}

// ── Check connectivity ──────────────────────────────────────

async function checkSheet(token: string, sheetId: string) {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Sheet access failed (${resp.status}): ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { properties?: { title?: string } };
  return data.properties?.title ?? "Unknown";
}

// ── Main handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const apiKey = authHeader?.replace("Bearer ", "");
  if (apiKey !== API_KEY) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, sheetId, sheetTab, rows, writeMode } = body;

    switch (action) {
      case "health": {
        const token = await getWriteToken();
        return NextResponse.json({ ok: true, message: "Auth OK", tokenLength: token.length });
      }

      case "checkSheet": {
        const token = await getWriteToken();
        const title = await checkSheet(token, sheetId);
        return NextResponse.json({ ok: true, message: `Sheet: ${title}`, title });
      }

      case "write": {
        if (!sheetId || !sheetTab || !rows) {
          return NextResponse.json({ ok: false, message: "Missing sheetId, sheetTab, or rows" }, { status: 400 });
        }
        const token = await getWriteToken();
        if (writeMode === "overwrite") {
          await writeSheet(token, sheetId, sheetTab, rows);
          return NextResponse.json({ ok: true, message: `Wrote ${rows.length} rows to ${sheetTab}` });
        } else {
          const result = await appendRows(token, sheetId, sheetTab, rows);
          return NextResponse.json({ ok: true, message: `Appended ${result.updatedRows} rows to ${sheetTab}`, ...result });
        }
      }

      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sheets-write]", msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
