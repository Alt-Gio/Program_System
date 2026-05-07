
const getBaseUrl = (req: Request) =>
  process.env.NEXTAUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  new URL(req.url).origin;


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
} from "@/lib/learnhub/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET /api/learnhub/auth/google/callback
// Receives the OAuth code from Google, exchanges it for tokens, checks Convex.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/learnhub/login?error=oauth_failed", getBaseUrl(request))
    );
  }

  try {
    // Exchange code for tokens
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
      throw new Error(`Token exchange failed: ${tokenRes.status} — ${errBody}`);
    }`);
    }

    const tokens = await tokenRes.json();

    // Get user profile from Google
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed: ${profileRes.status}`);
    }

    const profile = await profileRes.json();
    const { id: googleId, email, name, picture: avatarUrl } = profile;

    // Check if user exists in Convex
    const existingUser = await convex.query(
      api.learnhub_users.getUserByGoogleId,
      { googleId }
    );

    if (existingUser) {
      // Returning user — create session and redirect to feed
      const sessionToken = await createSession({
        sub: existingUser._id,
        googleId,
        email,
        name,
        avatarUrl,
        role: existingUser.role,
      });

      const callbackUrl =
        state ? decodeURIComponent(state) : "/learnhub/feed";
      const res = NextResponse.redirect(new URL(callbackUrl, getBaseUrl(request)));
      res.cookies.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    // New user — store pending profile and redirect to onboarding
    const pendingToken = await createPendingProfile({
      googleId,
      email,
      name,
      avatarUrl,
    });

    const res = NextResponse.redirect(
      new URL("/learnhub/onboarding", getBaseUrl(request))
    );
    res.cookies.set(PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    console.error("[LearnHub] OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/learnhub/login?error=server_error", getBaseUrl(request))
    );
  }
}
