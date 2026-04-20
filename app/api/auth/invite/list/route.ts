import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/invite/list — admin only. Returns pending/used/expired invites. */
export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const invites = await fetchQuery(api.invites.list, { sessionToken });
    return NextResponse.json({ invites });
  } catch (error: any) {
    const msg = String(error?.message ?? "Failed to list invites");
    const status = /admin|authenticated/i.test(msg) ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
