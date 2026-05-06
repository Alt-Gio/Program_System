"use client";

/**
 * CalendarPopover — drop-down panel from the TopNav calendar icon.
 *
 * Lists upcoming Meet/webinar posts pulled from Convex. Each row
 * shows: date · title · host · "Hosted by [DTC office]" badge ·
 * a "Join" button that opens the meet link.
 *
 * Pulls from `api.learnhub_posts.listFeedWithAuthors`, filters to
 * `type === "meet"` posts, and sorts by `metadata.scheduledAt` (or
 * createdAt as a fallback).
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

export function CalendarPopover({ open, onClose }: CalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const feed = useQuery(api.learnhub_posts.listFeedWithAuthors, { limit: 50 });
  const [officeFocus, setOfficeFocus] = useState<string | null>(null);
  const [showOfficeModal, setShowOfficeModal] = useState(false);

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

  const events = useMemo(() => {
    if (!feed) return [];
    const meetPosts = feed.filter((p) => p.type === "meet");
    type EventRow = {
      id: string;
      title: string;
      host: string;
      meetLink: string;
      scheduledAt: number;
      isLive: boolean;
      dtcOffice?: string;
    };
    const rows: EventRow[] = meetPosts.map((p) => {
      const m = (p.metadata ?? {}) as Record<string, unknown>;
      return {
        id: p._id as string,
        title: (m.title as string) || (p.content?.slice(0, 60) ?? "Meeting"),
        host: p.author?.name ?? "Unknown",
        meetLink: (m.meetLink as string) ?? "#",
        scheduledAt: (m.scheduledAt as number) ?? p.createdAt,
        isLive: Boolean(m.isLive),
        dtcOffice: m.dtcOffice as string | undefined,
      };
    });
    return rows.sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [feed]);

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
                {liveCount > 0 ? `${liveCount} live now · ` : ""}
                {upcomingCount} upcoming
              </p>
            </div>
            <button type="button" onClick={onClose} className="lh-popover-close" aria-label="Close">
              <X size={14} />
            </button>
          </header>

          <div className="lh-popover-list">
            {feed === undefined && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="lh-skeleton" style={{ height: 56, borderRadius: 10 }} />
                ))}
              </div>
            )}
            {feed !== undefined && events.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--lh-text-3)", fontSize: 13 }}>
                No scheduled webinars yet.
              </div>
            )}
            {events.map((ev) => {
              const office = findDtcOffice(ev.dtcOffice);
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
                      {formatDate(ev.scheduledAt)} · {ev.host}
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
