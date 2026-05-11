"use client";
import { Suspense } from "react";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalEvent, setModalEvent] = useState<GcalEvent | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPrefill, setNewPrefill] = useState<Date | null>(null);

  // Visible window for the month grid (includes leading/trailing days)
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const fetchEvents = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/learnhub/calendar/events?timeMin=${gridStart.toISOString()}&timeMax=${gridEnd.toISOString()}`
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
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [gridStart, gridEnd]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
            Calendar
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>
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
        <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
          {format(cursor, "MMMM yyyy")}
        </p>
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
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-[10px] font-semibold text-center py-1" style={{ color: "#9ba3cc", letterSpacing: "0.06em" }}>
            {d.toUpperCase()}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const isTodayCell = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(day)}
              onDoubleClick={() => {
                const at = new Date(day);
                at.setHours(9, 0, 0, 0);
                setNewPrefill(at);
                setShowNewModal(true);
              }}
              className="rounded-lg p-2 min-h-[88px] text-left flex flex-col gap-1"
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
            >
              <span
                className="text-xs font-semibold"
                style={{ color: isTodayCell ? "#7c8bff" : inMonth ? "#e8eaff" : "#5c6490" }}
              >
                {format(day, "d")}
              </span>
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
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(5,6,15,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: "#131626", border: "1px solid rgba(91,108,255,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ color: "#9ba3cc", background: "transparent", border: 0, cursor: "pointer" }}>
            <X size={18} />
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
