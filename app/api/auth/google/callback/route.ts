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

const convex = new ConvexHttpClient(process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL!);

const getBaseUrl = (req: Request) =>
  process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

// Sanitize the post-sign-in destination for the DICT (intern/supervisor) flow.
// /learnhub/* routes are gated by the LearnHub cookie, so a dict-session user
// landing there would just be bounced back to /login forever. We also reject
// absolute/protocol-relative URLs to avoid open-redirects. When unsafe, fall
// back to the role's natural landing.
function safeDictCallback(url: string | null | undefined, role: "intern" | "supervisor"): string {
  const fallback = role === "supervisor" ? "/supervisor" : "/intern-portal";
  if (typeof url !== "string" || url.length === 0) return fallback;
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return fallback;
  if (url === "/learnhub" || url.startsWith("/learnhub/")) return fallback;
  return url;
}

// Build an error redirect URL back to the carousel so the user sees what failed
// and can retry on the same portal they picked.
function errorRedirect(
  request: Request,
  role: "intern" | "supervisor",
  code: string,
  detail?: string,
): NextResponse {
  const url = new URL("/login", getBaseUrl(request));
  url.searchParams.set("error", code);
  url.searchParams.set("role", role);
  if (detail) url.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(url);
}

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
    return errorRedirect(request, role, "oauth_denied", error ?? "no_code");
  }

  try {
    const clientId =
      process.env.DICT_GOOGLE_CLIENT_ID ??
      process.env.LEARNHUB_GOOGLE_CLIENT_ID ??
      process.env.GOOGLE_CLIENT_ID;
    const clientSecret =
      process.env.DICT_GOOGLE_CLIENT_SECRET ??
      process.env.LEARNHUB_GOOGLE_CLIENT_SECRET ??
      process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      process.env.DICT_GOOGLE_REDIRECT_URI ??
      new URL("/api/auth/google/callback", getBaseUrl(request)).toString();

    if (!clientId || !clientSecret) {
      const missing = [!clientId && "GOOGLE_CLIENT_ID", !clientSecret && "GOOGLE_CLIENT_SECRET"].filter(Boolean).join(",");
      console.error("[DICT OAuth] Missing env:", missing);
      return errorRedirect(request, role, "config_missing", missing);
    }

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
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[DICT OAuth] Token exchange error:", tokenRes.status, body);
      return errorRedirect(request, role, "token_exchange", `${tokenRes.status}: ${body}`);
    }
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return errorRedirect(request, role, "token_exchange", "no_access_token");
    }

    // Get Google profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      const body = await profileRes.text().catch(() => "");
      console.error("[DICT OAuth] Profile fetch error:", profileRes.status, body);
      return errorRedirect(request, role, "profile_fetch", `${profileRes.status}`);
    }

    const profile = await profileRes.json();
    const { id: googleId, email, name, picture: avatarUrl } = profile;
    if (!googleId || !email) {
      return errorRedirect(request, role, "profile_fetch", "missing_id_or_email");
    }

    // ── 1. Try to sign in to DICT system ──
    const result = await convex.mutation(api.auth.signInWithGoogle, {
      googleId,
      email,
      name,
      avatarUrl,
    });

    if (result) {
      // Role strictness — once a DICT account exists, the user must come in
      // through the matching portal. An intern can't sign in via the
      // supervisor carousel slide (or vice versa).
      if (
        result.user.role !== "admin" &&
        result.user.role !== role
      ) {
        return errorRedirect(
          request,
          role,
          "role_mismatch",
          `existing:${result.user.role}`,
        );
      }

      // Existing DICT account — set session and check for cross-system match
      const identities = await convex.query(api.identities.findByGoogleId, { googleId });
      const hasLearnHub = !!identities.lhUser;

      const landing = safeDictCallback(callbackUrl, result.user.role as "intern" | "supervisor");

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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DICT OAuth] Callback error:", err);
    return errorRedirect(request, role, "server_error", msg);
  }
}

