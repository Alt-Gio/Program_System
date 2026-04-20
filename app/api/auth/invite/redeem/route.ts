import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/invite/redeem
 * Body: { inviteToken, fullName, password, otpCode }
 *
 * Flow: verify OTP for the invite's email (purpose=invite_accept) → create
 * user via the Convex helper → set dict-session cookie.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      inviteToken?: string;
      fullName?: string;
      password?: string;
      otpCode?: string;
    };
    const { inviteToken, fullName, password, otpCode } = body;

    if (!inviteToken || !fullName || !password || !otpCode) {
      return NextResponse.json(
        { error: "inviteToken, fullName, password, otpCode are all required" },
        { status: 400 }
      );
    }

    const invite = await fetchQuery(api.invites.getByToken, { token: inviteToken });
    if (!invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
    }
    if (invite.used) {
      return NextResponse.json({ error: "Invite already used" }, { status: 400 });
    }
    if (invite.expired) {
      return NextResponse.json({ error: "Invite expired" }, { status: 400 });
    }

    const otpResult = await fetchMutation(api.otp.verify, {
      contact: invite.email,
      purpose: "invite_accept",
      code: otpCode,
    });
    if (!otpResult.success) {
      return NextResponse.json(
        { error: otpResult.error ?? "OTP verification failed" },
        { status: 400 }
      );
    }

    const result = await fetchMutation(api.auth._createUserFromInvite, {
      inviteToken,
      password,
      fullName,
    });

    const res = NextResponse.json({ success: true, user: result.user });
    res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
    return res;
  } catch (error: any) {
    const msg = String(error?.message ?? "Failed to redeem invite");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
