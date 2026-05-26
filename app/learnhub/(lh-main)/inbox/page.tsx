"use client";

/**
 * /learnhub/inbox — full notification history.
 *
 * Reuses the NotificationProvider (Firestore subscription) so this view
 * stays in sync with the bell dropdown in TopNav. The provider already
 * caps at 50 notifications; pagination beyond that is a future cleanup.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "@/components/learnhub/notifications/NotificationProvider";
import type { LHNotification } from "@/components/learnhub/notifications/NotificationProvider";

const EVENT_ICONS: Record<string, string> = {
  mentor_verification_pending: "🛡️",
  mentor_verified: "✅",
  mentor_verification_rejected: "❌",
  mentor_match_available: "✨",
  mentorship_request_received: "🙋",
  mentorship_accepted: "📅",
  flashcards_due: "🎴",
  streak_at_risk: "🔥",
  work_opportunity_posted: "💼",
  certificate_issued: "🎓",
  meet_starting: "🎥",
  meet_live: "🎥",
  new_message: "💬",
  endorsement_request: "📝",
  cohort_announcement: "📣",
  cohort_member_joined: "🤝",
  cohort_milestone_reached: "🎯",
  cohort_started: "🚀",
  cohort_ending_soon: "⏳",
  streak_reminder: "🔥",
  level_up: "⭐",
  challenge_started: "🏆",
  challenge_completed: "🥇",
  path_completed: "🏁",
};

function iconFor(event: string): string {
  return EVENT_ICONS[event] ?? "🔔";
}

export default function InboxPage() {
  const { notifications, unreadCount, markRead, markAllRead, clearNotif } =
    useNotifications();
  const router = useRouter();

  const handleClick = async (notif: LHNotification) => {
    await markRead(notif.id);
    router.push(notif.targetRoute);
  };

  return (
    <div
      className="px-4 py-6 max-w-2xl mx-auto"
      style={{ color: "#e8eaff", fontFamily: "var(--font-dm-sans, 'Inter', sans-serif)" }}
    >
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}
          >
            Inbox
          </p>
          <h1
            className="text-2xl font-bold mt-0.5"
            style={{ color: "#e8eaff", fontFamily: "var(--font-sora)", letterSpacing: "-0.02em" }}
          >
            Notifications
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>
            {notifications.length} total · {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs font-semibold px-3 py-2 rounded-xl"
            style={{
              background: "rgba(91,108,255,0.18)",
              border: "1px solid rgba(91,108,255,0.5)",
              color: "#7c8bff",
              cursor: "pointer",
            }}
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-10 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-4xl mb-2">📭</p>
          <p className="text-sm font-semibold" style={{ color: "#e8eaff" }}>
            No notifications yet
          </p>
          <p className="text-xs mt-1" style={{ color: "#9ba3cc" }}>
            Activity from mentors, work, and your habits will show up here.
          </p>
          <Link
            href="/learnhub/today"
            className="inline-block mt-4 text-xs font-semibold"
            style={{ color: "#7c8bff" }}
          >
            Open your dashboard →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              className="rounded-xl px-4 py-3 flex gap-3 cursor-pointer transition-colors"
              style={{
                background: notif.read ? "rgba(255,255,255,0.02)" : "rgba(91,108,255,0.06)",
                border: `1px solid ${notif.read ? "rgba(255,255,255,0.06)" : "rgba(91,108,255,0.25)"}`,
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1.2 }}>{iconFor(notif.event)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "#e8eaff" }}>
                  {notif.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9ba3cc", lineHeight: 1.45 }}>
                  {notif.body}
                </p>
                <p className="text-[10px] mt-1" style={{ color: "#5c6490" }}>
                  {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearNotif(notif.id);
                }}
                className="shrink-0 text-xs opacity-40 hover:opacity-100"
                style={{ color: "#9ba3cc", background: "none", border: "none", cursor: "pointer" }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
