// Per-user Google Gmail client helper.
//
// Mirrors lib/learnhub/google-calendar.ts shape — same encrypted token
// store, same refresh path, same revoked-token handling. Only the scope
// and the returned Google API client differ.

import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { decryptToken, encryptToken } from "./token-crypto";

export class GmailConnectionRevoked extends Error {
  constructor(public readonly cause?: unknown) {
    super("Google Gmail connection revoked — user must reconnect");
    this.name = "GmailConnectionRevoked";
  }
}

export class GmailNotConnected extends Error {
  constructor() {
    super("User has not connected Google Gmail");
    this.name = "GmailNotConnected";
  }
}

function getConvex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!url) throw new Error("CONVEX URL env not set");
  return new ConvexHttpClient(url);
}

function buildOAuthClient(): OAuth2Client {
  const clientId = process.env.LEARNHUB_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.LEARNHUB_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("LEARNHUB_GOOGLE_CLIENT_ID / _SECRET not set");
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

export async function getGmailClient(
  userId: Id<"learnhub_users">,
): Promise<gmail_v1.Gmail> {
  const convex = getConvex();
  const row = await convex.query(api.learnhub_google_credentials.serverGet, {
    userId,
  });
  if (!row) throw new GmailNotConnected();
  // Defensive scope check: a user who connected for Calendar-only would
  // have a credentials row but no Gmail scope. Throw the dedicated error
  // so the caller can route them to the Gmail connect flow.
  if (!row.scopes.includes("https://www.googleapis.com/auth/gmail.readonly")) {
    throw new GmailNotConnected();
  }

  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: decryptToken(row.accessTokenEnc),
    refresh_token: decryptToken(row.refreshTokenEnc),
    expiry_date: row.expiresAt,
  });

  if (row.expiresAt < Date.now() + 60_000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      if (!credentials.access_token) throw new Error("Refresh returned no access_token");
      const newExpiresAt = credentials.expiry_date ?? Date.now() + 3600_000;
      await convex.mutation(api.learnhub_google_credentials.patchAccess, {
        userId,
        accessTokenEnc: encryptToken(credentials.access_token),
        expiresAt: newExpiresAt,
      });
      oauth2.setCredentials({
        access_token: credentials.access_token,
        refresh_token: decryptToken(row.refreshTokenEnc),
        expiry_date: newExpiresAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid_grant") || msg.includes("invalid_token")) {
        await convex.mutation(api.learnhub_google_credentials.disconnect, { userId });
        throw new GmailConnectionRevoked(err);
      }
      throw err;
    }
  }

  return google.gmail({ version: "v1", auth: oauth2 });
}
