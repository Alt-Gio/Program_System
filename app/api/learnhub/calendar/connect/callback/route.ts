export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";
import { encryptToken } from "@/lib/learnhub/token-crypto";
import type { Id } from "@/convex/_generated/dataModel";

// GET /api/learnhub/calendar/connect/callback
// Exchanges the OAuth code, encrypts the tokens, and persists them.

const getBase = (req: NextRequest) =>
  process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

function errorRedirect(req: NextRequest, returnTo: string, code: string, detail?: string) {
  const url = new URL(returnTo, getBase(req));
  url.searchParams.set("calendar", "error");
  url.searchParams.set("reason", code);
  if (detail) url.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const baseUrl = getBase(request);
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawState = searchParams.get("state");
  const oauthErr = searchParams.get("error");

  let returnTo = "/learnhub/settings";
  let expectedSub: string | null = null;
  if (rawState) {
    try {
      const parsed = JSON.parse(decodeURIComponent(rawState));
      if (typeof parsed?.returnTo === "string") returnTo = parsed.returnTo;
      if (typeof parsed?.sub === "string") expectedSub = parsed.sub;
    } catch {
      // ignore — fall back to defaults
    }
  }

  // Must still be signed in as the same user who began the flow
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionToken ? await verifySession(sessionToken) : null;
  if (!session) return errorRedirect(request, returnTo, "not_signed_in");
  if (expectedSub && expectedSub !== session.sub) {
    return errorRedirect(request, returnTo, "session_mismatch");
  }

  if (oauthErr || !code) {
    return errorRedirect(request, returnTo, "oauth_denied", oauthErr ?? "no_code");
  }

  const clientId = process.env.LEARNHUB_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.LEARNHUB_GOOGLE_CLIENT_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!clientId || !clientSecret || !convexUrl) {
    return errorRedirect(request, returnTo, "config_missing");
  }

  const redirectUri = new URL("/api/learnhub/calendar/connect/callback", baseUrl).toString();

  try {
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
      console.error("[Calendar OAuth] token exchange:", tokenRes.status, body);
      return errorRedirect(request, returnTo, "token_exchange", `${tokenRes.status}`);
    }

    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    if (!tokens.access_token || !tokens.refresh_token) {
      // prompt=consent should have forced a refresh token. If it's missing
      // the user likely revoked partway through. Send them to re-consent.
      return errorRedirect(request, returnTo, "no_refresh_token");
    }

    const accessTokenEnc = encryptToken(tokens.access_token);
    const refreshTokenEnc = encryptToken(tokens.refresh_token);
    const expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;
    const scopes = (tokens.scope ?? "").split(" ").filter(Boolean);

    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.learnhub_google_credentials.upsert, {
      userId: session.sub as Id<"learnhub_users">,
      accessTokenEnc,
      refreshTokenEnc,
      expiresAt,
      scopes,
    });

    const url = new URL(returnTo, baseUrl);
    url.searchParams.set("calendar", "connected");
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Calendar OAuth] callback error:", err);
    return errorRedirect(request, returnTo, "server_error", msg);
  }
}
