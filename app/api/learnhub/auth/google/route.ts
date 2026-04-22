import { NextResponse } from "next/server";

// GET /api/learnhub/auth/google
// Redirects the browser to Google's OAuth 2.0 authorization endpoint.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") ?? "/learnhub/feed";

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
    state: encodeURIComponent(callbackUrl),
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return NextResponse.redirect(googleAuthUrl);
}
