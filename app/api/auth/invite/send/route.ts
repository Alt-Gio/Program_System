import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/invite/send — admin creates an invite and emails it. */
export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { email, role } = (await req.json()) as { email?: string; role?: string };
    if (!email || !role) {
      return NextResponse.json({ error: "email and role are required" }, { status: 400 });
    }

    const invite = await fetchMutation(api.invites.create, {
      sessionToken,
      email,
      role,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      new URL(req.url).origin;

    const acceptUrl = `${appUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(invite.token)}`;

    let emailSent = false;
    let emailError: string | undefined;
    try {
      const emailResult = await fetchAction(api.emails.sendInvite, {
        email: invite.email,
        role: invite.role,
        token: invite.token,
        appUrl,
      });
      emailSent = !!emailResult.ok;
      emailError = emailResult.error;
    } catch (err: any) {
      // Invite row was already created; surface the email error without failing the whole request
      emailError = String(err?.message ?? "Email dispatch failed");
    }

    return NextResponse.json({
      success: true,
      inviteId: invite.inviteId,
      email: invite.email,
      role: invite.role,
      acceptUrl,
      emailSent,
      emailError,
    });
  } catch (error: any) {
    const msg = String(error?.message ?? "Failed to send invite");
    const status = /admin|authenticated/i.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
