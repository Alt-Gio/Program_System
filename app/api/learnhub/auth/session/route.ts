import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  verifyPendingProfile,
  verifySession,
  createSession,
  SESSION_COOKIE,
  PENDING_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/learnhub/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET /api/learnhub/auth/session
// Returns the pending profile (for onboarding page display) or current session.

export async function GET(request: NextRequest) {
  // Check for active session
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    const session = await verifySession(sessionToken);
    if (session) {
      return NextResponse.json({ type: "session", session });
    }
  }

  // Check for pending profile (onboarding flow)
  const pendingToken = request.cookies.get(PENDING_COOKIE)?.value;
  if (pendingToken) {
    const profile = await verifyPendingProfile(pendingToken);
    if (profile) {
      return NextResponse.json({ type: "pending", profile });
    }
  }

  return NextResponse.json({ type: "none" }, { status: 401 });
}

// POST /api/learnhub/auth/session
// Called from onboarding page — creates the Convex user and sets session cookie.

export async function POST(request: NextRequest) {
  const pendingToken = request.cookies.get(PENDING_COOKIE)?.value;
  if (!pendingToken) {
    return NextResponse.json({ error: "No pending profile" }, { status: 401 });
  }

  const profile = await verifyPendingProfile(pendingToken);
  if (!profile) {
    return NextResponse.json(
      { error: "Invalid or expired pending profile" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { role, school, organization } = body as {
    role: "student" | "mentor" | "org_partner";
    school?: string;
    organization?: string;
  };

  if (!role || !["student", "mentor", "org_partner"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    // Create or get the Convex learnhub user
    const userId = await convex.mutation(api.learnhub_users.createUser, {
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      role,
      school,
      organization,
    });

    // Check for pending certificates matching this email
    // (auto-claim handled separately on profile load)

    const sessionToken = await createSession({
      sub: userId as string,
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      role,
    });

    const res = NextResponse.json({ ok: true, userId });
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
    res.cookies.delete(PENDING_COOKIE);
    return res;
  } catch (err) {
    console.error("[LearnHub] Session creation error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

// DELETE /api/learnhub/auth/session — sign out

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
