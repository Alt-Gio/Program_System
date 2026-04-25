"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bell, CheckCircle2, AlertTriangle, XCircle, Mic } from "lucide-react";
import { relativeTime, absoluteTime } from "@/lib/relativeTime";

type Notification = {
  id: string;
  kind: "sync_success" | "sync_partial" | "sync_error" | "import" | "voice";
  title: string;
  subtitle?: string;
  timestamp: number;
  href: string;
};

const LS_KEY = "notifications:lastReadAt";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const syncLogs = useQuery(api.sheetsSync.getSyncLog, { limit: 20 });
  const activityLogs = useQuery(api.import_log.getActivityLog, { limit: 20 });

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setLastReadAt(Number(stored) || 0);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const notifications: Notification[] = useMemo(() => {
    const out: Notification[] = [];

    for (const log of syncLogs ?? []) {
      const kind =
        log.status === "success"
          ? "sync_success"
          : log.status === "partial"
            ? "sync_partial"
            : "sync_error";
      const title =
        kind === "sync_success"
          ? `${log.projectName} synced ${log.rowsAffected} rows`
          : kind === "sync_partial"
            ? `${log.projectName} partially synced (${log.rowsAffected} rows)`
            : `${log.projectName} sync failed`;
      out.push({
        id: `sync-${log._id}`,
        kind,
        title,
        subtitle: log.errorMessage
          ? log.errorMessage.slice(0, 80)
          : `tab ${log.sheetName}`,
        timestamp: log.syncedAt,
        href: "/settings",
      });
    }

    for (const log of (activityLogs ?? []) as any[]) {
      if (log.action === "import" || log.action === "manual_add") {
        const isVoice = Boolean(log.isVoiceInitiated);
        out.push({
          id: `act-${log._id}`,
          kind: isVoice ? "voice" : "import",
          title: log.summary,
          subtitle: log.performedBy ? `by ${log.performedBy}` : undefined,
          timestamp: log.timestamp,
          href: `/import-log?program=${encodeURIComponent(log.program)}`,
        });
      }
    }

    return out.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
  }, [syncLogs, activityLogs]);

  const unread = notifications.filter((n) => n.timestamp > lastReadAt).length;

  const markRead = () => {
    const now = Date.now();
    setLastReadAt(now);
    localStorage.setItem(LS_KEY, String(now));
  };

  const handleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) markRead();
      return next;
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Notifications
              </div>
              <div className="text-[11px] text-gray-500">
                Syncs, imports, and voice actions
              </div>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markRead}
                className="text-[11px] text-gray-400 hover:text-gray-700"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="text-2xl">🔔</div>
                <div className="mt-1 text-sm text-gray-600">
                  No notifications yet
                </div>
                <div className="text-[11px] text-gray-400">
                  Connect a sheet or import data to see activity here.
                </div>
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`flex gap-2.5 border-b border-gray-50 px-4 py-3 transition hover:bg-gray-50 ${
                    n.timestamp > lastReadAt ? "bg-blue-50/40" : ""
                  }`}
                >
                  <NotificationIcon kind={n.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900">
                      {n.title}
                    </div>
                    {n.subtitle && (
                      <div className="truncate text-[11px] text-gray-500">
                        {n.subtitle}
                      </div>
                    )}
                    <div
                      className="mt-0.5 text-[10px] text-gray-400"
                      title={absoluteTime(n.timestamp)}
                    >
                      {relativeTime(n.timestamp)}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/import-log"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-100 px-4 py-2 text-center text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  );
}

function NotificationIcon({ kind }: { kind: Notification["kind"] }) {
  if (kind === "sync_success")
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  if (kind === "sync_partial")
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle className="h-4 w-4" />
      </div>
    );
  if (kind === "sync_error")
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
        <XCircle className="h-4 w-4" />
      </div>
    );
  if (kind === "voice")
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Mic className="h-4 w-4" />
      </div>
    );
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
      <Bell className="h-4 w-4" />
    </div>
  );
}
