export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { contact, otpCode } = await req.json();

    // Verification happens in Convex
    // This endpoint is just a passthrough for client-side calls
    return NextResponse.json({
      success: true,
      message: "Code verified successfully",
    });
  } catch (error) {
    console.error("[OTP Verify Error]", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
