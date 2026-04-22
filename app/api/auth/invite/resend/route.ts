import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery, fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/invite/resend
 * Body: { inviteId }
 *
 * Admin-only. Extends the invite's expiry by 7 days and re-emails the accept link
 * via the Resend-backed Convex action. Returns the accept URL so the admin can
 * also copy it manually if email delivery is flaky.
 */
export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { inviteId } = (await req.json()) as { inviteId?: string };
    if (!inviteId) {
      return NextResponse.json({ error: "inviteId required" }, { status: 400 });
    }

    const invite = await fetchQuery(api.invites.getForAdmin, {
      sessionToken,
      inviteId: inviteId as any,
    });
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json(
        { error: "Cannot resend — invite already used" },
        { status: 400 }
      );
    }

    // Extend the expiry so the new email's link is valid for another 7 days
    await fetchMutation(api.invites.touchExpiry, {
      sessionToken,
      inviteId: inviteId as any,
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
      emailError = String(err?.message ?? "Email dispatch failed");
    }

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      email: invite.email,
      acceptUrl,
      emailSent,
      emailError,
    });
  } catch (error: any) {
    const msg = String(error?.message ?? "Failed to resend invite");
    const status = /admin|authenticated/i.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
