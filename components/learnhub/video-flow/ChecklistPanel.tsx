"use client";

import { CalendarClock, CheckCircle2 } from "lucide-react";
import type { VideoSession } from "./types";

type Props = {
  session: VideoSession | null;
  noteCount: number;
  onCompleted: () => void;
  isOwner: boolean;
};

function pad(n: number) { return n.toString().padStart(2, "0"); }

function gcalUtcStamp(date: Date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function buildCalendarUrl(session: VideoSession | null) {
  if (!session) return "#";
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  start.setHours(18);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const title = `Review: ${session.title ?? "Video Flow session"}`;
  const sessionLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/learnhub/video-flow?sessionId=${session._id}`
      : `https://learnhub.local/video-flow?sessionId=${session._id}`;
  const details = [
    `Spaced review for "${session.title ?? "Video Flow session"}".`,
    `Resume in LearnHub Video Flow: ${sessionLink}`,
    session.channelName ? `Channel: ${session.channelName}` : "",
    `Last position: ${session.lastPositionSec}s · Progress: ${session.progressPct}%`,
  ].filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${gcalUtcStamp(start)}/${gcalUtcStamp(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function ChecklistPanel({ session, noteCount, onCompleted, isOwner }: Props) {
  const checklist = [
    { label: "Started a focused session", done: Boolean(session) },
    { label: "Reached 50% progress", done: (session?.progressPct ?? 0) >= 50 },
    { label: "Captured at least 3 notes", done: noteCount >= 3 },
    { label: "Generated or wrote a summary", done: Boolean(session?.summary || session?.aiSummary) },
    { label: "Marked session complete", done: session?.status === "completed" },
  ];

  return (
    <div className="vf-tab-body">
      <div className="vf-checklist">
        {checklist.map((item) => (
          <div key={item.label} className={item.done ? "done" : ""}>
            <CheckCircle2 size={16} /> <span>{item.label}</span>
          </div>
        ))}
      </div>
      <a
        className="vf-review-card vf-review-card-link"
        href={buildCalendarUrl(session)}
        target="_blank"
        rel="noreferrer noopener"
      >
        <CalendarClock size={18} />
        <div>
          <strong>Schedule a review</strong>
          <p>Opens Google Calendar with a pre-filled review event in 7 days that links back to this session.</p>
        </div>
      </a>
      {isOwner && (
        <button className="vf-primary-btn vf-full" onClick={onCompleted}>
          Mark as completed
        </button>
      )}
    </div>
  );
}
