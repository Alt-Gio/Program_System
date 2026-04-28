export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/learnhub/auth";
import { adminAuth } from "@/lib/learnhub/firebase-admin/config";

// POST /api/learnhub/auth/firebase-token
// Mints a Firebase custom token for the authenticated LearnHub user.
// The client calls signInWithCustomToken() to enable Firestore access.

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = await verifySession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    // Use the Convex user ID as the Firebase UID for Firestore rules
    const firebaseToken = await adminAuth.createCustomToken(session.sub, {
      learnhub: true,
      role: session.role,
    });

    return NextResponse.json({ token: firebaseToken });
  } catch (err) {
    console.error("[LearnHub] Firebase token error:", err);
    return NextResponse.json(
      { error: "Failed to mint Firebase token" },
      { status: 500 }
    );
  }
}
