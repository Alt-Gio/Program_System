import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// ============================================================
// NextAuth – Google OAuth
// Requests offline access so we get a refresh_token.
// The access_token is forwarded into the session for use
// in the /api/sheets-sync route.
// ============================================================

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/spreadsheets",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to false for localhost
      }
    }
  },

  debug: true,

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, account }) {
      // First sign-in — store tokens and expiry
      if (account) {
        return {
          ...token,
          accessToken:  account.access_token,
          refreshToken: account.refresh_token,
          expiresAt:    account.expires_at,        // seconds since epoch
        };
      }

      // Token still valid — return as-is
      const expiresAt = (token.expiresAt as number) ?? 0;
      if (Date.now() < expiresAt * 1000 - 60_000) {
        return token;
      }

      // ── Token expired — auto-refresh using refresh_token ──
      if (!token.refreshToken) {
        return { ...token, error: "RefreshTokenError" };
      }
      try {
        const resp = await fetch("https://oauth2.googleapis.com/token", {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id:     process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type:    "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });
        const refreshed = await resp.json();
        if (!resp.ok) throw refreshed;
        return {
          ...token,
          accessToken:  refreshed.access_token,
          expiresAt:    Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
          error:        undefined,
        };
      } catch (err) {
        console.error("[NextAuth] Token refresh failed:", err);
        return { ...token, error: "RefreshTokenError" };
      }
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).expiresAt   = token.expiresAt;
      (session as any).error       = token.error;
      return session;
    },
  },

  pages: {
    signIn: "/settings", // Redirect to settings instead of default /auth/signin
    error: "/settings",
  },
};

// ── Type augmentation so TypeScript knows about accessToken ──

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
