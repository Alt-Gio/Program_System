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
            "https://www.googleapis.com/auth/spreadsheets.readonly",
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
    async jwt({ token, account, user }) {
      if (account) {
        console.log("[NextAuth] JWT callback - account found:", {
          provider: account.provider,
          hasAccessToken: !!account.access_token,
        });
        token.accessToken  = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt    = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      console.log("[NextAuth] Session callback:", {
        hasToken: !!token,
        hasAccessToken: !!token.accessToken,
      });
      (session as any).accessToken = token.accessToken;
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
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
