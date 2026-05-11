export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";
import {
  getCalendarClient,
  CalendarConnectionRevoked,
  CalendarNotConnected,
} from "@/lib/learnhub/google-calendar";
import type { Id } from "@/convex/_generated/dataModel";

async function requireSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySession(token) : null;
}

function errorResponse(err: unknown) {
  if (err instanceof CalendarNotConnected) {
    return NextResponse.json({ ok: false, error: "not_connected" }, { status: 412 });
  }
  if (err instanceof CalendarConnectionRevoked) {
    return NextResponse.json({ ok: false, error: "reconnect_required" }, { status: 412 });
  }
  // Google returns 403/404 for foreign or missing events — surface plainly.
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[calendar/events/[id]] error:", err);
  return NextResponse.json({ ok: false, error: msg }, { status: 500 });
}

// PATCH /api/learnhub/calendar/events/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession(request);
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as {
    summary?: string;
    description?: string;
    start?: string;
    end?: string;
  };

  try {
    const cal = await getCalendarClient(session.sub as Id<"learnhub_users">);
    const requestBody: Record<string, unknown> = {};
    if (body.summary !== undefined) requestBody.summary = body.summary;
    if (body.description !== undefined) requestBody.description = body.description;
    if (body.start) requestBody.start = { dateTime: body.start };
    if (body.end) requestBody.end = { dateTime: body.end };

    const res = await cal.events.patch({
      calendarId: "primary",
      eventId: id,
      requestBody,
    });
    return NextResponse.json({ ok: true, event: res.data });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/learnhub/calendar/events/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession(request);
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const cal = await getCalendarClient(session.sub as Id<"learnhub_users">);
    await cal.events.delete({ calendarId: "primary", eventId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
