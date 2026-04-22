"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";

interface MeetMetadata {
  meetLink: string;
  scheduledAt?: number;
  durationMinutes?: number;
  isLive?: boolean;
  viewerCount?: number;
}

export function MeetPost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as MeetMetadata;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const isLive = m.isLive ?? false;
  const isUpcoming =
    !isLive && m.scheduledAt !== undefined && m.scheduledAt > now;
  const isPast =
    !isLive && m.scheduledAt !== undefined && m.scheduledAt <= now;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#0d0f1a",
        border: isLive
          ? "1px solid rgba(34,211,160,0.4)"
          : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(34,211,160,0.1)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 10l4.55-2.5A1 1 0 0 1 21 8.5v7a1 1 0 0 1-1.45.9L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"
              stroke="#22d3a0"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className="text-sm font-semibold"
              style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}
            >
              Google Meet Session
            </p>
            {isLive && (
              <span
                className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                style={{
                  background: "rgba(34,211,160,0.15)",
                  color: "#22d3a0",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#22d3a0" }}
                />
                LIVE
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>
            {isLive && m.viewerCount !== undefined
              ? `${m.viewerCount} viewers now`
              : isUpcoming && m.scheduledAt
              ? `Starts ${format(m.scheduledAt, "MMM d 'at' h:mm a")}`
              : isPast && m.scheduledAt
              ? `Session ended ${formatDistanceToNow(m.scheduledAt, { addSuffix: true })}`
              : "Join the session"}
            {m.durationMinutes && ` · ${m.durationMinutes} min`}
          </p>
        </div>

        {isLive && m.viewerCount !== undefined && (
          <div
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ background: "rgba(34,211,160,0.08)", color: "#22d3a0" }}
          >
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {m.viewerCount}
          </div>
        )}
      </div>

      {/* Join button */}
      {!isPast && (
        <div
          className="px-4 pb-4"
        >
          <a
            href={m.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{
              background: isLive ? "#22d3a0" : "#5b6cff",
              color: isLive ? "#0d0f1a" : "#fff",
              fontFamily: "var(--font-sora)",
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path
                d="M15 10l4.55-2.5A1 1 0 0 1 21 8.5v7a1 1 0 0 1-1.45.9L15 14"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <rect
                x="3"
                y="6"
                width="12"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
            {isLive ? "Join Now" : "Open Meeting"}
          </a>
        </div>
      )}
    </div>
  );
}
