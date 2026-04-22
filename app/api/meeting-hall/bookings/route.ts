import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// POST /api/meeting-hall/bookings
//
// Public endpoint — no session required. Accepts booking payloads
// from the /meeting-hall page. Dedup is handled server-side via
// `clientId`, so the browser offline queue / service-worker
// Background Sync can retry freely without creating duplicates.
// ============================================================

type Payload = {
  clientId?: string;
  fullName?: string;
  designation?: string;
  agency?: string;
  email?: string;
  phone?: string;
  date?: string;
  timeSlot?: string;
  attendees?: string;
  eventType?: string;
  purpose?: string;
  submittedOffline?: boolean;
  clientSubmittedAt?: number;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const required: Array<keyof Payload> = [
    "clientId",
    "fullName",
    "agency",
    "email",
    "date",
    "timeSlot",
    "attendees",
    "eventType",
  ];
  for (const key of required) {
    const val = body[key];
    if (typeof val !== "string" || !val.trim()) {
      return NextResponse.json(
        { ok: false, error: `Missing field: ${key}` },
        { status: 400 }
      );
    }
  }

  try {
    const result = await fetchMutation(api.meetingHall.submit, {
      clientId: body.clientId!.trim(),
      fullName: body.fullName!.trim(),
      designation: body.designation?.trim() || undefined,
      agency: body.agency!.trim(),
      email: body.email!.trim(),
      phone: body.phone?.trim() || undefined,
      date: body.date!.trim(),
      timeSlot: body.timeSlot!.trim(),
      attendees: body.attendees!.trim(),
      eventType: body.eventType!.trim(),
      purpose: body.purpose?.trim() || undefined,
      submittedOffline: body.submittedOffline === true,
      userAgent: req.headers.get("user-agent") ?? undefined,
      clientSubmittedAt:
        typeof body.clientSubmittedAt === "number"
          ? body.clientSubmittedAt
          : undefined,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const msg = String(err?.message ?? "Failed to submit booking");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
