// Per-user Google Calendar (and Meet) client helper.
//
// Loads the encrypted credentials row for `userId` from Convex, refreshes
// the access token if it's near expiry, and returns an authenticated
// googleapis Calendar client.
//
// Callers (the /api/learnhub/calendar/* routes) should catch the typed
// CalendarConnectionRevoked error and surface "reconnect_required" to UIs.

import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { decryptToken, encryptToken } from "./token-crypto";

export class CalendarConnectionRevoked extends Error {
  constructor(public readonly cause?: unknown) {
    super("Google Calendar connection revoked — user must reconnect");
    this.name = "CalendarConnectionRevoked";
  }
}

export class CalendarNotConnected extends Error {
  constructor() {
    super("User has not connected Google Calendar");
    this.name = "CalendarNotConnected";
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

export async function getCalendarClient(
  userId: Id<"learnhub_users">
): Promise<calendar_v3.Calendar> {
  const convex = getConvex();
  const row = await convex.query(api.learnhub_google_credentials.serverGet, {
    userId,
  });
  if (!row) throw new CalendarNotConnected();

  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: decryptToken(row.accessTokenEnc),
    refresh_token: decryptToken(row.refreshTokenEnc),
    expiry_date: row.expiresAt,
  });

  // Refresh proactively if we're within 60s of expiry
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
      // Most common: refresh token revoked/expired → invalid_grant
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid_grant") || msg.includes("invalid_token")) {
        await convex.mutation(api.learnhub_google_credentials.disconnect, { userId });
        throw new CalendarConnectionRevoked(err);
      }
      throw err;
    }
  }

  return google.calendar({ version: "v3", auth: oauth2 });
}
