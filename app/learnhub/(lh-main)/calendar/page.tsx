"use client";
import { Suspense } from "react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";

interface GcalEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  hangoutLink?: string | null;
  htmlLink?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  creator?: { self?: boolean | null } | null;
}

type ApiState =
  | { kind: "loading" }
  | { kind: "ready"; events: GcalEvent[] }
  | { kind: "not_connected" }
  | { kind: "error"; message: string };

function eventStart(ev: GcalEvent): Date | null {
  const s = ev.start?.dateTime ?? ev.start?.date;
  return s ? new Date(s) : null;
}
function eventEnd(ev: GcalEvent): Date | null {
  const s = ev.end?.dateTime ?? ev.end?.date;
  return s ? new Date(s) : null;
}

function toLocalInput(d: Date): string {
  // Format as "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CalendarPageInner() {
  const [cursor, setCursor] = useState<Date>(new Date());
  const [state, setState] = useState<ApiState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalEvent, setModalEvent] = useState<GcalEvent | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPrefill, setNewPrefill] = useState<Date | null>(null);

  // Stable month key (e.g. "2026-05") — every other Date derived from this
  // is recomputed only when the month changes. The earlier implementation
  // computed gridStart/gridEnd as new Date instances every render and used
  // them as useCallback / useEffect deps, which created a fetch → setState
  // → re-render → new Date → fetch loop and froze the tab.
  const monthKey = format(cursor, "yyyy-MM");

  const { gridStart, gridEnd } = useMemo(() => {
    const ms = startOfMonth(cursor);
    const me = endOfMonth(cursor);
    return { gridStart: startOfWeek(ms), gridEnd: endOfWeek(me) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const fetchEvents = useCallback(async (signal?: AbortSignal) => {
    // Keep last-known events visible during refresh — only flash the loading
    // screen on a true cold start. The refreshing pill in the header shows
    // the user a background update is in flight without yanking the UI.
    setState((cur) => (cur.kind === "ready" ? cur : { kind: "loading" }));
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/learnhub/calendar/events?timeMin=${gridStart.toISOString()}&timeMax=${gridEnd.toISOString()}`,
        { signal },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data?.error === "not_connected" || data?.error === "reconnect_required") {
          setState({ kind: "not_connected" });
        } else {
          setState({ kind: "error", message: data?.error ?? "Failed" });
        }
        return;
      }
      setState({ kind: "ready", events: (data.events ?? []) as GcalEvent[] });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [gridStart, gridEnd]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchEvents(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchEvents]);

  // Keyboard nav: ← / → flips months, "t" jumps to today. Skips when a
  // modal is open or the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showNewModal || modalEvent) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowLeft") setCursor((c) => addMonths(c, -1));
      else if (e.key === "ArrowRight") setCursor((c) => addMonths(c, 1));
      else if (e.key === "t" || e.key === "T") setCursor(new Date());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNewModal, modalEvent]);

  // Group events by their local-date key (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, GcalEvent[]>();
    if (state.kind !== "ready") return map;
    for (const ev of state.events) {
      const start = eventStart(ev);
      if (!start) continue;
      const key = format(start, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [state]);

  // Build the day-cell grid
  const days = useMemo(() => {
    const out: Date[] = [];
    let d = new Date(gridStart);
    while (d <= gridEnd) {
      out.push(new Date(d));
      d = new Date(d.getTime() + 86400_000);
    }
    return out;
  }, [gridStart, gridEnd]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  // Touch swipe: drag the grid left = next month, right = previous month.
  // Threshold of 60px / 30deg keeps it from triggering on diagonal scrolls.
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!swipeRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeRef.current.x;
    const dy = t.clientY - swipeRef.current.y;
    swipeRef.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) setCursor((c) => addMonths(c, 1));
      else setCursor((c) => addMonths(c, -1));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <header className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
            Calendar
          </h1>
          <p className="hidden sm:block text-sm mt-0.5" style={{ color: "#9ba3cc" }}>
            Your real Google Calendar — manage events and Meet links from here.
          </p>
        </div>
        <button
          onClick={() => {
            setNewPrefill(new Date());
            setShowNewModal(true);
          }}
          className="text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5"
          style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
        >
          <Plus size={14} /> New Event
        </button>
      </header>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="p-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)", color: "#e8eaff" }}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="p-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)", color: "#e8eaff" }}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ background: "rgba(91,108,255,0.12)", color: "#7c8bff" }}
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
            {format(cursor, "MMMM yyyy")}
          </p>
          {refreshing && state.kind === "ready" && (
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                border: "2px solid rgba(91,108,255,0.25)",
                borderTopColor: "#7c8bff",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                display: "inline-block",
              }}
              title="Refreshing"
            />
          )}
        </div>
        <div style={{ width: 80 }} />
      </div>

      {state.kind === "not_connected" && (
        <div
          className="rounded-2xl p-6 text-center mb-4"
          style={{ background: "#131626", border: "1px solid rgba(91,108,255,0.3)" }}
        >
          <p className="text-3xl mb-2">📅</p>
          <h2 className="font-bold mb-1" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
            Connect Google Calendar
          </h2>
          <p className="text-sm mb-4" style={{ color: "#9ba3cc" }}>
            Link your Google account to see and edit your real calendar inside LearnHub.
          </p>
          <Link
            href="/api/learnhub/calendar/connect"
            className="inline-block text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ background: "#5b6cff", color: "#fff" }}
          >
            Connect →
          </Link>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl p-3 text-sm mb-4" style={{ background: "rgba(255,95,109,0.1)", color: "#ff5f6d" }}>
          {state.message}
        </div>
      )}

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-[10px] font-semibold text-center py-1" style={{ color: "#9ba3cc", letterSpacing: "0.06em" }}>
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-0.5 sm:gap-1"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const isTodayCell = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          return (
            <button
              key={key}
              onClick={() => {
                setSelectedDate(day);
                // On phones the cell is too small to render multiple event
                // chips legibly. A tap on a day with events opens the first
                // one directly so users can act on it without a long-press
                // or zooming. Empty days still just select the date.
                if (dayEvents.length > 0 && typeof window !== "undefined" && window.matchMedia("(max-width: 540px)").matches) {
                  setModalEvent(dayEvents[0]);
                }
              }}
              onDoubleClick={() => {
                const at = new Date(day);
                at.setHours(9, 0, 0, 0);
                setNewPrefill(at);
                setShowNewModal(true);
              }}
              className="rounded-md sm:rounded-lg p-1 sm:p-2 min-h-[56px] sm:min-h-[88px] text-left flex flex-col gap-0.5 sm:gap-1"
              style={{
                background: isSelected ? "rgba(91,108,255,0.15)" : inMonth ? "#131626" : "#0d0f1a",
                border: isSelected
                  ? "1px solid #5b6cff"
                  : isTodayCell
                  ? "1px solid rgba(91,108,255,0.5)"
                  : "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
                opacity: inMonth ? 1 : 0.5,
              }}
              aria-label={`${format(day, "EEEE, MMMM d")}${dayEvents.length ? ` — ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}`}
            >
              <span
                className="text-[11px] sm:text-xs font-semibold"
                style={{ color: isTodayCell ? "#7c8bff" : inMonth ? "#e8eaff" : "#5c6490" }}
              >
                {format(day, "d")}
              </span>

              {/* Mobile: a tight row of colored dots — one per event, up to 3.
                  Saves vertical space and stays legible on a 360px screen. */}
              {dayEvents.length > 0 && (
                <span className="flex sm:hidden gap-0.5 mt-auto" aria-hidden>
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: ev.hangoutLink ? "#22d3a0" : "#7c8bff",
                      }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 8, color: "#9ba3cc", marginLeft: 1 }}>+{dayEvents.length - 3}</span>
                  )}
                </span>
              )}

              {/* Desktop / tablet: classic event chips. */}
              <div className="hidden sm:flex sm:flex-col sm:gap-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id ?? `${key}-${ev.summary}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalEvent(ev);
                    }}
                    className="text-[10px] font-medium truncate rounded px-1.5 py-0.5"
                    style={{
                      background: ev.hangoutLink ? "rgba(34,211,160,0.15)" : "rgba(91,108,255,0.15)",
                      color: ev.hangoutLink ? "#22d3a0" : "#7c8bff",
                      cursor: "pointer",
                    }}
                    title={ev.summary ?? ""}
                  >
                    {ev.summary ?? "Untitled"}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px]" style={{ color: "#9ba3cc" }}>
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {showNewModal && (
        <NewEventModal
          prefill={newPrefill ?? new Date()}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            fetchEvents();
          }}
        />
      )}

      {modalEvent && (
        <EventModal
          event={modalEvent}
          onClose={() => setModalEvent(null)}
          onChanged={() => {
            setModalEvent(null);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
}

// ── New event modal ──────────────────────────────────────────────────

function NewEventModal({
  prefill,
  onClose,
  onCreated,
}: {
  prefill: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(toLocalInput(prefill));
  const [end, setEnd] = useState(toLocalInput(new Date(prefill.getTime() + 60 * 60_000)));
  const [withMeet, setWithMeet] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!summary.trim()) return setError("Title required.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/learnhub/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summary.trim(),
          description: description.trim() || undefined,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          withMeet,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Failed");
        setSubmitting(false);
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="New Event" onClose={onClose}>
      <Field label="Title">
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Weekly check-in" style={inputStyle} autoFocus />
      </Field>
      <Field label="Description (optional)">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="End">
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <label className="flex items-center gap-2 cursor-pointer mt-1">
        <input type="checkbox" checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} />
        <span className="text-sm" style={{ color: "#e8eaff" }}>Add Google Meet link</span>
      </label>
      {error && <p className="text-sm" style={{ color: "#ff5f6d" }}>{error}</p>}
      <div className="flex gap-2 justify-end mt-2">
        <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ color: "#9ba3cc" }}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
          style={{ background: "#5b6cff", color: "#fff" }}
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Edit / view existing event modal ─────────────────────────────────

function EventModal({
  event,
  onClose,
  onChanged,
}: {
  event: GcalEvent;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = event.creator?.self ?? false;
  const start = eventStart(event);
  const end = eventEnd(event);

  const [summary, setSummary] = useState(event.summary ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [startStr, setStartStr] = useState(start ? toLocalInput(start) : "");
  const [endStr, setEndStr] = useState(end ? toLocalInput(end) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!event.id) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/learnhub/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summary.trim(),
          description: description.trim() || undefined,
          start: startStr ? new Date(startStr).toISOString() : undefined,
          end: endStr ? new Date(endStr).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Failed");
        setSubmitting(false);
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event.id) return;
    if (!confirm("Delete this event from your Google Calendar?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/learnhub/calendar/events/${event.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Failed");
        setSubmitting(false);
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title={canEdit ? "Edit Event" : "View Event"} onClose={onClose}>
      {!canEdit && (
        <p className="text-xs" style={{ color: "#9ba3cc" }}>
          You can't edit this event because you're not the organizer.
        </p>
      )}
      <Field label="Title">
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={!canEdit}
          style={inputStyle}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEdit}
          rows={3}
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <input type="datetime-local" value={startStr} onChange={(e) => setStartStr(e.target.value)} disabled={!canEdit} style={inputStyle} />
        </Field>
        <Field label="End">
          <input type="datetime-local" value={endStr} onChange={(e) => setEndStr(e.target.value)} disabled={!canEdit} style={inputStyle} />
        </Field>
      </div>
      {event.hangoutLink && (
        <a
          href={event.hangoutLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold inline-block"
          style={{ color: "#22d3a0" }}
        >
          🎥  Join Meet →
        </a>
      )}
      {error && <p className="text-sm" style={{ color: "#ff5f6d" }}>{error}</p>}
      <div className="flex justify-between items-center mt-2 gap-2">
        {canEdit ? (
          <button
            onClick={handleDelete}
            disabled={submitting}
            className="text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-50"
            style={{ background: "rgba(255,95,109,0.1)", color: "#ff5f6d", border: "1px solid rgba(255,95,109,0.3)" }}
          >
            Delete
          </button>
        ) : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ color: "#9ba3cc" }}>
            Close
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={submitting}
              className="text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
              style={{ background: "#5b6cff", color: "#fff" }}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4"
      style={{ background: "rgba(5,6,15,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md p-5 flex flex-col gap-3 rounded-t-2xl sm:rounded-2xl"
        style={{
          background: "#131626",
          border: "1px solid rgba(91,108,255,0.2)",
          maxHeight: "92vh",
          overflowY: "auto",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center justify-between sticky top-0 -mt-5 -mx-5 px-5 py-3" style={{ background: "#131626", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 1 }}>
          <h2 className="font-bold text-base sm:text-lg" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              color: "#9ba3cc",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999,
              cursor: "pointer",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "#9ba3cc" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d0f1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#e8eaff",
  fontSize: 13,
  outline: "none",
  colorScheme: "dark",
};

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <CalendarPageInner />
    </Suspense>
  )
}
