import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google?role=intern|supervisor
 *
 * Initiates Google OAuth for DICT intern/supervisor self-registration.
 * The role is encoded in `state` so the callback knows what role to claim.
 * Uses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as the NextAuth
 * setup (or the LEARNHUB_ prefixed ones if a dedicated app is preferred).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") ?? "intern";
  const callbackUrl = searchParams.get("callbackUrl") ?? "";

  const allowedRoles = ["intern", "supervisor"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const clientId =
    process.env.DICT_GOOGLE_CLIENT_ID ??
    process.env.LEARNHUB_GOOGLE_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID!;

  const redirectUri =
    process.env.DICT_GOOGLE_REDIRECT_URI ??
    new URL("/api/auth/google/callback", request.url).toString();

  const state = encodeURIComponent(JSON.stringify({ role, callbackUrl }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
