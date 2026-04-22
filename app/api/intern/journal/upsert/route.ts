import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/intern/journal/upsert
// Public wrapper around api.internPortal.upsertDailyLog. Token-authenticated
// (server validates the token against internLoginSessions). Service worker
// intercepts this endpoint for offline queueing. Upsert is naturally
// idempotent by (internId, date).

type Payload = {
  clientId?: string;
  token?: string;
  date?: string;
  accomplishments?: string;
  mood?: string;
  learnings?: string;
  challenges?: string;
  tomorrowPlan?: string;
  submittedOffline?: boolean;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  const date = body.date?.trim();
  if (!token || !date) {
    return NextResponse.json(
      { ok: false, error: "Missing token or date" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchMutation(api.internPortal.upsertDailyLog, {
      token,
      date,
      accomplishments: body.accomplishments || undefined,
      mood: body.mood || undefined,
      learnings: body.learnings || undefined,
      challenges: body.challenges || undefined,
      tomorrowPlan: body.tomorrowPlan || undefined,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err: any) {
    const msg = String(err?.message ?? "Failed to save journal");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
