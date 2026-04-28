export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { adminFirestore, adminMessaging } from "@/lib/learnhub/firebase-admin/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Events that also get FCM push (not just in-app bell)
const PUSH_EVENTS = new Set([
  "meet_starting",
  "meet_live",
  "certificate_issued",
  "work_applied",
  "work_status_changed",
  "work_completed",
  "endorsement_request",
  "new_message",
  "streak_reminder",
  "cohort_announcement",
]);

interface SendNotifBody {
  userId: string;
  event: string;
  title: string;
  body: string;
  targetRoute: string;
  data?: Record<string, string>;
}

// POST /api/learnhub/notifications/send
// Called from Convex HTTP actions or server-side logic only.
// Writes Firestore notification + conditionally sends FCM push.

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-learnhub-secret");
  if (secret !== process.env.LH_FORMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SendNotifBody = await request.json();
  const { userId, event, title, body: notifBody, targetRoute, data } = body;

  if (!userId || !event || !title || !notifBody) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const notifId = crypto.randomUUID();

  try {
    // 1. Write to Firestore for in-app bell
    await adminFirestore
      .collection("learnhub_notifications")
      .doc(userId)
      .collection("items")
      .doc(notifId)
      .set({
        event,
        title,
        body: notifBody,
        targetRoute,
        data: data ?? {},
        read: false,
        createdAt: Date.now(),
      });

    // 2. Increment unread count in Convex
    // (best-effort — don't fail the whole request if this fails)
    try {
      const user = await convex.query(api.learnhub_users.getUser, {
        id: userId as never,
      });
      if (user) {
        await convex.mutation(api.learnhub_users.awardXp, {
          userId: userId as never,
          amount: 0,
          reason: "notif_count_placeholder",
        });
      }
    } catch {
      // non-critical
    }

    // 3. Send FCM push if event qualifies
    if (PUSH_EVENTS.has(event)) {
      let user: { fcmTokens: string[]; notifPrefs: { pushEnabled: boolean; quietHoursFrom?: string; quietHoursTo?: string } } | null = null;
      try {
        user = await convex.query(api.learnhub_users.getUser, {
          id: userId as never,
        }) as typeof user;
      } catch {
        user = null;
      }

      if (user?.notifPrefs.pushEnabled && user.fcmTokens.length > 0) {
        // Check quiet hours
        const now = new Date();
        const timeStr = now.toTimeString().slice(0, 5); // HH:MM
        const { quietHoursFrom, quietHoursTo } = user.notifPrefs;
        const inQuietHours =
          quietHoursFrom &&
          quietHoursTo &&
          timeStr >= quietHoursFrom &&
          timeStr < quietHoursTo;

        if (!inQuietHours) {
          try {
            await adminMessaging.sendEachForMulticast({
              tokens: user.fcmTokens,
              notification: { title, body: notifBody },
              data: { targetRoute, ...(data ?? {}) },
              webpush: {
                fcmOptions: { link: targetRoute },
              },
            });
          } catch (fcmErr) {
            console.error("[LearnHub] FCM send error:", fcmErr);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, notifId });
  } catch (err) {
    console.error("[LearnHub] Notification send error:", err);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
