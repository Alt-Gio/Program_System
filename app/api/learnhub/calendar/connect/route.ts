export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";

// GET /api/learnhub/calendar/connect
// Begins the scope-upgrade OAuth flow for the signed-in LearnHub user.
// Adds Calendar scopes, forces a refresh token via access_type=offline +
// prompt=consent, and on return persists the tokens to Convex.

const CAL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export async function GET(request: NextRequest) {
  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  // Must be signed in
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionToken ? await verifySession(sessionToken) : null;
  if (!session) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/learnhub/settings", baseUrl));
  }

  const clientId = process.env.LEARNHUB_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/learnhub/settings?calendar=config_missing", baseUrl)
    );
  }

  // Same OAuth client as login, just different callback path + extra scopes
  const redirectUri = new URL("/api/learnhub/calendar/connect/callback", baseUrl).toString();
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/learnhub/settings";

  const state = encodeURIComponent(
    JSON.stringify({ kind: "calendar_connect", returnTo, sub: session.sub })
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CAL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
