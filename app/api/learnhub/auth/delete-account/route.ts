export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  verifySession,
  SESSION_COOKIE,
  PENDING_COOKIE,
} from "@/lib/learnhub/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// POST /api/learnhub/auth/delete-account
//
// Permanently deletes the signed-in LearnHub user. The Convex mutation
// preserves posts/comments/certs the user authored (rendered as
// "Unknown" by the feed) and clears personal records (bookmarks,
// journal, video sessions, OAuth tokens, follower edges). The session
// cookie is cleared so the next request lands on the sign-in screen
// and the same Google account can complete onboarding again as a new
// user.
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const session = await verifySession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let result: { ok: boolean; userDeleted?: boolean; alreadyGone?: boolean; log?: unknown };
  try {
    result = await convex.mutation(api.learnhub_users.deleteAccount, {
      userId: session.sub as Id<"learnhub_users">,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LearnHub] deleteAccount failed:", msg);
    // Surface the real cause instead of "Failed to delete account" —
    // the generic message let users believe the account was gone when
    // the Convex mutation had actually rolled back.
    return NextResponse.json(
      { error: `Delete failed: ${msg}` },
      { status: 500 },
    );
  }

  if (!result.ok || (result.userDeleted === false && !result.alreadyGone)) {
    console.error("[LearnHub] deleteAccount did not remove user doc:", result);
    return NextResponse.json(
      { error: "Account could not be removed. Please contact support." },
      { status: 500 },
    );
  }

  // Only clear cookies once we know the user doc is actually gone —
  // clearing them earlier produced the confusing "I'm signed out but
  // still in the DB" state behind the original bug report.
  const res = NextResponse.json(result);
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
