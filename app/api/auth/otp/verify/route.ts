import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/otp/verify
 * Body: { email, purpose, code }
 *
 * Returns { success: true } on match. Does not by itself grant auth — the
 * redeem-invite flow re-verifies server-side before creating the user.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, purpose, code } = (await req.json()) as {
      email?: string;
      purpose?: string;
      code?: string;
    };
    if (!email || !purpose || !code) {
      return NextResponse.json(
        { error: "email, purpose, code are all required" },
        { status: 400 }
      );
    }
    const result = await fetchMutation(api.otp.verify, {
      contact: email,
      purpose,
      code,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.message ?? "Failed to verify OTP") },
      { status: 500 }
    );
  }
}
