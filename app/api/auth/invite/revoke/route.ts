import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/invite/revoke — admin only. Deletes an unused invite. */
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
    await fetchMutation(api.invites.revoke, {
      sessionToken,
      inviteId: inviteId as any,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const msg = String(error?.message ?? "Failed to revoke invite");
    const status = /admin|authenticated/i.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
