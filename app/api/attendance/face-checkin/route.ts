import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/face-checkin
 *
 * Called by the Python face-recognition CV station.
 *
 * Body:
 *   internId?      – Convex intern ID (preferred)
 *   internName?    – fallback name lookup
 *   action         – "timeIn" | "timeOut"
 *   confidence?    – 0.0–1.0 recognition confidence
 *   isoTimestamp?  – ISO-8601 datetime (defaults to server time)
 *
 * Auth: Authorization: Bearer <FACE_CV_API_KEY>
 */
export async function POST(req: NextRequest) {
  // ── API-key gate ─────────────────────────────────────────────
  const apiKey = process.env.FACE_CV_API_KEY;
  if (apiKey) {
    const auth = req.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: {
    internId?: string;
    internName?: string;
    action?: string;
    confidence?: number;
    isoTimestamp?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { internId, internName, action, confidence, isoTimestamp } = body;

  if (!action || !["timeIn", "timeOut"].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "timeIn" or "timeOut"' },
      { status: 400 }
    );
  }

  if (!internId && !internName) {
    return NextResponse.json(
      { error: "Provide internId or internName" },
      { status: 400 }
    );
  }

  // ── Call Convex mutation ──────────────────────────────────────
  try {
    const result = await fetchMutation(api.internAuth.faceCheckIn, {
      internId:     internId ? (internId as Id<"interns">) : undefined,
      internName:   internName ?? undefined,
      action,
      confidence:   typeof confidence === "number" ? confidence : undefined,
      isoTimestamp: isoTimestamp ?? undefined,
    });

    return NextResponse.json(
      {
        success:    true,
        action:     result.action,
        time:       result.time,
        hours:      result.hours,
        internName: result.internName,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[face-checkin]", msg);

    // Surface known user-facing errors as 409 so Python can log them clearly
    const isUserError =
      msg.includes("not found") ||
      msg.includes("not active") ||
      msg.includes("already complete");

    return NextResponse.json(
      { error: msg },
      { status: isUserError ? 409 : 500 }
    );
  }
}
