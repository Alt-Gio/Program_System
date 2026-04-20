import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createSign } from "crypto";

// ============================================================
// CV Station verification endpoint
// POST /api/cv-station/verify
//
// Called by the CV station setup wizard on first launch.
// Proves the .exe is correctly wired up to:
//   1. The web app (reachable)
//   2. The face-checkin API key (Authorization header valid)
//   3. Convex backend (can run a query)
//   4. Google Sheets (service account token + sheet read access)
//
// Request body: { apiKey: string }
// Response:
//   {
//     ok: boolean,
//     checks: {
//       apiKey:       { ok, message },
//       convex:       { ok, message, internCount? },
//       googleSheets: { ok, message, sheets? },
//       webApp:       { ok, message, version }
//     }
//   }
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  ok: boolean;
  message: string;
  [k: string]: unknown;
};

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
    privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  }
  if (!email || !privateKey) throw new Error("Missing Google credentials on server");

  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

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
  const data = (await resp.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Google token error: ${data.error ?? "unknown"}`);
  return data.access_token;
}

const SHEET_IDS = {
  attendance: process.env.DICT_ATTENDANCE_LOG_SHEET_ID || "1XgHuvgjYbQjNJOqJLjatj2MvspHnnLdtDW2CjqHPy4Y",
  intern: process.env.INTERN_SHEET_ID || "1r0mDKN8Y6A0y4I-6wVN8td_6UEvg7cNQWEHZm22dHcw",
};

async function checkApiKey(body: { apiKey?: string }, headerApiKey: string | null): Promise<CheckResult> {
  const serverKey = process.env.FACE_CV_API_KEY;
  if (!serverKey) {
    return { ok: false, message: "Server has no FACE_CV_API_KEY configured" };
  }
  const provided = body.apiKey ?? headerApiKey ?? "";
  if (!provided) {
    return { ok: false, message: "No API key provided by client" };
  }
  if (provided !== serverKey) {
    return { ok: false, message: "API key does not match server" };
  }
  return { ok: true, message: "API key valid" };
}

async function checkConvex(): Promise<CheckResult> {
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const interns = await convex.query(api.interns.list, {});
    return { ok: true, message: "Convex reachable", internCount: interns.length };
  } catch (e) {
    return { ok: false, message: `Convex error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function checkGoogleSheets(): Promise<CheckResult> {
  try {
    const token = await getGoogleToken();
    const sheetResults: Record<string, { ok: boolean; title?: string; error?: string }> = {};
    for (const [name, id] of Object.entries(SHEET_IDS)) {
      try {
        const resp = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resp.ok) {
          sheetResults[name] = { ok: false, error: `HTTP ${resp.status}` };
        } else {
          const data = (await resp.json()) as { properties?: { title?: string } };
          sheetResults[name] = { ok: true, title: data.properties?.title ?? "Unknown" };
        }
      } catch (e) {
        sheetResults[name] = { ok: false, error: String(e) };
      }
    }
    const allOk = Object.values(sheetResults).every((r) => r.ok);
    return {
      ok: allOk,
      message: allOk ? "All configured sheets reachable" : "One or more sheets unreachable",
      sheets: sheetResults,
    };
  } catch (e) {
    return { ok: false, message: `Google auth failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function POST(req: NextRequest) {
  let body: { apiKey?: string } = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  const auth = req.headers.get("authorization") ?? "";
  const headerApiKey = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  const apiKey = await checkApiKey(body, headerApiKey);

  // Don't run the heavier checks if the key itself is bad.
  if (!apiKey.ok) {
    return NextResponse.json({
      ok: false,
      checks: {
        apiKey,
        convex: { ok: false, message: "skipped — fix API key first" },
        googleSheets: { ok: false, message: "skipped — fix API key first" },
        webApp: { ok: true, message: "Reachable", version: "1.0.0" },
      },
    }, { status: 401 });
  }

  const [convex, googleSheets] = await Promise.all([checkConvex(), checkGoogleSheets()]);

  const ok = apiKey.ok && convex.ok && googleSheets.ok;
  return NextResponse.json({
    ok,
    checks: {
      apiKey,
      convex,
      googleSheets,
      webApp: { ok: true, message: "Reachable", version: "1.0.0" },
    },
  });
}

export async function GET() {
  // Minimal reachability probe for the CV station's "Server reachable" check.
  return NextResponse.json({
    ok: true,
    service: "cv-station-verify",
    version: "1.0.0",
    hint: "POST with { apiKey } to run full verification",
  });
}
