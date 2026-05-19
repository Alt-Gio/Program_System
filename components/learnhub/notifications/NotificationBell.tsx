"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "./NotificationProvider";
import type { LHNotification } from "./NotificationProvider";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, clearNotif } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleClick = async (notif: LHNotification) => {
    await markRead(notif.id);
    setOpen(false);
    router.push(notif.targetRoute);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 transition-colors"
        style={{ color: "#9ba3cc" }}
        aria-label="Notifications"
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
          <path
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1"
            style={{ background: "#ff5f6d", color: "#fff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-80 rounded-2xl overflow-hidden z-50"
          style={{
            background: "#131626",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}
            >
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs"
                style={{ color: "#5b6cff" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {notifications.length === 0 ? (
              <p
                className="text-sm text-center py-8"
                style={{ color: "#5c6490" }}
              >
                No notifications yet
              </p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    background: notif.read
                      ? "transparent"
                      : "rgba(91,108,255,0.06)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                  onClick={() => handleClick(notif)}
                >
                  {!notif.read && (
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ background: "#5b6cff" }}
                    />
                  )}
                  {notif.read && <span className="mt-1.5 w-2 h-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "#e8eaff" }}
                    >
                      {notif.title}
                    </p>
                    <p
                      className="text-xs mt-0.5 line-clamp-2"
                      style={{ color: "#9ba3cc" }}
                    >
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
                    className="shrink-0 text-xs mt-0.5 opacity-40 hover:opacity-100"
                    style={{ color: "#9ba3cc" }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2.5 text-center"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/learnhub/inbox");
              }}
              className="text-xs font-semibold"
              style={{ color: "#7c8bff", background: "none", border: "none", cursor: "pointer" }}
            >
              See all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
