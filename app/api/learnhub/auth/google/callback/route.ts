export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  createSession,
  createPendingProfile,
  SESSION_COOKIE,
  PENDING_COOKIE,
  SESSION_MAX_AGE,
  PENDING_MAX_AGE,
} from "@/lib/learnhub/auth";

const getBaseUrl = (req: Request) =>
  process.env.NEXTAUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  new URL(req.url).origin;

type LhRole = "student" | "mentor" | "org_partner";

// Sanitize the post-sign-in destination. The LearnHub session cookie only
// grants access to /learnhub/* routes. If the caller asked us to land them
// somewhere else (e.g. /dashboard, which is gated by the DICT cookie), the
// DICT middleware would just bounce them right back to /login — looping
// forever. Likewise, reject absolute URLs and protocol-relative paths to
// avoid open-redirects.
function safeLearnhubCallback(url: string): string {
  const fallback = "/learnhub/feed";
  if (typeof url !== "string" || url.length === 0) return fallback;
  // Must be a same-origin, absolute path — no scheme, no //host, no backslashes
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return fallback;
  // Only allow paths that the LearnHub cookie can actually unlock
  if (url === "/learnhub" || url.startsWith("/learnhub/")) return url;
  return fallback;
}

// Build an error redirect URL. If the user started from the role carousel
// (we have `intendedRole`), send them back there with the right portal
// auto-opened. Otherwise fall back to the standalone /learnhub/login.
function errorRedirect(
  request: Request,
  intendedRole: LhRole | null,
  code: string,
  detail?: string,
): NextResponse {
  const base = getBaseUrl(request);
  const target = intendedRole ? "/login" : "/learnhub/login";
  const url = new URL(target, base);
  url.searchParams.set("error", code);
  if (intendedRole) url.searchParams.set("role", intendedRole);
  if (detail) url.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state");
  const oauthErr = searchParams.get("error");

  // State may be JSON ({ callbackUrl, role }) for the carousel flow,
  // or a plain callbackUrl string for the legacy /learnhub/login flow.
  let callbackUrl = "/learnhub/feed";
  let intendedRole: LhRole | null = null;
  if (rawState) {
    try {
      const parsed = JSON.parse(decodeURIComponent(rawState));
      if (typeof parsed?.callbackUrl === "string" && parsed.callbackUrl) {
        callbackUrl = parsed.callbackUrl;
      }
      if (
        parsed?.role === "student" ||
        parsed?.role === "mentor" ||
        parsed?.role === "org_partner"
      ) {
        intendedRole = parsed.role;
      }
    } catch {
      // Legacy: state was just the callbackUrl
      callbackUrl = decodeURIComponent(rawState) || callbackUrl;
    }
  }

  // ── Pre-flight: surface config issues with a clear code instead of a generic OAuth failure ──
  const missing: string[] = [];
  if (!process.env.LEARNHUB_GOOGLE_CLIENT_ID) missing.push("LEARNHUB_GOOGLE_CLIENT_ID");
  if (!process.env.LEARNHUB_GOOGLE_CLIENT_SECRET) missing.push("LEARNHUB_GOOGLE_CLIENT_SECRET");
  if (!process.env.LEARNHUB_GOOGLE_REDIRECT_URI) missing.push("LEARNHUB_GOOGLE_REDIRECT_URI");
  if (!process.env.LEARNHUB_SESSION_SECRET) missing.push("LEARNHUB_SESSION_SECRET");
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) missing.push("NEXT_PUBLIC_CONVEX_URL");
  if (missing.length) {
    console.error("[LearnHub] Missing env:", missing.join(", "));
    return errorRedirect(request, intendedRole, "config_missing", missing.join(","));
  }

  if (oauthErr || !code) {
    return errorRedirect(request, intendedRole, "oauth_denied", oauthErr ?? "no_code");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.LEARNHUB_GOOGLE_CLIENT_ID!,
        client_secret: process.env.LEARNHUB_GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.LEARNHUB_GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[LearnHub] Token exchange error:", tokenRes.status, errBody);
      return errorRedirect(request, intendedRole, "token_exchange", `${tokenRes.status}: ${errBody}`);
    }

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return errorRedirect(request, intendedRole, "token_exchange", "no_access_token");
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!profileRes.ok) {
      const body = await profileRes.text().catch(() => "");
      console.error("[LearnHub] Profile fetch error:", profileRes.status, body);
      return errorRedirect(request, intendedRole, "profile_fetch", `${profileRes.status}`);
    }

    const profile = await profileRes.json();
    const { id: googleId, email, name, picture: avatarUrl } = profile;
    if (!googleId || !email) {
      return errorRedirect(request, intendedRole, "profile_fetch", "missing_id_or_email");
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    let existingUser;
    try {
      existingUser = await convex.query(
        api.learnhub_users.getUserByGoogleId,
        { googleId }
      );
      // Edge case: same email, different Google account. Treat the email as
      // the source of truth so one human can't accumulate parallel mentor /
      // student profiles by swapping Google logins.
      if (!existingUser) {
        existingUser = await convex.query(
          api.learnhub_users.getUserByEmail,
          { email },
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[LearnHub] Convex query error:", msg);
      return errorRedirect(request, intendedRole, "convex_query", msg);
    }

    if (existingUser) {
      // Role strictness — a user who registered as a `student` cannot sign in
      // through the mentor or org-partner portal (and vice versa). We only
      // enforce when the caller actually picked a portal (intendedRole).
      // Admins bypass the check since they need access to every surface.
      if (
        intendedRole &&
        existingUser.role !== "admin" &&
        existingUser.role !== intendedRole
      ) {
        return errorRedirect(
          request,
          intendedRole,
          "role_mismatch",
          `existing:${existingUser.role}`,
        );
      }

      let sessionToken: string;
      try {
        sessionToken = await createSession({
          sub: existingUser._id,
          googleId,
          email,
          name: existingUser.name || name,
          avatarUrl: existingUser.avatarUrl || avatarUrl,
          role: existingUser.role,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[LearnHub] Session create error:", msg);
        return errorRedirect(request, intendedRole, "session_create", msg);
      }

      const dest = safeLearnhubCallback(callbackUrl);
      const res = NextResponse.redirect(new URL(dest, getBaseUrl(request)));
      res.cookies.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    const pendingToken = await createPendingProfile({
      googleId,
      email,
      name,
      avatarUrl,
      ...(intendedRole ? { intendedRole } : {}),
    });

    const res = NextResponse.redirect(
      new URL("/learnhub/onboarding", getBaseUrl(request))
    );
    res.cookies.set(PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
    return res;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LearnHub] OAuth callback error:", err);
    return errorRedirect(request, intendedRole, "server_error", msg);
  }
}
