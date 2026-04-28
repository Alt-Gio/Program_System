export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await convex.query(api.learnhub_mentors.getInviteByToken, { token });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.status === "expired") return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  if (invite.status === "accepted") return NextResponse.json({ error: "This invite has already been accepted" }, { status: 409 });
  if (invite.status === "declined") return NextResponse.json({ error: "This invite was declined" }, { status: 410 });
  if (Date.now() > invite.expiresAt) return NextResponse.json({ error: "This invite has expired" }, { status: 410 });

  return NextResponse.json({
    invite: {
      invitedName: invite.invitedName,
      invitedEmail: invite.invitedEmail,
      dictDesignation: invite.dictDesignation,
      programs: invite.programs,
      personalMessage: invite.personalMessage,
      status: invite.status,
      expiresAt: invite.expiresAt,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await convex.query(api.learnhub_mentors.getInviteByToken, { token });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await convex.mutation(api.learnhub_mentors.declineInvite, { token });
  return NextResponse.json({ ok: true });
}
