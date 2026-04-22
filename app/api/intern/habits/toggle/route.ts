import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/intern/habits/toggle
// Wraps api.internPortal.toggleHabit. The offline queue always sends
// `desiredCompleted` (the intended final state) + `date`, so replays are
// idempotent regardless of order — the server just patches to that state.

type Payload = {
  clientId?: string;
  token?: string;
  habitId?: string;
  desiredCompleted?: boolean;
  date?: string;
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
  const habitId = body.habitId?.trim();
  if (!token || !habitId) {
    return NextResponse.json(
      { ok: false, error: "Missing token or habitId" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchMutation(api.internPortal.toggleHabit, {
      token,
      habitId: habitId as Id<"internHabits">,
      desiredCompleted: body.desiredCompleted,
      date: body.date,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err: any) {
    const msg = String(err?.message ?? "Failed to toggle habit");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
