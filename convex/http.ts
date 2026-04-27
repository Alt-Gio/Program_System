import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ============================================================
// Convex HTTP Actions — Google Sheets Webhook Endpoint
//
// Google Apps Script calls POST /api/sheets-sync with:
//   Header:  X-Webhook-Secret: <secret>
//   Header:  X-Sheet-Id: <sheetId>
//   Body:    JSON array of row objects OR single row object
//
// The action validates the secret, resolves province/LGU IDs,
// then calls the upsert mutation so the DB and UI update live.
// ============================================================

const http = httpRouter();

http.route({
  path: "/api/sheets-sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const secret = request.headers.get("X-Webhook-Secret") ?? "";
      const sheetId = request.headers.get("X-Sheet-Id") ?? "";

      if (!sheetId) {
        return new Response(JSON.stringify({ error: "Missing X-Sheet-Id header" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Look up connection by sheetId and validate secret
      const connection = await ctx.runQuery(api.sheetsSync.getConnectionBySheetId, { sheetId });
      if (!connection) {
        return new Response(JSON.stringify({ error: "No connection found for this sheet" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (connection.webhookSecret !== secret) {
        return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (!connection.syncEnabled) {
        return new Response(JSON.stringify({ error: "Sync is disabled for this connection" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Parse body — supports single row or array of rows
      const body = await request.json();
      const rows: RawSheetRow[] = Array.isArray(body) ? body : [body];

      // Resolve province + LGU names to IDs
      const provinces: Array<{ _id: Id<"provinces">; name: string; code: string }> = await ctx.runQuery(api.provinces.list, {});
      const allLGUs: Array<{ _id: Id<"lgus">; provinceId: Id<"provinces">; name: string }> = await ctx.runQuery(api.provinces.allLGUs, {});

      const results: Array<{ action: string; id: string; error?: string }> = [];

      for (const row of rows) {
        try {
          // Resolve province
          const province = provinces.find(
            (p) => p.name.toLowerCase() === (row.province ?? "").toLowerCase() ||
                   p.code.toLowerCase() === (row.province ?? "").toLowerCase()
          );
          if (!province) {
            results.push({ action: "skipped", id: "", error: `Province not found: ${row.province}` });
            continue;
          }

          // Resolve LGU (optional)
          const lgu = row.lgu
            ? allLGUs.find(
                (l) =>
                  l.provinceId === province._id &&
                  l.name.toLowerCase().includes((row.lgu ?? "").toLowerCase())
              )
            : null;

          // Parse date to derive month/year
          const startDate = parseDate(row.startDate) ?? new Date().toISOString().split("T")[0];
          const d = new Date(startDate);
          const month = row.month ? Number(row.month) : d.getMonth() + 1;
          const year = row.year ? Number(row.year) : d.getFullYear();

          const result = await ctx.runMutation(api.sheetsSync.upsertActivityFromSheet, {
            projectId: connection.projectId,
            sheetId,
            sheetRowNumber: row.rowNumber,
            provinceId: province._id,
            lguId: lgu?._id,
            month,
            year,
            activityTitle: row.activityTitle ?? "Untitled",
            venue: row.venue ?? "",
            partnerOrganizations: splitCSV(row.partnerOrganizations),
            startDate,
            endDate: parseDate(row.endDate) ?? startDate,
            modeOfConduct: row.modeOfConduct ?? "On-Site",
            personnelRaw: row.personnelRaw,
            participants: {
              nga: { male: toInt(row.ngaMale), female: toInt(row.ngaFemale) },
              lgu: { male: toInt(row.lguMale), female: toInt(row.lguFemale) },
              suc: { male: toInt(row.sucMale), female: toInt(row.sucFemale) },
              others: {
                male: toInt(row.othersMale),
                female: toInt(row.othersFemale),
                label: row.othersLabel ?? "Others",
              },
            },
            afterActivityReport: row.afterActivityReport,
            fbPostingLink: row.fbPostingLink,
            rawPhotosLink: row.rawPhotosLink,
            testimonialsLink: row.testimonialsLink,
            remarks: row.remarks,
            extraFields: row.extraFields,
            status: row.status ?? "Submitted",
            syncedBy: "webhook",
          });

          results.push({ action: result.action, id: result.id });
        } catch (e) {
          results.push({ action: "error", id: "", error: String(e) });
        }
      }

      const inserted = results.filter((r) => r.action === "inserted").length;
      const updated = results.filter((r) => r.action === "updated").length;
      const errors = results.filter((r) => r.action === "error" || r.action === "skipped");

      return new Response(
        JSON.stringify({ success: true, inserted, updated, errors: errors.length, details: errors }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Health check endpoint for testing
http.route({
  path: "/api/sheets-sync",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(
      JSON.stringify({ status: "ok", service: "DICT R5 PMS Sheets Webhook" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

// ── Manual sync trigger endpoint (for test dashboard) ───────────────────────
http.route({
  path: "/api/trigger-sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json() as { target?: string };
      const target = body.target;
      if (!target) {
        return new Response(JSON.stringify({ ok: false, message: "Missing 'target'" }), {
          status: 400,
          headers: cors,
        });
      }

      const result = await ctx.runAction(internal.googleSheetsWrite.manualTrigger, { target });
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: cors,
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, message: String(e) }), {
        status: 500,
        headers: cors,
      });
    }
  }),
});

// CORS preflight for trigger-sync
http.route({
  path: "/api/trigger-sync",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: cors });
  }),
});

const cors: HeadersInit = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // X-Face-Token added for the face-server endpoint below.
  "Access-Control-Allow-Headers": "Content-Type, X-Face-Token, X-Webhook-Secret, X-Sheet-Id",
};

// ============================================================
// FACE RECOGNITION ATTENDANCE WEBHOOK
//
// The Python face-recognition server posts recognition events here.
// We authenticate with a simple shared token (FACE_SHARED_TOKEN env
// var on the Convex deployment) — this avoids shipping Convex admin
// keys to the Python container while still keeping the endpoint
// closed to the public.
//
// Protocol:
//   POST /face/attendance
//     Header: X-Face-Token: <same value as FACE_SHARED_TOKEN>
//     Body:   single event object OR array of event objects:
//             { userId, name, confidence, action, cameraId, timestamp }
//
// The `action` field is advisory only — the mutation handler decides
// whether this is a time_in or time_out based on what's already in
// the DB for this user today. This keeps retries from the Python
// sync queue idempotent.
// ============================================================

type FaceEvent = {
  userId:     string;
  name:       string;
  confidence: number;
  action?:    string;   // advisory; recomputed server-side
  cameraId:   string;
  timestamp:  string;
};

function isFaceEvent(x: unknown): x is FaceEvent {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.userId     === "string" &&
    typeof o.name       === "string" &&
    typeof o.confidence === "number" &&
    typeof o.cameraId   === "string" &&
    typeof o.timestamp  === "string"
  );
}

http.route({
  path: "/face/attendance",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // ── Auth ──────────────────────────────────────────────────
    const expected = process.env.FACE_SHARED_TOKEN ?? "";
    const provided = request.headers.get("X-Face-Token") ?? "";
    if (!expected) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "FACE_SHARED_TOKEN is not configured on the Convex deployment.",
        }),
        { status: 503, headers: cors },
      );
    }
    if (provided !== expected) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid or missing X-Face-Token" }),
        { status: 401, headers: cors },
      );
    }

    // ── Parse ─────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body" }),
        { status: 400, headers: cors },
      );
    }

    const events: FaceEvent[] = (Array.isArray(body) ? body : [body])
      .filter(isFaceEvent);

    if (events.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "No valid face events in body" }),
        { status: 400, headers: cors },
      );
    }

    // ── Persist ───────────────────────────────────────────────
    // Each event is a separate transaction. Partial success is OK: the
    // Python sync-queue will retry only the failed ones.
    const results: Array<
      | { inserted: true;  action: "time_in" | "time_out"; date: string }
      | { inserted: false; reason: string }
    > = [];

    for (const ev of events) {
      try {
        const res = await ctx.runMutation(
          internal.face_recognition.markAttendanceInternalAction,
          {
            userId:     ev.userId,
            name:       ev.name,
            confidence: ev.confidence,
            cameraId:   ev.cameraId,
            timestamp:  ev.timestamp,
          },
        );
        results.push(res);
      } catch (e) {
        results.push({ inserted: false, reason: String(e) });
      }
    }

    const inserted = results.filter((r) => r.inserted).length;
    const skipped  = results.length - inserted;
    return new Response(
      JSON.stringify({ ok: true, inserted, skipped, results }),
      { status: 200, headers: cors },
    );
  }),
});

// CORS preflight
http.route({
  path: "/face/attendance",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: cors })),
});

// Lightweight health probe (no auth — safe to expose)
http.route({
  path: "/face/health",
  method: "GET",
  handler: httpAction(async () =>
    new Response(
      JSON.stringify({ ok: true, service: "DICT R5 PMS Face Webhook" }),
      { status: 200, headers: cors },
    ),
  ),
});

export default http;

// ---- Types & Helpers ----------------------------------------

interface RawSheetRow {
  rowNumber?: number;
  province?: string;
  lgu?: string;
  activityTitle?: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
  month?: string | number;
  year?: string | number;
  modeOfConduct?: string;
  partnerOrganizations?: string;
  personnelRaw?: string;
  ngaMale?: string | number;
  ngaFemale?: string | number;
  lguMale?: string | number;
  lguFemale?: string | number;
  sucMale?: string | number;
  sucFemale?: string | number;
  othersMale?: string | number;
  othersFemale?: string | number;
  othersLabel?: string;
  afterActivityReport?: string;
  fbPostingLink?: string;
  rawPhotosLink?: string;
  testimonialsLink?: string;
  remarks?: string;
  extraFields?: string;
  status?: string;
}

function parseDate(val?: string | number): string | null {
  if (!val) return null;
  const d = new Date(String(val));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function toInt(val?: string | number): number {
  if (!val && val !== 0) return 0;
  const n = Number(String(val).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : Math.round(n);
}

function splitCSV(val?: string): string[] {
  if (!val) return [];
  return String(val).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}
