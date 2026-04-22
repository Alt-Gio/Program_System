"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// ============================================================
// /event — Dark-themed events calendar for DICT Region V
// Perpetual horizontal day strip, 3D-tilt cards with directional
// edge glow, custom cursor with lerp lag, warp "Jump to Today"
// transition, modal event details. Connects to the Convex
// `activities` table via api.activities.listActivities.
// ============================================================

type Activity = {
  _id: Id<"activities">;
  projectId: Id<"projects">;
  provinceId: Id<"provinces">;
  lguId?: Id<"lgus">;
  barangay?: string;
  activityTitle: string;
  venue: string;
  startDate: string;
  endDate: string;
  modeOfConduct: string;
  status: string;
  remarks?: string;
  afterActivityReport?: string;
  partnerOrganizations: string[];
  participants: {
    nga: { male: number; female: number };
    lgu: { male: number; female: number };
    suc: { male: number; female: number };
    others: { male: number; female: number; label?: string };
  };
  year: number;
  month: number;
};

type UiEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  cat: string;
  grad: string;
  time: string;
  loc: string;
  desc: string;
  attendees: number;
  status: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Gradient palette mapped by project code — falls back by hash
const PROJECT_GRADS: Record<string, string> = {
  EGOV:     "g-forum",
  ELGU:     "g-workshop",
  FREEWIFI: "g-deploy",
  GOVNET:   "g-conf",
  NBP:      "g-training",
  CYBER:    "g-seminar",
  PNPKI:    "g-talk",
  DRRM:     "g-holiday",
  ILCDB:    "g-talk",
  IIDB:     "g-conf",
};

const FALLBACK_GRADS = [
  "g-forum", "g-training", "g-workshop", "g-seminar",
  "g-deploy", "g-conf", "g-talk", "g-holiday",
];

function gradFor(code: string | undefined, mode: string | undefined): string {
  if (code && PROJECT_GRADS[code]) return PROJECT_GRADS[code];
  const key = (code ?? mode ?? "x").toString();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADS[h % FALLBACK_GRADS.length];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseYmd(s: string): Date | null {
  // Expect YYYY-MM-DD or ISO; construct at noon local to avoid TZ drift
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(+d) ? null : d;
  }
  return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function sumAttendees(p: Activity["participants"]): number {
  return (
    p.nga.male + p.nga.female +
    p.lgu.male + p.lgu.female +
    p.suc.male + p.suc.female +
    p.others.male + p.others.female
  );
}

function formatRange(startISO: string, endISO: string): string {
  const s = parseYmd(startISO);
  const e = parseYmd(endISO);
  if (!s) return "";
  const sStr = s.toLocaleDateString(undefined, { weekday: "short", hour: undefined });
  if (!e || startISO === endISO) return sStr;
  return `${sStr} → ${e.toLocaleDateString(undefined, { weekday: "short" })}`;
}

export default function EventCalendarPage() {
  const activities = useQuery(api.activities.listActivities, {}) as Activity[] | undefined;
  const projects = useQuery(api.projects.list, {}) as
    | Array<{ _id: Id<"projects">; code: string; name: string; shortName?: string; color?: string }>
    | undefined;
  const provinces = useQuery(api.provinces.list, {}) as
    | Array<{ _id: Id<"provinces">; name: string; code: string }>
    | undefined;
  const lgus = useQuery(api.provinces.allLGUs, {}) as
    | Array<{ _id: Id<"lgus">; name: string; provinceId: Id<"provinces"> }>
    | undefined;

  const projectById = useMemo(() => {
    const m = new Map<string, { code: string; name: string; shortName?: string; color?: string }>();
    projects?.forEach((p) => m.set(p._id, p));
    return m;
  }, [projects]);
  const provinceById = useMemo(() => {
    const m = new Map<string, string>();
    provinces?.forEach((p) => m.set(p._id, p.name));
    return m;
  }, [provinces]);
  const lguById = useMemo(() => {
    const m = new Map<string, string>();
    lgus?.forEach((l) => m.set(l._id, l.name));
    return m;
  }, [lgus]);

  // Map activities → UI events grouped by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, UiEvent[]> = {};
    if (!activities) return map;
    for (const a of activities) {
      const start = parseYmd(a.startDate);
      const end = parseYmd(a.endDate) ?? start;
      if (!start) continue;
      const proj = projectById.get(a.projectId as unknown as string);
      const provinceName = provinceById.get(a.provinceId as unknown as string) ?? "";
      const lguName = a.lguId ? lguById.get(a.lguId as unknown as string) ?? "" : "";
      const locParts = [a.venue, lguName, provinceName].filter(Boolean);
      const ui: UiEvent = {
        id: a._id,
        date: "",
        title: a.activityTitle,
        cat: proj?.code ? `${proj.code} · ${a.modeOfConduct}` : a.modeOfConduct,
        grad: gradFor(proj?.code, a.modeOfConduct),
        time: a.modeOfConduct || "All-day",
        loc: locParts.join(", ") || "TBD",
        desc:
          a.afterActivityReport?.trim() ||
          a.remarks?.trim() ||
          (a.partnerOrganizations?.length
            ? `In partnership with ${a.partnerOrganizations.join(", ")}.`
            : "Scheduled DICT Region V activity."),
        attendees: sumAttendees(a.participants),
        status: a.status,
      };
      // Iterate each date between start..end (inclusive), cap 60 days
      const cursor = new Date(start);
      const last = end!;
      let guard = 0;
      while (cursor.getTime() <= last.getTime() && guard < 60) {
        const key = ymd(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        (map[key] ??= []).push({ ...ui, date: key });
        cursor.setDate(cursor.getDate() + 1);
        guard++;
      }
    }
    return map;
  }, [activities, projectById, provinceById, lguById]);

  // ── Calendar state ─────────────────────────────────────────
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);
  const [cursor, setCursor] = useState<{ y: number; m: number }>({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const [historyStack, setHistoryStack] = useState<Array<{ y: number; m: number }>>([]);
  const [spotlight, setSpotlight] = useState<string | null>(null); // YYYY-MM-DD
  const [modal, setModal] = useState<UiEvent | null>(null);
  const [clock, setClock] = useState("");
  const [warp, setWarp] = useState(false);
  const [fade, setFade] = useState<"in" | "out" | null>(null);

  // Clock ticker
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Custom cursor ──────────────────────────────────────────
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let rx = window.innerWidth / 2;
    let ry = window.innerHeight / 2;
    let mx = rx;
    let my = ry;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx - 2.5}px, ${my - 2.5}px, 0)`;
      }
    };
    window.addEventListener("mousemove", onMove);
    let raf = 0;
    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx - 18}px, ${ry - 18}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Strip wheel → horizontal + month transitions ───────────
  const stripRef = useRef<HTMLDivElement | null>(null);
  const transitioningRef = useRef(false);

  const transitionMonth = useCallback(
    (dir: 1 | -1) => {
      if (transitioningRef.current) return;
      transitioningRef.current = true;
      setFade("out");
      setHistoryStack((s) => [...s, { y: cursor.y, m: cursor.m }]);
      setTimeout(() => {
        setCursor((c) => {
          const dt = new Date(c.y, c.m + dir, 1);
          return { y: dt.getFullYear(), m: dt.getMonth() };
        });
        setFade("in");
        setTimeout(() => {
          // snap scroll to edge we came from
          if (stripRef.current) {
            stripRef.current.scrollLeft = dir === 1 ? 0 : stripRef.current.scrollWidth;
          }
          setFade(null);
          transitioningRef.current = false;
        }, 280);
      }, 260);
    },
    [cursor],
  );

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Translate vertical wheel into horizontal scroll; at edges, step month
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.preventDefault();
      const next = el.scrollLeft + e.deltaY;
      if (next < -8) {
        transitionMonth(-1);
        return;
      }
      if (next > el.scrollWidth - el.clientWidth + 8) {
        transitionMonth(1);
        return;
      }
      el.scrollLeft = next;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [transitionMonth]);

  // Esc closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (spotlight) setSpotlight(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, spotlight]);

  const goBack = useCallback(() => {
    setHistoryStack((s) => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      setFade("out");
      setTimeout(() => {
        setCursor(last);
        setFade("in");
        setTimeout(() => setFade(null), 280);
      }, 260);
      return s.slice(0, -1);
    });
  }, []);

  const goToToday = useCallback(() => {
    setWarp(true);
    setTimeout(() => {
      setHistoryStack((s) => [...s, { y: cursor.y, m: cursor.m }]);
      setCursor({ y: today.getFullYear(), m: today.getMonth() });
      setTimeout(() => {
        setWarp(false);
        // scroll today's column into view
        const el = stripRef.current;
        if (el) {
          const col = el.querySelector(
            `[data-day="${ymd(today.getFullYear(), today.getMonth(), today.getDate())}"]`,
          ) as HTMLElement | null;
          if (col) {
            const x = col.offsetLeft - el.clientWidth / 2 + col.clientWidth / 2;
            el.scrollTo({ left: x, behavior: "smooth" });
          }
        }
      }, 260);
    }, 420);
  }, [cursor, today]);

  // Tilt handlers (inline for perf)
  const onCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.currentTarget;
    const r = t.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const ry = px * 22;
    const rx = -py * 22;
    t.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`;
    const gx = Math.round(px * 40);
    const gy = Math.round(py * 40);
    t.style.boxShadow = `${-gx}px ${-gy}px 48px -6px rgba(139, 92, 246, 0.55), ${gx}px ${gy}px 60px -10px rgba(56, 189, 248, 0.35)`;
  };
  const onCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.currentTarget;
    t.style.transform = "";
    t.style.boxShadow = "";
  };

  // ── Compute current month grid ─────────────────────────────
  const days = useMemo(() => {
    const n = daysInMonth(cursor.y, cursor.m);
    const out: Array<{ key: string; d: number; w: string; events: UiEvent[]; isToday: boolean }> = [];
    for (let d = 1; d <= n; d++) {
      const key = ymd(cursor.y, cursor.m, d);
      const dt = new Date(cursor.y, cursor.m, d, 12, 0, 0);
      out.push({
        key,
        d,
        w: dt.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
        events: eventsByDate[key] ?? [],
        isToday:
          dt.getFullYear() === today.getFullYear() &&
          dt.getMonth() === today.getMonth() &&
          dt.getDate() === today.getDate(),
      });
    }
    return out;
  }, [cursor, eventsByDate, today]);

  // Month stats
  const monthStats = useMemo(() => {
    let events = 0;
    let attendees = 0;
    let busyDays = 0;
    for (const d of days) {
      if (d.events.length) busyDays++;
      events += d.events.length;
      attendees += d.events.reduce((s, e) => s + e.attendees, 0);
    }
    return { events, attendees, busyDays };
  }, [days]);

  // Spotlighted events (falls back to today if within this month, else first busy day)
  const spotlightEvents = useMemo(() => {
    if (spotlight && eventsByDate[spotlight]) return { date: spotlight, list: eventsByDate[spotlight] };
    const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());
    if (cursor.y === today.getFullYear() && cursor.m === today.getMonth() && eventsByDate[todayKey]) {
      return { date: todayKey, list: eventsByDate[todayKey] };
    }
    const firstBusy = days.find((d) => d.events.length);
    if (firstBusy) return { date: firstBusy.key, list: firstBusy.events };
    return null;
  }, [spotlight, eventsByDate, cursor, today, days]);

  const loading = activities === undefined;

  return (
    <div className="event-root">
      <style>{CSS}</style>

      {/* Custom cursor */}
      <div ref={ringRef} className="cur-ring" aria-hidden />
      <div ref={dotRef} className="cur-dot" aria-hidden />

      {/* Warp overlay */}
      <div className={`warp ${warp ? "active" : ""}`} aria-hidden />

      {/* Topbar */}
      <header className="topbar">
        <Link href="/" className="brand" onMouseEnter={() => {}}>
          <span className="brand-mark">◆</span>
          <span className="brand-text">
            <strong>DICT</strong> Region V
            <em>Events Calendar</em>
          </span>
        </Link>
        <nav className="topnav">
          <button
            className="btn ghost"
            onClick={goBack}
            disabled={historyStack.length === 0}
            aria-label="Back"
          >
            ← Back
          </button>
          <span className="clock">
            <span className="clock-dot" />
            {clock}
          </span>
          <button className="btn warp-btn" onClick={goToToday}>
            ⚡ Jump to Today
          </button>
        </nav>
      </header>

      {/* Info panel */}
      <section className={`info ${fade ?? ""}`}>
        <div className="month-block">
          <div className="month-label">CURRENT VIEW</div>
          <h1 className="month-name">{MONTHS[cursor.m]}</h1>
          <div className="month-year">{cursor.y}</div>
          <div className="month-stats">
            <div>
              <span className="stat-num">{monthStats.events}</span>
              <span className="stat-lbl">Events</span>
            </div>
            <div>
              <span className="stat-num">{monthStats.busyDays}</span>
              <span className="stat-lbl">Busy Days</span>
            </div>
            <div>
              <span className="stat-num">{monthStats.attendees.toLocaleString()}</span>
              <span className="stat-lbl">Attendees</span>
            </div>
          </div>
        </div>

        <div className="spotlight">
          <div className="spot-label">
            {spotlightEvents ? "SPOTLIGHT" : "SELECT A DAY"}
          </div>
          {spotlightEvents ? (
            <>
              <div className="spot-date">
                {parseYmd(spotlightEvents.date)?.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <ul className="spot-list">
                {spotlightEvents.list.slice(0, 4).map((ev) => (
                  <li key={ev.id} onClick={() => setModal(ev)}>
                    <span className={`swatch ${ev.grad}`} />
                    <div>
                      <div className="spot-title">{ev.title}</div>
                      <div className="spot-meta">
                        {ev.cat} · {ev.loc}
                      </div>
                    </div>
                  </li>
                ))}
                {spotlightEvents.list.length > 4 && (
                  <li className="spot-more">+{spotlightEvents.list.length - 4} more</li>
                )}
              </ul>
            </>
          ) : (
            <div className="spot-empty">
              Hover a day column to preview its events. Click a card to open full details.
            </div>
          )}
        </div>
      </section>

      {/* Day strip */}
      <section className={`strip-wrap ${fade ?? ""}`}>
        {loading ? (
          <div className="loading">
            <span className="spin" /> Loading events from Convex…
          </div>
        ) : (
          <div className="strip" ref={stripRef} role="list">
            {days.map((d) => (
              <div
                key={d.key}
                data-day={d.key}
                className={`day ${d.isToday ? "today" : ""} ${spotlight === d.key ? "active" : ""}`}
                onMouseEnter={() => setSpotlight(d.key)}
                onMouseMove={onCardMove}
                onMouseLeave={(e) => {
                  onCardLeave(e);
                }}
                role="listitem"
              >
                <div className="day-head">
                  <div className="day-w">{d.w}</div>
                  <div className="day-n">{d.d}</div>
                  {d.isToday && <div className="day-today">TODAY</div>}
                </div>
                <div className="day-events">
                  {d.events.length === 0 && <div className="day-empty">—</div>}
                  {d.events.map((ev) => (
                    <button
                      key={ev.id}
                      className={`ev ${ev.grad}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal(ev);
                      }}
                      title={ev.title}
                    >
                      <span className="ev-cat">{ev.cat.split(" · ")[0]}</span>
                      <span className="ev-title">{ev.title}</span>
                    </button>
                  ))}
                </div>
                <div className="day-foot">
                  {d.events.length > 0 && (
                    <span className="dot-count">{d.events.length}</span>
                  )}
                </div>
              </div>
            ))}
            {days.length === 0 && <div className="loading">No days</div>}
          </div>
        )}

        <div className="strip-hint">
          <span>◀ Scroll to travel across months ▶</span>
        </div>
      </section>

      {/* Modal */}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="modal">
            <div className={`modal-hero ${modal.grad}`}>
              <span className="modal-badge">{modal.cat}</span>
              <h2 className="modal-title">{modal.title}</h2>
              <div className="modal-sub">
                {parseYmd(modal.date)?.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-meta">
                <div>
                  <span className="meta-k">When</span>
                  <span className="meta-v">{modal.time}</span>
                </div>
                <div>
                  <span className="meta-k">Where</span>
                  <span className="meta-v">{modal.loc}</span>
                </div>
                <div>
                  <span className="meta-k">Attendees</span>
                  <span className="meta-v">{modal.attendees.toLocaleString()}</span>
                </div>
                <div>
                  <span className="meta-k">Status</span>
                  <span className="meta-v status">{modal.status}</span>
                </div>
              </div>
              <p className="modal-desc">{modal.desc}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Styles (kept in-file so the page is self-contained)
// ============================================================

const CSS = `
.event-root {
  --bg: #050510;
  --bg-soft: #0b0b1c;
  --ink: #e6e6f4;
  --ink-dim: #9a9ac2;
  --line: rgba(255,255,255,0.08);
  --accent: #8b5cf6;
  --accent-2: #38bdf8;
  min-height: 100vh;
  background:
    radial-gradient(1200px 600px at 15% -10%, rgba(139,92,246,0.18), transparent 60%),
    radial-gradient(900px 500px at 100% 110%, rgba(56,189,248,0.14), transparent 60%),
    var(--bg);
  color: var(--ink);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  cursor: none;
  position: relative;
  overflow-x: hidden;
}
.event-root * { cursor: none; }
.event-root button, .event-root a { cursor: none; }

/* Cursor */
.cur-ring, .cur-dot {
  position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999;
  will-change: transform;
}
.cur-ring {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1.5px solid rgba(139,92,246,0.75);
  box-shadow: 0 0 18px rgba(139,92,246,0.45), inset 0 0 10px rgba(139,92,246,0.25);
  mix-blend-mode: screen;
}
.cur-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 6px #fff;
}

/* Warp overlay */
.warp {
  position: fixed; inset: 0; z-index: 9990;
  background: radial-gradient(circle at 50% 50%, rgba(139,92,246,0.7), rgba(5,5,16,0) 60%);
  opacity: 0; transition: opacity 420ms ease;
  pointer-events: none;
}
.warp.active { opacity: 1; }

/* Topbar */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 32px; border-bottom: 1px solid var(--line);
  backdrop-filter: blur(8px);
  position: sticky; top: 0; z-index: 20;
  background: rgba(5,5,16,0.6);
}
.brand { display: flex; align-items: center; gap: 12px; color: var(--ink); text-decoration: none; }
.brand-mark {
  width: 28px; height: 28px; display: grid; place-items: center;
  border-radius: 8px; background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #0b0b1c; font-weight: 900; font-size: 14px;
}
.brand-text { display: flex; flex-direction: column; line-height: 1.05; font-size: 14px; }
.brand-text em { font-style: normal; color: var(--ink-dim); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
.topnav { display: flex; align-items: center; gap: 14px; }
.btn {
  border: 1px solid var(--line); background: rgba(255,255,255,0.04);
  color: var(--ink); padding: 8px 14px; border-radius: 10px;
  font: 600 12px/1 Inter, system-ui; letter-spacing: 0.04em; text-transform: uppercase;
  transition: all 180ms ease;
}
.btn:hover:not(:disabled) { background: rgba(139,92,246,0.15); border-color: rgba(139,92,246,0.4); }
.btn:disabled { opacity: 0.35; }
.btn.warp-btn {
  background: linear-gradient(135deg, rgba(139,92,246,0.35), rgba(56,189,248,0.25));
  border-color: rgba(139,92,246,0.55);
  box-shadow: 0 0 20px rgba(139,92,246,0.35);
}
.clock {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px; color: var(--ink-dim); display: flex; align-items: center; gap: 8px;
}
.clock-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

/* Info panel */
.info {
  display: grid; grid-template-columns: minmax(280px, 36%) 1fr;
  gap: 24px; padding: 28px 32px; min-height: 36vh;
  transition: opacity 260ms ease, transform 260ms ease;
}
.info.out { opacity: 0; transform: translateY(-6px); }
.info.in { opacity: 0; animation: fadeIn 280ms ease forwards; }
@keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
.month-label, .spot-label {
  font: 600 11px/1 "JetBrains Mono", monospace; letter-spacing: 0.2em;
  color: var(--ink-dim); text-transform: uppercase;
}
.month-name {
  font-size: clamp(56px, 8vw, 112px); line-height: 0.95; font-weight: 800;
  background: linear-gradient(135deg, #fff 10%, var(--accent) 70%, var(--accent-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  margin: 8px 0 4px;
}
.month-year {
  font-family: "JetBrains Mono", monospace; font-size: 22px; color: var(--ink-dim);
}
.month-stats { display: flex; gap: 22px; margin-top: 24px; }
.month-stats > div { display: flex; flex-direction: column; }
.stat-num { font-size: 28px; font-weight: 800; color: var(--ink); }
.stat-lbl { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.12em; }

.spotlight {
  border: 1px solid var(--line); border-radius: 16px; padding: 20px 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
  display: flex; flex-direction: column; gap: 12px;
}
.spot-date { font-size: 20px; font-weight: 700; }
.spot-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.spot-list li {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--line);
  transition: all 160ms ease;
}
.spot-list li:hover { border-color: rgba(139,92,246,0.45); background: rgba(139,92,246,0.08); }
.swatch { width: 10px; height: 36px; border-radius: 3px; flex-shrink: 0; }
.spot-title { font-weight: 600; font-size: 14px; }
.spot-meta { font-size: 11px; color: var(--ink-dim); margin-top: 2px; }
.spot-more { color: var(--ink-dim); font-size: 12px; text-align: center; padding: 6px; }
.spot-empty { color: var(--ink-dim); font-size: 13px; padding: 16px 0; line-height: 1.5; }

/* Day strip */
.strip-wrap {
  position: relative; padding: 16px 32px 40px;
  transition: opacity 260ms ease;
}
.strip-wrap.out { opacity: 0; }
.strip-wrap.in { animation: fadeIn 280ms ease forwards; opacity: 0; }
.strip {
  display: flex; gap: 14px; overflow-x: auto; overflow-y: visible;
  padding: 40px 8px 30px;
  scroll-behavior: smooth;
  scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.4) transparent;
}
.strip::-webkit-scrollbar { height: 6px; }
.strip::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.4); border-radius: 3px; }

.day {
  flex: 0 0 auto; width: 108px; min-height: 280px;
  border: 1px solid var(--line); border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
  display: flex; flex-direction: column; padding: 12px 10px;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 180ms ease;
  will-change: transform;
  transform-style: preserve-3d;
}
.day:hover { border-color: rgba(139,92,246,0.5); }
.day.today { border-color: rgba(56,189,248,0.7); box-shadow: 0 0 0 1px rgba(56,189,248,0.4), 0 12px 36px -8px rgba(56,189,248,0.4); }
.day.active { border-color: rgba(139,92,246,0.75); }
.day-head { text-align: center; padding-bottom: 10px; border-bottom: 1px dashed var(--line); }
.day-w { font-family: "JetBrains Mono", monospace; font-size: 10px; color: var(--ink-dim); letter-spacing: 0.2em; }
.day-n { font-size: 30px; font-weight: 800; margin-top: 2px; }
.day-today {
  display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 999px;
  background: rgba(56,189,248,0.18); color: #7dd3fc; font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
}
.day-events { flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 10px 0; }
.day-empty { color: rgba(255,255,255,0.1); text-align: center; font-size: 22px; padding: 30px 0; }
.ev {
  text-align: left; border: none; border-radius: 8px;
  padding: 7px 9px; color: #fff; font: 600 11px/1.25 Inter, sans-serif;
  display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 6px 14px -6px rgba(0,0,0,0.5);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.ev:hover { transform: translateY(-1px); box-shadow: 0 10px 18px -6px rgba(139,92,246,0.55); }
.ev-cat { font-size: 9px; opacity: 0.85; letter-spacing: 0.1em; text-transform: uppercase; }
.ev-title { font-size: 11px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.day-foot { text-align: center; padding-top: 6px; }
.dot-count {
  display: inline-block; min-width: 20px; padding: 2px 6px; border-radius: 999px;
  background: rgba(139,92,246,0.18); color: #c4b5fd; font-size: 10px; font-weight: 700;
  font-family: "JetBrains Mono", monospace;
}
.strip-hint {
  text-align: center; color: var(--ink-dim); font-size: 11px; letter-spacing: 0.2em;
  font-family: "JetBrains Mono", monospace; margin-top: 4px;
}

/* Gradient swatches / backgrounds */
.g-forum    { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
.g-training { background: linear-gradient(135deg, #06b6d4, #3b82f6); }
.g-holiday  { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.g-workshop { background: linear-gradient(135deg, #10b981, #06b6d4); }
.g-seminar  { background: linear-gradient(135deg, #ef4444, #f97316); }
.g-deploy   { background: linear-gradient(135deg, #f97316, #eab308); }
.g-conf     { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.g-talk     { background: linear-gradient(135deg, #ec4899, #f43f5e); }

/* Loading */
.loading { padding: 80px; text-align: center; color: var(--ink-dim); font-size: 14px; }
.spin {
  display: inline-block; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(139,92,246,0.3); border-top-color: var(--accent);
  animation: spin 700ms linear infinite; margin-right: 8px; vertical-align: -2px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(5,5,16,0.78); backdrop-filter: blur(6px);
  display: grid; place-items: center; padding: 20px;
  animation: fadeIn 200ms ease forwards;
}
.modal {
  width: min(640px, 96vw); border-radius: 18px; overflow: hidden;
  border: 1px solid rgba(139,92,246,0.3);
  background: linear-gradient(180deg, #0c0c20, #07071a);
  box-shadow: 0 30px 80px -20px rgba(139,92,246,0.5);
}
.modal-hero { padding: 28px 28px 36px; position: relative; color: #fff; }
.modal-close {
  position: absolute; top: 14px; right: 14px;
  width: 32px; height: 32px; border-radius: 50%; border: none;
  background: rgba(0,0,0,0.35); color: #fff; font-size: 20px; line-height: 1;
}
.modal-badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px;
  background: rgba(0,0,0,0.35); font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase;
}
.modal-title { margin: 10px 0 6px; font-size: 28px; font-weight: 800; line-height: 1.15; }
.modal-sub { font-size: 13px; opacity: 0.85; font-family: "JetBrains Mono", monospace; }
.modal-body { padding: 20px 28px 28px; }
.modal-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 24px; margin-bottom: 18px; }
.modal-meta > div { display: flex; flex-direction: column; gap: 4px; }
.meta-k { font-size: 10px; color: var(--ink-dim); letter-spacing: 0.15em; text-transform: uppercase; font-family: "JetBrains Mono", monospace; }
.meta-v { font-size: 14px; color: var(--ink); font-weight: 600; }
.meta-v.status { display: inline-block; padding: 3px 10px; background: rgba(139,92,246,0.18); border-radius: 999px; width: fit-content; font-size: 11px; }
.modal-desc { color: var(--ink-dim); font-size: 14px; line-height: 1.6; margin: 0; }

@media (max-width: 640px) {
  .info { grid-template-columns: 1fr; }
  .topbar { padding: 14px 18px; }
  .strip-wrap { padding: 12px 18px 32px; }
  .info { padding: 20px 18px; }
  .clock { display: none; }
}
`;
