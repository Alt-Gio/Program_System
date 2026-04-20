import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string = body.email ?? body.username ?? "";
    const password: string = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await fetchMutation(api.auth.signIn, {
      email,
      password,
    });

    const res = NextResponse.json({
      success: true,
      user: result.user,
    });
    res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
    return res;
  } catch (error: any) {
    const msg = String(error?.message ?? "Sign-in failed");
    // Convex throws bare Error; surface a clean 401 for credential errors.
    const status =
      /invalid|disabled|not authenticated/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
