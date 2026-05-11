"use client";

/**
 * CalendarPopover — drop-down panel from the TopNav calendar icon.
 *
 * Primary data source: the user's real Google Calendar via
 * GET /api/learnhub/calendar/events. Falls back to feed Meet-posts when
 * Calendar isn't connected (back-compat with the previous popover).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Calendar, ExternalLink, MapPin, X } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { findDtcOffice } from "@/lib/learnhub/dtc-offices";
import { DtcOfficeModal } from "@/components/learnhub/dtc/DtcOfficeModal";

interface CalendarPopoverProps {
  open: boolean;
  onClose: () => void;
}

interface GcalEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  hangoutLink?: string | null;
  htmlLink?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
}

type EventRow = {
  id: string;
  title: string;
  host?: string;
  meetLink: string;
  scheduledAt: number;
  endAt?: number;
  isLive: boolean;
  source: "gcal" | "feed";
  dtcOffice?: string;
};

export function CalendarPopover({ open, onClose }: CalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [officeFocus, setOfficeFocus] = useState<string | null>(null);
  const [showOfficeModal, setShowOfficeModal] = useState(false);

  // Convex feed — fallback used when Google Calendar isn't connected
  const feed = useQuery(api.learnhub_posts.listFeedWithAuthors, open ? { limit: 50 } : "skip");

  // Real Google Calendar events
  const [gcalState, setGcalState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; events: GcalEvent[] }
    | { kind: "not_connected" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    setGcalState({ kind: "loading" });
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 14 * 86400_000).toISOString();
    fetch(`/api/learnhub/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`, {
      signal: ctl.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.ok) {
          if (data?.error === "not_connected" || data?.error === "reconnect_required") {
            setGcalState({ kind: "not_connected" });
          } else {
            setGcalState({ kind: "error", message: data?.error ?? "Failed to load calendar" });
          }
          return;
        }
        setGcalState({ kind: "ready", events: (data.events ?? []) as GcalEvent[] });
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setGcalState({ kind: "error", message: String(err) });
        }
      });
    return () => ctl.abort();
  }, [open]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const events: EventRow[] = useMemo(() => {
    const now = Date.now();
    if (gcalState.kind === "ready") {
      return gcalState.events
        .map<EventRow | null>((ev) => {
          const startStr = ev.start?.dateTime ?? ev.start?.date;
          if (!startStr) return null;
          const start = new Date(startStr).getTime();
          const endStr = ev.end?.dateTime ?? ev.end?.date;
          const end = endStr ? new Date(endStr).getTime() : undefined;
          return {
            id: ev.id ?? `g-${start}`,
            title: ev.summary ?? "Untitled",
            meetLink: ev.hangoutLink ?? ev.htmlLink ?? "#",
            scheduledAt: start,
            endAt: end,
            isLive: end ? start <= now && now <= end : false,
            source: "gcal",
          };
        })
        .filter((x): x is EventRow => x !== null)
        .sort((a, b) => a.scheduledAt - b.scheduledAt);
    }

    // Fallback: legacy feed-based Meet posts
    if (gcalState.kind === "not_connected" && feed) {
      const meetPosts = feed.filter((p) => p.type === "meet");
      return meetPosts
        .map<EventRow>((p) => {
          const m = (p.metadata ?? {}) as Record<string, unknown>;
          const scheduledAt = (m.scheduledAt as number) ?? p.createdAt;
          return {
            id: p._id as string,
            title: (m.title as string) || (p.content?.slice(0, 60) ?? "Meeting"),
            host: p.author?.name ?? "Unknown",
            meetLink: (m.meetLink as string) ?? "#",
            scheduledAt,
            isLive: Boolean(m.isLive),
            source: "feed",
            dtcOffice: m.dtcOffice as string | undefined,
          };
        })
        .sort((a, b) => a.scheduledAt - b.scheduledAt);
    }

    return [];
  }, [gcalState, feed]);

  const liveCount = events.filter((e) => e.isLive).length;
  const upcomingCount = events.filter((e) => !e.isLive && e.scheduledAt > Date.now()).length;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    if (isToday(ts)) return `Today, ${format(d, "h:mm a")}`;
    if (isTomorrow(ts)) return `Tomorrow, ${format(d, "h:mm a")}`;
    return format(d, "MMM d · h:mm a");
  };

  if (!open) return null;

  return (
    <>
      <div className="lh-popover-wrap" ref={popoverRef}>
        <div className="lh-popover">
          <header className="lh-popover-header">
            <div>
              <p className="lh-popover-title">
                <Calendar size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                Calendar
              </p>
              <p className="lh-popover-sub">
                {gcalState.kind === "ready"
                  ? `${liveCount > 0 ? `${liveCount} live now · ` : ""}${upcomingCount} upcoming`
                  : gcalState.kind === "not_connected"
                  ? "Showing LearnHub meetings"
                  : gcalState.kind === "error"
                  ? "Couldn't load calendar"
                  : "Loading…"}
              </p>
            </div>
            <button type="button" onClick={onClose} className="lh-popover-close" aria-label="Close">
              <X size={14} />
            </button>
          </header>

          <div className="lh-popover-list">
            {gcalState.kind === "loading" && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="lh-skeleton" style={{ height: 56, borderRadius: 10 }} />
                ))}
              </div>
            )}

            {gcalState.kind === "not_connected" && (
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--lh-surface-3)" }}>
                <a
                  href="/learnhub/settings"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(91,108,255,0.1)",
                    border: "1px solid rgba(91,108,255,0.3)",
                    color: "#7c8bff",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Connect Google Calendar →
                </a>
                <p style={{ fontSize: 11, color: "var(--lh-text-3)", marginTop: 8, textAlign: "center" }}>
                  See your real calendar here. For now, showing LearnHub meetings.
                </p>
              </div>
            )}

            {gcalState.kind === "error" && (
              <div style={{ padding: 16, fontSize: 12, color: "#ff5f6d" }}>
                {gcalState.message}
              </div>
            )}

            {(gcalState.kind === "ready" || gcalState.kind === "not_connected") &&
              events.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--lh-text-3)", fontSize: 13 }}>
                  No upcoming events.
                </div>
              )}

            {events.map((ev) => {
              const office = ev.dtcOffice ? findDtcOffice(ev.dtcOffice) : null;
              return (
                <div key={ev.id} className="lh-cal-row">
                  <div className={`lh-cal-date${ev.isLive ? " is-live" : ""}`}>
                    {ev.isLive ? "LIVE" : format(new Date(ev.scheduledAt), "d")}
                    <span className="lh-cal-date-mon">
                      {ev.isLive ? "" : format(new Date(ev.scheduledAt), "MMM")}
                    </span>
                  </div>
                  <div className="lh-cal-body">
                    <p className="lh-cal-title">{ev.title}</p>
                    <p className="lh-cal-meta">
                      {formatDate(ev.scheduledAt)}
                      {ev.host ? ` · ${ev.host}` : ""}
                    </p>
                    {office && (
                      <button
                        type="button"
                        className="lh-host-badge"
                        style={{ marginTop: 4, padding: "2px 8px", fontSize: 9.5 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOfficeFocus(office.id);
                          setShowOfficeModal(true);
                        }}
                      >
                        <MapPin size={10} />
                        {office.city}, {office.province}
                      </button>
                    )}
                  </div>
                  <a
                    href={ev.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`lh-cal-join${ev.isLive ? " is-live" : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={12} />
                    {ev.isLive ? "Join" : "Open"}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DtcOfficeModal
        open={showOfficeModal}
        onClose={() => setShowOfficeModal(false)}
        initialOfficeId={officeFocus}
      />
    </>
  );
}
