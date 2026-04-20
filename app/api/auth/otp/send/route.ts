import { NextRequest, NextResponse } from "next/server";
import { fetchAction, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/otp/send
 * Body: { email, purpose, inviteToken? }
 *
 * Issues a one-time code and emails it via Resend. For purpose
 * "invite_accept" the request must carry a valid invite token whose
 * email matches — this prevents random senders from spamming arbitrary
 * inboxes through our infrastructure.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, purpose, inviteToken } = (await req.json()) as {
      email?: string;
      purpose?: string;
      inviteToken?: string;
    };

    if (!email || !purpose) {
      return NextResponse.json(
        { error: "email and purpose are required" },
        { status: 400 }
      );
    }

    if (purpose === "invite_accept") {
      if (!inviteToken) {
        return NextResponse.json(
          { error: "inviteToken required for invite_accept" },
          { status: 400 }
        );
      }
      const invite = await fetchQuery(api.invites.getByToken, { token: inviteToken });
      if (!invite || invite.used || invite.expired) {
        return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
      }
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ error: "Email doesn't match invite" }, { status: 400 });
      }
    } else {
      // Only invite_accept is currently allowed for unauthenticated OTPs.
      return NextResponse.json({ error: "Unsupported purpose" }, { status: 400 });
    }

    const result = await fetchAction(api.emails.sendOtp, { email, purpose });
    return NextResponse.json({ ok: result.ok, error: result.error });
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.message ?? "Failed to send OTP") },
      { status: 500 }
    );
  }
}
