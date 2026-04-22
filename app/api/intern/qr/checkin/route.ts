import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/intern/qr/checkin
// Wraps api.internAuth.checkIn. Naturally idempotent: if the intern is
// already checked in for the day, the mutation returns the existing record.
// Offline replays that fail geofence validation will 4xx back, which the
// service worker drops from the queue (permanent failure).

type Payload = {
  clientId?: string;
  token?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  address?: string;
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
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  try {
    const result = await fetchMutation(api.internAuth.checkIn, {
      token,
      lat: typeof body.lat === "number" ? body.lat : undefined,
      lng: typeof body.lng === "number" ? body.lng : undefined,
      accuracy: typeof body.accuracy === "number" ? body.accuracy : undefined,
      address: body.address || undefined,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err: any) {
    const msg = String(err?.message ?? "Check-in failed");
    // Already-checked-in / geofence errors are permanent — 400 so the SW
    // drops the queued record instead of retrying forever.
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
