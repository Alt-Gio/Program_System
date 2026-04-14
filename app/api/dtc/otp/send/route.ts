import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { contact, contactType, purpose, name } = await req.json();

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // In production, integrate with SMS/Email service (Twilio, SendGrid, etc.)
    // For now, just log it
    console.log(`[OTP] Code for ${contact}: ${code}`);

    // TODO: Send actual SMS/Email
    // if (contactType === 'email') {
    //   await sendEmail(contact, code, name);
    // } else {
    //   await sendSMS(contact, code, name);
    // }

    // Store in Convex via client-side mutation
    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${contact}`,
      // In dev mode, return code for testing
      ...(process.env.NODE_ENV === "development" && { code }),
    });
  } catch (error) {
    console.error("[OTP Send Error]", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
