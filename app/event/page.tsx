"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// ============================================================
// /event — DTC Events Calendar (public)
// Horizontal day-strip calendar, month boundary auto-advance,
// preview card, Philippines holiday detection, modal details.
// ============================================================

// Philippine fixed national holidays (MM-DD)
const PH_HOLIDAYS_FIXED: Record<string, string> = {
  "01-01": "New Year's Day",
  "04-09": "Araw ng Kagitingan",
  "05-01": "Labor Day",
  "06-12": "Independence Day",
  "08-21": "Ninoy Aquino Day",
  "11-01": "All Saints' Day",
  "11-02": "All Souls' Day",
  "11-30": "Bonifacio Day",
  "12-08": "Immaculate Conception",
  "12-25": "Christmas Day",
  "12-30": "Rizal Day",
  "12-31": "Last Day of the Year",
};

// Philippine movable holidays (YYYY-MM-DD)
const PH_HOLIDAYS_MOVABLE: Record<string, string> = {
  "2025-01-29": "Chinese New Year",
  "2025-04-17": "Maundy Thursday",
  "2025-04-18": "Good Friday",
  "2025-04-19": "Black Saturday",
  "2026-02-17": "Chinese New Year",
  "2026-04-02": "Maundy Thursday",
  "2026-04-03": "Good Friday",
  "2026-04-04": "Black Saturday",
  "2027-01-27": "Chinese New Year",
  "2027-03-25": "Maundy Thursday",
  "2027-03-26": "Good Friday",
};

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
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);
  const [cursor, setCursor] = useState<{ y: number; m: number }>({
    y: today.getFullYear(),
    m: today.getMonth(),
  });

  const activities = useQuery(api.activities.listActivities, { year: cursor.y }) as Activity[] | undefined;
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
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
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

  // ── Native horizontal scroll (trackpad/touch) → month transitions ──
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    let lastLeft = el.scrollLeft;
    const onScroll = () => {
      if (transitioningRef.current) return;
      const cur = el.scrollLeft;
      const dir = cur > lastLeft ? 1 : cur < lastLeft ? -1 : 0;
      lastLeft = cur;
      if (dir === 0) return;
      const max = el.scrollWidth - el.clientWidth;
      if (cur <= 2 && dir === -1) { transitionMonth(-1); return; }
      if (cur >= max - 2 && dir === 1) { transitionMonth(1); return; }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
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
    const uniqueIds = new Set<string>();
    let holidays = 0;
    for (const d of days) {
      d.events.forEach((ev) => uniqueIds.add(ev.id));
      const mmdd = d.key.slice(5);
      if (PH_HOLIDAYS_FIXED[mmdd] || PH_HOLIDAYS_MOVABLE[d.key]) holidays++;
    }
    return { events: uniqueIds.size, holidays, days: daysInMonth(cursor.y, cursor.m) };
  }, [days, cursor]);

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

      {/* Ambient orbs */}
      <div className="orb orb-1" aria-hidden />
      <div className="orb orb-2" aria-hidden />
      <div className="orb orb-3" aria-hidden />

      {/* Warp overlay */}
      <div className={`warp ${warp ? "active" : ""}`} aria-hidden />

      {/* ── Topbar ── */}
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">🏛</span>
          <span className="brand-text">
            <span className="brand-main">Digital Transformation Center</span>
            <span className="brand-sub">DICT Regional Office V · Events &amp; Activities</span>
          </span>
        </Link>
        <nav className="topnav">
          <button
            className="btn btn-ghost"
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
          <button className="btn btn-today" onClick={goToToday}>
            Jump to Today
          </button>
        </nav>
      </header>

      {/* ── Info panel ── */}
      <section className={`info ${fade ?? ""}`}>
        <div className="month-block">
          <div className="month-label">CALENDAR</div>
          <h1 className="month-name">{MONTHS[cursor.m]}</h1>
          <div className="month-year">{cursor.y}</div>
          <div className="month-stats">
            <div className="stat-item">
              <span className="stat-num">{monthStats.events}</span>
              <span className="stat-lbl">EVENTS</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{monthStats.holidays}</span>
              <span className="stat-lbl">HOLIDAYS</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{monthStats.days}</span>
              <span className="stat-lbl">DAYS</span>
            </div>
          </div>
        </div>

        {/* Preview / spotlight */}
        <div className="spotlight">
          {spotlightEvents ? (
            <>
              <div className="spot-label">
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
                      <div className="spot-meta">{ev.cat} · {ev.loc}</div>
                    </div>
                  </li>
                ))}
                {spotlightEvents.list.length > 4 && (
                  <li className="spot-more">+{spotlightEvents.list.length - 4} more</li>
                )}
              </ul>
            </>
          ) : (
            <div className="spot-hint">
              <div className="hint-icon-wrap">
                <span className="hint-icon">📅</span>
              </div>
              <div className="hint-body">
                <div className="hint-title">Hover a date to preview</div>
                <div className="hint-sub">Scroll to move through dates · Click an event for details</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Day strip ── */}
      <section className={`strip-wrap ${fade ?? ""}`}>
        {loading ? (
          <div className="loading"><span className="spin" /> Loading events…</div>
        ) : (
          <div className="strip" ref={stripRef} role="list">
            {days.map((d) => {
              const holiday = PH_HOLIDAYS_FIXED[d.key.slice(5)] || PH_HOLIDAYS_MOVABLE[d.key];
              return (
                <div
                  key={d.key}
                  data-day={d.key}
                  className={`day ${d.isToday ? "today" : ""} ${spotlight === d.key ? "active" : ""}`}
                  onMouseEnter={() => setSpotlight(d.key)}
                  onMouseMove={onCardMove}
                  onMouseLeave={onCardLeave}
                  role="listitem"
                >
                  <div className="day-head">
                    <div className="day-w">{d.w}</div>
                    <div className="day-n">{d.d}</div>
                    {d.isToday && <div className="day-today-badge">Today</div>}
                    {holiday && !d.isToday && <div className="day-holiday-badge">🎌</div>}
                  </div>
                  <div className="day-events">
                    {d.events.map((ev) => (
                      <button
                        key={ev.id}
                        className={`ev ${ev.grad}`}
                        onClick={(e) => { e.stopPropagation(); setModal(ev); }}
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
              );
            })}
            {days.length === 0 && <div className="loading">No days</div>}
          </div>
        )}
        <div className="strip-hint">
          ← SCROLL TO NAVIGATE &nbsp;·&nbsp; MONTH BOUNDARY AUTO-ADVANCES →
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
* { box-sizing: border-box; margin: 0; padding: 0; }

.event-root {
  --bg: #060914;
  --bg-card: rgba(255,255,255,0.035);
  --bg-card-hover: rgba(255,255,255,0.06);
  --ink: #dde3f0;
  --ink-dim: #6b7599;
  --line: rgba(255,255,255,0.07);
  --accent: #7c3aed;
  --accent-2: #2563eb;
  --today-glow: rgba(139,92,246,0.55);

  height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99,102,241,0.15) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 90% 110%, rgba(37,99,235,0.12) 0%, transparent 60%),
    var(--bg);
  color: var(--ink);
  font-family: Inter, system-ui, -apple-system, sans-serif;
  cursor: none;
  overflow: hidden;
  position: relative;
}
.event-root *, .event-root button, .event-root a { cursor: none; }

/* ── Ambient orbs ── */
.orb { position: fixed; pointer-events: none; border-radius: 50%; filter: blur(80px); opacity: 0.25; }
.orb-1 { width: 520px; height: 520px; top: -120px; left: 50%; transform: translateX(-50%);
  background: radial-gradient(circle, rgba(139,92,246,0.6), transparent 70%); }
.orb-2 { width: 300px; height: 300px; bottom: 80px; left: -60px;
  background: radial-gradient(circle, rgba(37,99,235,0.5), transparent 70%); }
.orb-3 { width: 220px; height: 220px; bottom: 0; right: 60px;
  background: radial-gradient(circle, rgba(99,102,241,0.45), transparent 70%); }

/* ── Custom cursor ── */
.cur-ring, .cur-dot {
  position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999;
  will-change: transform;
}
.cur-ring {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1.5px solid rgba(139,92,246,0.75);
  box-shadow: 0 0 18px rgba(139,92,246,0.35), inset 0 0 10px rgba(139,92,246,0.2);
  mix-blend-mode: screen;
}
.cur-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 6px #fff;
}

/* ── Warp overlay ── */
.warp {
  position: fixed; inset: 0; z-index: 9990;
  background: radial-gradient(circle at 50% 50%, rgba(139,92,246,0.65), rgba(6,9,20,0) 60%);
  opacity: 0; transition: opacity 420ms ease; pointer-events: none;
}
.warp.active { opacity: 1; }

/* ── Topbar ── */
.topbar {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 28px;
  border-bottom: 1px solid var(--line);
  background: rgba(6,9,20,0.7);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  position: relative; z-index: 20;
}
.brand {
  display: flex; align-items: center; gap: 12px;
  color: var(--ink); text-decoration: none;
}
.brand-icon { font-size: 22px; line-height: 1; }
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-main { font-size: 14px; font-weight: 700; color: #e8ecf5; letter-spacing: 0.01em; }
.brand-sub  { font-size: 11px; color: var(--ink-dim); margin-top: 1px; }
.topnav { display: flex; align-items: center; gap: 12px; }
.btn {
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.05);
  color: var(--ink);
  padding: 7px 16px;
  border-radius: 10px;
  font: 600 12px/1 Inter, system-ui;
  letter-spacing: 0.04em;
  transition: all 170ms ease;
}
.btn-ghost:hover:not(:disabled) {
  background: rgba(139,92,246,0.12);
  border-color: rgba(139,92,246,0.35);
}
.btn:disabled { opacity: 0.3; }
.btn-today {
  background: #fff;
  color: #0f0f1a;
  border-color: #fff;
  font-weight: 700;
  box-shadow: 0 0 18px rgba(255,255,255,0.12);
}
.btn-today:hover { background: #e8e8ff; }
.clock {
  font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
  font-size: 13px; color: var(--ink-dim);
  display: flex; align-items: center; gap: 8px;
}
.clock-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #10b981; box-shadow: 0 0 8px #10b981;
  animation: pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }

/* ── Info panel ── */
.info {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(200px, 30%) 1fr;
  gap: 20px;
  padding: 22px 28px 14px;
  transition: opacity 260ms ease, transform 260ms ease;
}
.info.out { opacity: 0; transform: translateY(-8px); }
.info.in  { opacity: 0; animation: fadeIn 280ms ease forwards; }
@keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }

.month-block { display: flex; flex-direction: column; }
.month-label {
  font: 700 10px/1 "JetBrains Mono", monospace;
  letter-spacing: 0.28em; color: var(--ink-dim); text-transform: uppercase;
}
.month-name {
  font-size: clamp(52px, 7.5vw, 96px);
  line-height: 0.9;
  font-weight: 900;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 55%, #7c3aed 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  margin: 6px 0 4px;
}
.month-year {
  font-family: "JetBrains Mono", monospace;
  font-size: 20px; color: var(--ink-dim); font-weight: 400;
}
.month-stats {
  display: flex; gap: 20px; margin-top: 18px; align-items: flex-end;
}
.stat-item { display: flex; flex-direction: column; }
.stat-num { font-size: 26px; font-weight: 800; color: var(--ink); line-height: 1; }
.stat-lbl {
  font-size: 10px; color: var(--ink-dim);
  text-transform: uppercase; letter-spacing: 0.14em; margin-top: 3px;
}

/* ── Spotlight / preview card ── */
.spotlight {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 18px 22px;
  background: rgba(255,255,255,0.025);
  display: flex; flex-direction: column; gap: 10px;
  min-height: 0;
  overflow: hidden;
}
.spot-label {
  font: 600 11px/1 "JetBrains Mono", monospace;
  letter-spacing: 0.2em; color: var(--ink-dim); text-transform: uppercase;
}
.spot-list {
  list-style: none; display: flex; flex-direction: column; gap: 8px;
}
.spot-list li {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 11px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--line);
  cursor: none; transition: all 140ms ease;
}
.spot-list li:hover { border-color: rgba(139,92,246,0.4); background: rgba(139,92,246,0.07); }
.swatch { width: 8px; height: 34px; border-radius: 3px; flex-shrink: 0; }
.spot-title { font-weight: 600; font-size: 13px; color: var(--ink); }
.spot-meta { font-size: 11px; color: var(--ink-dim); margin-top: 2px; }
.spot-more {
  color: var(--ink-dim); font-size: 11px; text-align: center; padding: 5px;
  list-style: none;
}

/* Hint card (when no date hovered) */
.spot-hint {
  display: flex; align-items: center; gap: 16px; padding: 6px 0;
}
.hint-icon-wrap {
  width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99,102,241,0.4), rgba(37,99,235,0.4));
  border: 1px solid rgba(99,102,241,0.35);
  display: grid; place-items: center; font-size: 22px;
}
.hint-title {
  font-size: 15px; font-weight: 700; color: #cdd5f0;
}
.hint-sub {
  font-size: 12px; color: var(--ink-dim); margin-top: 4px; line-height: 1.45;
}

/* ── Day strip ── */
.strip-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 4px 28px 0;
  min-height: 0;
  transition: opacity 260ms ease;
  overflow: hidden;
}
.strip-wrap.out { opacity: 0; }
.strip-wrap.in  { opacity: 0; animation: fadeIn 280ms ease forwards; }

.strip {
  flex: 1;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 12px 4px 16px;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgba(99,102,241,0.35) transparent;
}
.strip::-webkit-scrollbar { height: 4px; }
.strip::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 2px; }

.day {
  flex: 0 0 auto;
  width: 106px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  padding: 14px 10px 10px;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 160ms ease;
  will-change: transform;
  transform-style: preserve-3d;
}
.day:hover { border-color: rgba(99,102,241,0.4); background: var(--bg-card-hover); }
.day.today {
  border-color: rgba(139,92,246,0.7);
  background: rgba(99,102,241,0.08);
  box-shadow: 0 0 0 1px rgba(139,92,246,0.35), 0 8px 32px -8px var(--today-glow);
}
.day.active { border-color: rgba(139,92,246,0.6); }

.day-head { text-align: center; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.day-w {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px; font-weight: 700; color: var(--ink-dim); letter-spacing: 0.22em;
}
.day-n { font-size: 32px; font-weight: 900; line-height: 1.05; margin-top: 2px; color: var(--ink); }
.day-today-badge {
  display: inline-block; margin-top: 5px; padding: 2px 9px;
  border-radius: 999px; background: rgba(139,92,246,0.22); color: #c4b5fd;
  font-size: 8px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
}
.day-holiday-badge {
  display: inline-block; margin-top: 4px; font-size: 13px; line-height: 1;
}

.day-events {
  flex: 1; display: flex; flex-direction: column; gap: 5px; padding: 8px 0;
}
.ev {
  text-align: left; border: none; border-radius: 8px;
  padding: 6px 8px; color: #fff;
  font: 600 10px/1.3 Inter, sans-serif;
  display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 4px 12px -4px rgba(0,0,0,0.5);
  transition: transform 100ms ease, box-shadow 100ms ease;
  width: 100%;
}
.ev:hover { transform: translateY(-1px); box-shadow: 0 8px 16px -4px rgba(99,102,241,0.55); }
.ev-cat {
  font-size: 8px; opacity: 0.85; letter-spacing: 0.12em; text-transform: uppercase;
}
.ev-title {
  font-size: 10px;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

.day-foot { text-align: center; padding-top: 5px; min-height: 18px; }
.dot-count {
  display: inline-block; min-width: 18px; padding: 1px 5px; border-radius: 999px;
  background: rgba(99,102,241,0.2); color: #a5b4fc;
  font: 700 9px/1.4 "JetBrains Mono", monospace;
}

/* Scroll hint */
.strip-hint {
  flex-shrink: 0;
  text-align: center; color: var(--ink-dim);
  font: 600 9px/1 "JetBrains Mono", monospace;
  letter-spacing: 0.22em; text-transform: uppercase;
  padding: 6px 0 10px;
  border-top: 1px solid var(--line);
  margin-top: 2px;
  background: linear-gradient(to right, transparent, rgba(99,102,241,0.08) 50%, transparent);
}

/* ── Gradient event pill colours ── */
.g-forum    { background: linear-gradient(135deg, #7c3aed, #db2777); }
.g-training { background: linear-gradient(135deg, #0891b2, #2563eb); }
.g-holiday  { background: linear-gradient(135deg, #d97706, #dc2626); }
.g-workshop { background: linear-gradient(135deg, #059669, #0891b2); }
.g-seminar  { background: linear-gradient(135deg, #dc2626, #ea580c); }
.g-deploy   { background: linear-gradient(135deg, #ea580c, #ca8a04); }
.g-conf     { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
.g-talk     { background: linear-gradient(135deg, #db2777, #e11d48); }

/* ── Loading ── */
.loading {
  padding: 60px; text-align: center; color: var(--ink-dim); font-size: 14px;
}
.spin {
  display: inline-block; width: 13px; height: 13px; border-radius: 50%;
  border: 2px solid rgba(99,102,241,0.3); border-top-color: #7c3aed;
  animation: spin 700ms linear infinite; margin-right: 8px; vertical-align: -2px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Modal ── */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(6,9,20,0.8); backdrop-filter: blur(8px);
  display: grid; place-items: center; padding: 20px;
  animation: fadeIn 200ms ease forwards;
}
.modal {
  width: min(620px, 96vw); border-radius: 20px; overflow: hidden;
  border: 1px solid rgba(99,102,241,0.3);
  background: linear-gradient(180deg, #0d1128, #070914);
  box-shadow: 0 32px 80px -20px rgba(99,102,241,0.55);
}
.modal-hero { padding: 26px 26px 32px; position: relative; color: #fff; }
.modal-close {
  position: absolute; top: 14px; right: 14px;
  width: 32px; height: 32px; border-radius: 50%; border: none;
  background: rgba(0,0,0,0.4); color: #fff; font-size: 18px; line-height: 1;
  cursor: none;
}
.modal-badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px;
  background: rgba(0,0,0,0.35); font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
}
.modal-title { margin: 10px 0 6px; font-size: 26px; font-weight: 800; line-height: 1.15; }
.modal-sub { font-size: 12px; opacity: 0.8; font-family: "JetBrains Mono", monospace; }
.modal-body { padding: 18px 26px 26px; }
.modal-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 24px; margin-bottom: 16px; }
.modal-meta > div { display: flex; flex-direction: column; gap: 3px; }
.meta-k {
  font-size: 9px; color: var(--ink-dim); letter-spacing: 0.15em;
  text-transform: uppercase; font-family: "JetBrains Mono", monospace;
}
.meta-v { font-size: 13px; color: var(--ink); font-weight: 600; }
.meta-v.status {
  display: inline-block; padding: 3px 10px;
  background: rgba(99,102,241,0.18); border-radius: 999px;
  width: fit-content; font-size: 11px;
}
.modal-desc { color: var(--ink-dim); font-size: 13px; line-height: 1.65; margin: 0; }

/* ── Responsive ── */
@media (max-width: 700px) {
  .info { grid-template-columns: 1fr; padding: 16px 16px 10px; }
  .topbar { padding: 12px 16px; }
  .strip-wrap { padding: 4px 16px 0; }
  .clock { display: none; }
  .event-root { height: auto; overflow: auto; }
  .strip { overflow-x: auto; }
}
`;
