export const runtime = "nodejs"
export const dynamic = "force-dynamic"
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
  const {
    role,
    school,
    organization,
    interests,
    skillLevels: rawSkillLevels,
    goals: rawGoals,
    hoursPerWeek: rawHoursPerWeek,
    region: rawRegion,
    province: rawProvince,
    municipality: rawMunicipality,
    name: rawName,
  } = body as {
    role: "student" | "mentor" | "org_partner";
    school?: string;
    organization?: string;
    interests?: string[];
    skillLevels?: Record<string, string>;
    goals?: string[];
    hoursPerWeek?: string;
    region?: string;
    province?: string;
    municipality?: string;
    name?: string;
  };

  if (!role || !["student", "mentor", "org_partner"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // `profile.intendedRole` is a portal hint — it pre-selects the role on the
  // onboarding screen so users who clicked "Sign in as Mentor" don't have to
  // re-pick it. We deliberately do NOT enforce it as a hard gate here: that
  // produced the "This Google account was started under the mentor portal"
  // 409 whenever a user changed their mind on the onboarding form (e.g.
  // clicked a mentor link by mistake and wanted to sign up as student).
  //
  // Privilege gating still applies downstream:
  //   • `createUser` rejects role changes for existing accounts via
  //     ROLE_CONFLICT, so users can't quietly swap roles after the fact.
  //   • Actual mentor capabilities require `mentorStatus === "verified"`
  //     (set by the mentor-invite acceptance flow), not just role="mentor".
  // The portal-mismatch block was redundant defense and is removed.
  if (profile.intendedRole && profile.intendedRole !== role) {
    console.warn(
      `[LearnHub] onboarding role override: intendedRole=${profile.intendedRole} actual=${role} for ${profile.email}`,
    );
  }

  const cleanInterests = Array.isArray(interests)
    ? interests.filter((t) => typeof t === "string" && t.length > 0 && t.length <= 64).slice(0, 8)
    : undefined;

  const ALLOWED_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
  const cleanSkillLevels = rawSkillLevels && typeof rawSkillLevels === "object"
    ? Object.fromEntries(
        Object.entries(rawSkillLevels)
          .filter(([k, v]) =>
            typeof k === "string" &&
            k.length > 0 &&
            k.length <= 64 &&
            typeof v === "string" &&
            ALLOWED_LEVELS.has(v),
          )
          .slice(0, 8),
      ) as Record<string, "beginner" | "intermediate" | "advanced">
    : undefined;

  const ALLOWED_GOALS = new Set(["find_work", "learn", "build_portfolio", "mentor", "network"]);
  const cleanGoals = Array.isArray(rawGoals)
    ? (rawGoals.filter((g) => typeof g === "string" && ALLOWED_GOALS.has(g)).slice(0, 5) as Array<
        "find_work" | "learn" | "build_portfolio" | "mentor" | "network"
      >)
    : undefined;

  const ALLOWED_HOURS = new Set(["<5", "5-10", "10-20", "20+"]);
  const cleanHoursPerWeek =
    typeof rawHoursPerWeek === "string" && ALLOWED_HOURS.has(rawHoursPerWeek)
      ? (rawHoursPerWeek as "<5" | "5-10" | "10-20" | "20+")
      : undefined;

  const clampText = (s: unknown, max: number): string | undefined => {
    if (typeof s !== "string") return undefined;
    const t = s.trim().slice(0, max);
    return t.length > 0 ? t : undefined;
  };
  const cleanRegion = clampText(rawRegion, 64);
  const cleanProvince = clampText(rawProvince, 64);
  const cleanMunicipality = clampText(rawMunicipality, 80);

  const trimmedName = typeof rawName === "string" ? rawName.trim().slice(0, 80) : "";
  const displayName = trimmedName || profile.name;
  if (!displayName) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }

  try {
    // Create or get the Convex learnhub user
    const userId = await convex.mutation(api.learnhub_users.createUser, {
      googleId: profile.googleId,
      email: profile.email,
      name: displayName,
      avatarUrl: profile.avatarUrl,
      role,
      school,
      organization,
      interests: cleanInterests,
      skillLevels: cleanSkillLevels,
      goals: cleanGoals,
      hoursPerWeek: cleanHoursPerWeek,
      region: cleanRegion,
      province: cleanProvince,
      municipality: cleanMunicipality,
    });

    // Check for pending certificates matching this email
    // (auto-claim handled separately on profile load)

    const sessionToken = await createSession({
      sub: userId as string,
      googleId: profile.googleId,
      email: profile.email,
      name: displayName,
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LearnHub] Session creation error:", err);
    // Map the Convex role-strictness errors to a 409 with a user-readable message.
    if (msg.includes("ROLE_CONFLICT")) {
      const existing = msg.split("registered as ")[1] ?? "another role";
      return NextResponse.json(
        { error: `This Google account is already registered as ${existing}. Sign in through that portal instead.` },
        { status: 409 },
      );
    }
    if (msg.includes("EMAIL_TAKEN")) {
      const existing = msg.split("registered as ")[1] ?? "another role";
      return NextResponse.json(
        { error: `This email is already registered as ${existing}. Sign in through that portal instead.` },
        { status: 409 },
      );
    }
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
