import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await fetchQuery(api.auth.getCurrentUser, { token });
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
