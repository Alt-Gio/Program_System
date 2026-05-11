export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server";

// GET /api/learnhub/auth/google
// Redirects the browser to Google's OAuth 2.0 authorization endpoint.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") ?? "/learnhub/feed";
  const rawRole = searchParams.get("role");
  const role =
    rawRole === "student" || rawRole === "mentor" || rawRole === "org_partner"
      ? rawRole
      : null;

  const state = encodeURIComponent(JSON.stringify({ callbackUrl, role }));

  const params = new URLSearchParams({
    client_id: process.env.LEARNHUB_GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.LEARNHUB_GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "profile",
    ].join(" "),
    access_type: "online",
    prompt: "select_account",
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return NextResponse.redirect(googleAuthUrl);
}
