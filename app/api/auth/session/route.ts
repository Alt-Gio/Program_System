import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Legacy endpoint — returns the resolved user or null. */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json(null);
  const user = await fetchQuery(api.auth.getCurrentUser, { token });
  if (!user) return NextResponse.json(null);
  return NextResponse.json({ user });
}
