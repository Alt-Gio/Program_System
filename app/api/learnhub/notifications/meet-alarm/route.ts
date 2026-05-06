export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { adminFirestore } from "@/lib/learnhub/firebase-admin/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/learnhub/notifications/meet-alarm
 *
 * Called by the PostComposer client after a mentor successfully creates
 * a "meet" post. Writes an in-app Firestore notification to ALL students
 * so they see it in the notification bell.
 *
 * Auth: reads the learnhub_session cookie (handled by middleware or
 * the caller must be signed in). We don't enforce mentor-only here —
 * the UI already gates Meet creation; this is best-effort broadcast.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetTitle, scheduledAt, postId, authorName } = body as {
      meetTitle?: string;
      scheduledAt?: number;
      postId?: string;
      authorName?: string;
    };

    // Fetch all student users from Convex
    const allUsers: Array<{ _id: string; role?: string; name?: string }> =
      await convex.query(api.learnhub_users.listUsers, {});

    const students = allUsers.filter((u) => u.role === "student");

    const timeStr = scheduledAt
      ? new Date(scheduledAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "soon";

    const title = meetTitle || "New Google Meet scheduled";
    const notifBody = `${authorName ?? "A mentor"} scheduled a session for ${timeStr}. Tap to join.`;

    const batch = adminFirestore.batch();
    const createdAt = Date.now();

    for (const student of students) {
      const notifId = crypto.randomUUID();
      const ref = adminFirestore
        .collection("learnhub_notifications")
        .doc(student._id)
        .collection("items")
        .doc(notifId);

      batch.set(ref, {
        event: "meet_scheduled",
        title,
        body: notifBody,
        targetRoute: postId ? `/learnhub/feed#post-${postId}` : "/learnhub/feed",
        data: { postId: postId ?? "" },
        read: false,
        createdAt,
      });
    }

    await batch.commit();

    return NextResponse.json({ ok: true, notified: students.length });
  } catch (err) {
    console.error("[meet-alarm] error:", err);
    return NextResponse.json(
      { error: "Failed to send meet alarm" },
      { status: 500 }
    );
  }
}
