export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";

// GET /api/learnhub/gmail/connect
//
// Mirrors /api/learnhub/calendar/connect, but the scope set adds Gmail
// read-only on top of the user's existing grants. `include_granted_scopes`
// keeps any prior Calendar scopes attached to the same OAuth client so
// the user doesn't lose Calendar access by upgrading to Gmail.
//
// Only coordinators/admins typically reach this flow (the cert-ingest
// page is the only place we link to it), but we don't enforce the role
// here — the page that links here does the gating, and the Convex
// `learnhub_cert_ingest.setConfig` mutation does the final check.

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export async function GET(request: NextRequest) {
  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionToken ? await verifySession(sessionToken) : null;
  if (!session) {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=/learnhub/admin/cert-ingest", baseUrl),
    );
  }

  const clientId = process.env.LEARNHUB_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/learnhub/admin/cert-ingest?gmail=config_missing", baseUrl),
    );
  }

  const redirectUri = new URL("/api/learnhub/gmail/connect/callback", baseUrl).toString();
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/learnhub/admin/cert-ingest";

  const state = encodeURIComponent(
    JSON.stringify({ kind: "gmail_connect", returnTo, sub: session.sub }),
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
