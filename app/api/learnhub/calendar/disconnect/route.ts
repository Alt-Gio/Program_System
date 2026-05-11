export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";
import type { Id } from "@/convex/_generated/dataModel";

// POST /api/learnhub/calendar/disconnect
// Drops the user's stored Google credentials. We don't revoke the token
// upstream here (the user can do that in their Google account); this only
// makes LearnHub forget.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!url) return NextResponse.json({ ok: false, error: "config_missing" }, { status: 500 });

  const convex = new ConvexHttpClient(url);
  await convex.mutation(api.learnhub_google_credentials.disconnect, {
    userId: session.sub as Id<"learnhub_users">,
  });
  return NextResponse.json({ ok: true });
}
