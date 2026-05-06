import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  createDictPendingCookie,
  DICT_PENDING_COOKIE,
  DICT_PENDING_MAX_AGE,
} from "@/lib/dict-oauth/session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/auth/google/callback
 *
 * Handles the Google OAuth code exchange for DICT intern/supervisor roles.
 *
 * Flow:
 *   1. Exchange code → Google access token
 *   2. Fetch profile from Google
 *   3. Check if Google ID or email exists in DICT `users` table
 *      a. Found  → sign in, set dict-session, redirect to role landing
 *      b. Not found → set pending cookie, redirect to registration form
 *   4. Additionally check LearnHub (for role-picker when cross-system match found)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state");
  const error = searchParams.get("error");

  let role: "intern" | "supervisor" = "intern";
  let callbackUrl = "";

  try {
    if (rawState) {
      const parsed = JSON.parse(decodeURIComponent(rawState));
      role = parsed.role ?? "intern";
      callbackUrl = parsed.callbackUrl ?? "";
    }
  } catch {
    // ignore malformed state
  }

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/login/${role}?error=oauth_failed`, process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin)
    );
  }

  try {
    const clientId =
      process.env.DICT_GOOGLE_CLIENT_ID ??
      process.env.LEARNHUB_GOOGLE_CLIENT_ID ??
      process.env.GOOGLE_CLIENT_ID!;
    const clientSecret =
      process.env.DICT_GOOGLE_CLIENT_SECRET ??
      process.env.LEARNHUB_GOOGLE_CLIENT_SECRET ??
      process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri =
      process.env.DICT_GOOGLE_REDIRECT_URI ??
      new URL("/api/auth/google/callback", process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).toString();

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const tokens = await tokenRes.json();

    // Get Google profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);

    const profile = await profileRes.json();
    const { id: googleId, email, name, picture: avatarUrl } = profile;

    // ── 1. Try to sign in to DICT system ──
    const result = await convex.mutation(api.auth.signInWithGoogle, {
      googleId,
      email,
      name,
      avatarUrl,
    });

    if (result) {
      // Existing DICT account — set session and check for cross-system match
      const identities = await convex.query(api.identities.findByGoogleId, { googleId });
      const hasLearnHub = !!identities.lhUser;

      const landing = callbackUrl || landingForRole(result.user.role as "intern" | "supervisor");

      // Cross-system: has both DICT + LearnHub accounts → offer role picker
      if (hasLearnHub) {
        const pickUrl = new URL("/login/pick-role", process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin);
        pickUrl.searchParams.set("dictRole", result.user.role);
        pickUrl.searchParams.set("lhRole", identities.lhUser!.role);
        const res = NextResponse.redirect(pickUrl);
        // Set the dict-session now; role picker will also set learnhub_session if chosen
        res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
        return res;
      }

      const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
      const res = NextResponse.redirect(new URL(landing, baseUrl));
      res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
      return res;
    }

    // ── 2. No DICT account found — check LearnHub then redirect to register ──
    const identities = await convex.query(api.identities.findByGoogleId, { googleId });

    if (identities.lhUser) {
      // Has LearnHub but no DICT — ask if they want to also register as intern/supervisor
      const pickUrl = new URL("/login/pick-role", process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin);
      pickUrl.searchParams.set("lhRole", identities.lhUser.role);
      pickUrl.searchParams.set("wantsDictRole", role);
      pickUrl.searchParams.set("googleId", googleId);
      pickUrl.searchParams.set("googleName", name);
      pickUrl.searchParams.set("googleEmail", email);
      return NextResponse.redirect(pickUrl);
    }

    // Completely new user → registration form
    const pendingToken = await createDictPendingCookie({
      googleId,
      email,
      name,
      avatarUrl: avatarUrl ?? "",
      intendedRole: role,
    });

    const res = NextResponse.redirect(
      new URL(`/login/register/${role}`, process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin)
    );
    res.cookies.set(DICT_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DICT_PENDING_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    console.error("[DICT OAuth] Callback error:", err);
    return NextResponse.redirect(
      new URL(`/login/${role}?error=server_error`, process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin)
    );
  }
}

function landingForRole(role: "intern" | "supervisor"): string {
  return role === "supervisor" ? "/supervisor" : "/intern-portal";
}
