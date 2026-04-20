import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function doSignout(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await fetchMutation(api.auth.signOut, { token });
    } catch (err) {
      console.warn("[signout] Convex signOut failed:", err);
    }
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: NextRequest) {
  return doSignout(req);
}

export async function GET(req: NextRequest) {
  return doSignout(req);
}
