"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────
type TodayRecord = {
  id:         string;
  timeIn:     string | null;
  timeOut:    string | null;
  hours:      number | null;
  lunchStart: string | null;
  lunchEnd:   string | null;
};

type InternRow = {
  id:            string;
  fullName:      string;
  school:        string;
  course:        string;
  department:    string | null;
  photoUrl:      string | null;
  totalHours:    number;
  requiredHours: number;
  today:         TodayRecord | null;
};

type WorkStatus = "not_in" | "active" | "on_lunch" | "checked_out";

// ── Constants / helpers ────────────────────────────────────────────────────
const SCHOOL_PALETTE = [
  { bg:"bg-blue-100",   text:"text-blue-700",   dot:"bg-blue-500",   ring:"ring-blue-200",   grad:"from-blue-500 to-indigo-600",   light:"bg-blue-50",   border:"border-blue-200"   },
  { bg:"bg-purple-100", text:"text-purple-700", dot:"bg-purple-500", ring:"ring-purple-200", grad:"from-purple-500 to-purple-700", light:"bg-purple-50", border:"border-purple-200" },
  { bg:"bg-emerald-100",text:"text-emerald-700",dot:"bg-emerald-500",ring:"ring-emerald-200",grad:"from-emerald-500 to-green-600",  light:"bg-emerald-50",border:"border-emerald-200"},
  { bg:"bg-orange-100", text:"text-orange-700", dot:"bg-orange-500", ring:"ring-orange-200", grad:"from-orange-500 to-amber-500",  light:"bg-orange-50", border:"border-orange-200" },
  { bg:"bg-rose-100",   text:"text-rose-700",   dot:"bg-rose-500",   ring:"ring-rose-200",   grad:"from-rose-500 to-pink-600",    light:"bg-rose-50",   border:"border-rose-200"   },
  { bg:"bg-teal-100",   text:"text-teal-700",   dot:"bg-teal-500",   ring:"ring-teal-200",   grad:"from-teal-500 to-cyan-600",    light:"bg-teal-50",   border:"border-teal-200"   },
  { bg:"bg-indigo-100", text:"text-indigo-700", dot:"bg-indigo-500", ring:"ring-indigo-200", grad:"from-indigo-500 to-blue-600",  light:"bg-indigo-50", border:"border-indigo-200" },
  { bg:"bg-amber-100",  text:"text-amber-700",  dot:"bg-amber-500",  ring:"ring-amber-200",  grad:"from-amber-500 to-yellow-500", light:"bg-amber-50",  border:"border-amber-200"  },
] as const;

function schoolColor(school: string) {
  let h = 0;
  for (let i = 0; i < school.length; i++) h = (school.charCodeAt(i) + ((h << 5) - h)) | 0;
  return SCHOOL_PALETTE[Math.abs(h) % SCHOOL_PALETTE.length];
}

function getStatus(today: TodayRecord | null): WorkStatus {
  if (!today?.timeIn) return "not_in";
  if (today.timeOut)  return "checked_out";
  if (today.lunchStart && !today.lunchEnd) return "on_lunch";
  return "active";
}

/** Elapsed ms — subtracts lunch duration when working, shows lunch duration when on lunch */
function calcElapsed(today: TodayRecord | null, status: WorkStatus, now: number): { work: number; lunch: number } {
  if (!today?.timeIn) return { work: 0, lunch: 0 };

  const inMs   = new Date(today.timeIn).getTime();
  const outMs  = today.timeOut ? new Date(today.timeOut).getTime() : now;

  const lunchStartMs = today.lunchStart ? new Date(today.lunchStart).getTime() : null;
  const lunchEndMs   = today.lunchEnd   ? new Date(today.lunchEnd).getTime()   : null;

  const lunchDuration = lunchStartMs
    ? (lunchEndMs ?? (status === "on_lunch" ? now : lunchStartMs)) - lunchStartMs
    : 0;

  const workMs = Math.max(0, outMs - inMs - lunchDuration);
  const lunchMs = lunchStartMs ? Math.max(0, (lunchEndMs ?? now) - lunchStartMs) : 0;

  return { work: workMs, lunch: lunchMs };
}

const fmt = (ms: number) => {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });

// ── Sub-components ─────────────────────────────────────────────────────────
function Avatar({ name, photo, size = "md" }: { name: string; photo?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "w-9 h-9 text-xs", md: "w-12 h-12 text-sm", lg: "w-16 h-16 text-xl" }[size];
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (photo) return <img src={photo} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow`} />;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow`}>
      {initials}
    </div>
  );
}

function HoursBar({ current, required }: { current: number; required: number }) {
  const pct = Math.min(100, Math.round((current / required) * 100));
  const bar  = pct >= 100 ? "from-green-400 to-emerald-500" : pct >= 70 ? "from-blue-400 to-indigo-500" : pct >= 40 ? "from-yellow-400 to-orange-400" : "from-red-400 to-rose-500";
  const txt  = pct >= 100 ? "text-green-600" : pct >= 70 ? "text-blue-600" : "text-orange-600";
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] text-gray-400">{Math.round(current)}h / {required}h</span>
        <span className={`text-[11px] font-bold ${txt}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full bg-gradient-to-r ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: WorkStatus }) {
  const map: Record<WorkStatus, { label: string; cls: string; dot: string }> = {
    not_in:      { label: "Not In",       cls: "bg-gray-100 text-gray-500 border-gray-200",      dot: "bg-gray-400"  },
    active:      { label: "Working",      cls: "bg-green-50 text-green-700 border-green-200",     dot: "bg-green-500" },
    on_lunch:    { label: "On Lunch",     cls: "bg-amber-50 text-amber-700 border-amber-200",     dot: "bg-amber-400" },
    checked_out: { label: "Checked Out",  cls: "bg-blue-50 text-blue-600 border-blue-200",        dot: "bg-blue-400"  },
  };
  const { label, cls, dot } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot} ${status === "active" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
type Toast = { msg: string; ok: boolean };

// ── Main Page ──────────────────────────────────────────────────────────────
export default function InternLogbookPage() {
  const interns     = useQuery(api.internPublic.getActiveInterns);
  const doStartLunch = useMutation(api.internPublic.startLunch);
  const doEndLunch   = useMutation(api.internPublic.endLunch);

  const [search, setSearch]   = useState("");
  const [now,    setNow]      = useState(() => Date.now());
  const [toast,  setToast]    = useState<Toast | null>(null);
  const [busy,   setBusy]     = useState<string | null>(null); // internId being mutated

  // 1-second tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Stats
  const stats = useMemo(() => {
    if (!interns) return null;
    const active    = interns.filter(i => getStatus(i.today) === "active").length;
    const onLunch   = interns.filter(i => getStatus(i.today) === "on_lunch").length;
    const checkedOut= interns.filter(i => getStatus(i.today) === "checked_out").length;
    const notIn     = interns.filter(i => getStatus(i.today) === "not_in").length;
    return { total: interns.length, active, onLunch, checkedOut, notIn };
  }, [interns]);

  const filtered = useMemo(() => {
    if (!interns) return [];
    const q = search.toLowerCase();
    if (!q) return interns;
    return interns.filter(i =>
      i.fullName.toLowerCase().includes(q) ||
      i.school.toLowerCase().includes(q) ||
      i.course.toLowerCase().includes(q)
    );
  }, [interns, search]);

  async function handleLunch(intern: InternRow) {
    const status = getStatus(intern.today);
    if (status !== "active" && status !== "on_lunch") return;
    setBusy(intern.id);
    try {
      if (status === "active") {
        await doStartLunch({ internId: intern.id as Id<"interns"> });
        showToast(`${intern.fullName.split(" ")[0]} is now on lunch break 🍽️`);
      } else {
        await doEndLunch({ internId: intern.id as Id<"interns"> });
        showToast(`${intern.fullName.split(" ")[0]} resumed work ▶`);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Something went wrong", false);
    } finally {
      setBusy(null);
    }
  }

  const loading = interns === undefined;

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all ${toast.ok ? "bg-green-600" : "bg-red-500"}`} style={{ minWidth: 240 }}>
          <span>{toast.ok ? "✓" : "⚠️"}</span>
          <p className="flex-1">{toast.msg}</p>
        </div>
      )}

      {/* ── Government Header ─────────────────────────────────────────── */}
      <header className="bg-[#0b3d91] shadow-lg flex-shrink-0">
        {/* PH flag stripe */}
        <div className="flex h-1.5">
          <div className="flex-1 bg-[#0038A8]" />
          <div className="flex-1 bg-[#CE1126]" />
          <div className="flex-1 bg-[#FCD116]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Seal placeholder */}
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl flex-shrink-0">🎓</div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">DTC Region V · Intern Logbook</p>
              <p className="text-blue-200 text-xs">Digital Transformation Center — Public Board</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-blue-200 text-xs">{today}</span>
            <Link href="/" className="text-xs px-3 py-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-all">
              ← Home
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      {stats && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {[
              { label: "Total",       val: stats.total,      color: "text-gray-700"   },
              { label: "Working",     val: stats.active,     color: "text-green-600"  },
              { label: "On Lunch",    val: stats.onLunch,    color: "text-amber-600"  },
              { label: "Checked Out", val: stats.checkedOut, color: "text-blue-600"   },
              { label: "Not In",      val: stats.notIn,      color: "text-gray-400"   },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                <span className={`text-lg font-black ${s.color}`}>{s.val}</span>
                <span className="text-xs text-gray-500 font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

        {/* Search */}
        <div className="relative max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search intern name, school or course…"
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse space-y-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                    <div className="h-2 bg-gray-100 rounded-full w-1/2" />
                  </div>
                </div>
                <div className="h-8 bg-gray-100 rounded-xl" />
                <div className="h-2 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-gray-500 text-sm">{search ? "No interns match your search." : "No active interns at the moment."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(intern => (
              <InternCard
                key={intern.id}
                intern={intern}
                now={now}
                busy={busy === intern.id}
                onLunchToggle={() => handleLunch(intern)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-4">
        <p className="text-center text-xs text-gray-400">
          DTC Region V Intern Logbook · Public Board
          <span className="mx-2">·</span>
          <Link href="/intern-portal" className="text-blue-500 hover:underline">Intern Portal</Link>
        </p>
      </footer>
    </div>
  );
}

// ── Intern Card ────────────────────────────────────────────────────────────
function InternCard({
  intern,
  now,
  busy,
  onLunchToggle,
}: {
  intern:       InternRow;
  now:          number;
  busy:         boolean;
  onLunchToggle: () => void;
}) {
  const sc     = schoolColor(intern.school);
  const status = getStatus(intern.today);
  const { work: workMs, lunch: lunchMs } = calcElapsed(intern.today, status, now);

  const isActive    = status === "active";
  const isOnLunch   = status === "on_lunch";
  const isCheckedOut= status === "checked_out";

  // Card border accent by status
  const cardRing = isActive
    ? "ring-2 ring-green-300"
    : isOnLunch
    ? "ring-2 ring-amber-300"
    : isCheckedOut
    ? "ring-1 ring-blue-200"
    : "ring-1 ring-gray-100";

  return (
    <div className={`bg-white rounded-2xl shadow-sm ${cardRing} p-4 flex flex-col gap-3 transition-all`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar name={intern.fullName} photo={intern.photoUrl} size="md" />
          {isActive   && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />}
          {isOnLunch  && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm leading-tight truncate">{intern.fullName}</p>
          <p className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${sc.bg} ${sc.text}`}>
            {intern.school}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{intern.course}</p>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Time display */}
      {(isActive || isOnLunch || isCheckedOut) && intern.today && (
        <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1.5">
          {/* Time In / Out row */}
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>
              <span className="font-semibold text-gray-700">In: </span>
              {intern.today.timeIn ? fmtTime(intern.today.timeIn) : "—"}
            </span>
            {intern.today.timeOut && (
              <span>
                <span className="font-semibold text-gray-700">Out: </span>
                {fmtTime(intern.today.timeOut)}
              </span>
            )}
          </div>

          {/* Work timer */}
          {(isActive || isOnLunch) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-medium w-12">Work</span>
              <span className={`font-mono text-sm font-bold tracking-wider ${isActive ? "text-green-600" : "text-gray-500"}`}>
                {fmt(workMs)}
              </span>
            </div>
          )}

          {/* Checked out total */}
          {isCheckedOut && intern.today.hours != null && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-medium w-12">Total</span>
              <span className="font-bold text-blue-600 text-sm">{intern.today.hours}h</span>
            </div>
          )}

          {/* Lunch timer */}
          {(isOnLunch || (intern.today.lunchStart && intern.today.lunchEnd)) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-500 font-medium w-12">Lunch</span>
              <span className={`font-mono text-sm font-bold tracking-wider ${isOnLunch ? "text-amber-500" : "text-gray-400"}`}>
                {fmt(lunchMs)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Not in yet */}
      {status === "not_in" && (
        <div className="bg-gray-50 rounded-xl px-3 py-3 text-center">
          <p className="text-gray-400 text-xs">Not yet checked in today</p>
        </div>
      )}

      {/* Hours progress */}
      <HoursBar current={intern.totalHours} required={intern.requiredHours} />

      {/* Lunch toggle button */}
      {(isActive || isOnLunch) && (
        <button
          onClick={onLunchToggle}
          disabled={busy}
          className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50
            ${isOnLunch
              ? "bg-green-50 text-green-700 border-2 border-green-300 hover:bg-green-100"
              : "bg-amber-50 text-amber-700 border-2 border-amber-300 hover:bg-amber-100"
            }`}
        >
          {busy ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isOnLunch ? (
            <>▶ Resume Work</>
          ) : (
            <>🍽 Start Lunch Break</>
          )}
        </button>
      )}
    </div>
  );
}
