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
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[calendar/events] error:", err);
  return NextResponse.json({ ok: false, error: msg }, { status: 500 });
}

// GET /api/learnhub/calendar/events?timeMin=ISO&timeMax=ISO
export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const timeMin = searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax =
    searchParams.get("timeMax") ?? new Date(Date.now() + 7 * 86400_000).toISOString();

  try {
    const cal = await getCalendarClient(session.sub as Id<"learnhub_users">);
    const res = await cal.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });
    return NextResponse.json({ ok: true, events: res.data.items ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/learnhub/calendar/events
//   body: { summary, description?, start: ISO, end: ISO, withMeet?: boolean, attendees?: string[] }
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    summary?: string;
    description?: string;
    start?: string;
    end?: string;
    withMeet?: boolean;
    attendees?: string[];
  };

  if (!body.summary || !body.start || !body.end) {
    return NextResponse.json(
      { ok: false, error: "summary, start, end are required" },
      { status: 400 }
    );
  }

  try {
    const cal = await getCalendarClient(session.sub as Id<"learnhub_users">);
    const requestBody = {
      summary: body.summary,
      description: body.description,
      start: { dateTime: body.start },
      end: { dateTime: body.end },
      attendees: body.attendees?.map((email) => ({ email })),
      ...(body.withMeet
        ? {
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    };

    const res = await cal.events.insert({
      calendarId: "primary",
      conferenceDataVersion: body.withMeet ? 1 : 0,
      requestBody,
    });

    return NextResponse.json({ ok: true, event: res.data });
  } catch (err) {
    return errorResponse(err);
  }
}
