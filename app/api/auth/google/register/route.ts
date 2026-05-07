import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
const convex = new ConvexHttpClient(
  process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL!
);
import {
  verifyDictPendingCookie,
  DICT_PENDING_COOKIE,
} from "@/lib/dict-oauth/session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/google/register
 *
 * Completes DICT registration for a Google OAuth user (intern or supervisor).
 * Reads the pending-profile cookie, validates it, then calls registerWithGoogle.
 *
 * Body: { fullName: string }  (pre-filled from Google, user can edit)
 */
export async function POST(req: NextRequest) {
  try {
    const pendingToken = req.cookies.get(DICT_PENDING_COOKIE)?.value;
    if (!pendingToken) {
      return NextResponse.json(
        { error: "Registration session expired. Please sign in again." },
        { status: 400 }
      );
    }

    const pending = await verifyDictPendingCookie(pendingToken);
    if (!pending) {
      return NextResponse.json(
        { error: "Invalid registration token. Please sign in again." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const fullName: string = (body.fullName ?? pending.name).trim();
    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    const result = await convex.mutation(api.auth.registerWithGoogle, {
      googleId: pending.googleId,
      email: pending.email,
      fullName,
      avatarUrl: pending.avatarUrl,
      role: pending.intendedRole,
    });

    const res = NextResponse.json({
      success: true,
      user: result.user,
      role: result.user.role,
    });

    // Set the dict-session cookie
    res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
    // Clear the pending cookie
    res.cookies.set(DICT_PENDING_COOKIE, "", { maxAge: 0, path: "/" });

    return res;
  } catch (error: any) {
    const msg = String(error?.message ?? "Registration failed");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
