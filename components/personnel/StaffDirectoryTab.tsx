"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Mail, Building2, List, LayoutGrid, Grid3x3, Camera, Loader2, X, Check,
  History, ChevronDown, ChevronRight, Clock, LogIn, LogOut,
  Users, UserCheck, UserX, Plane, Search, Radio, Briefcase,
} from "lucide-react";

// ─── Face server config (mirrors app/(main)/attendance/register/page.tsx) ──
const FACE_SERVER_BASE =
  process.env.NEXT_PUBLIC_FACE_SERVER_HTTP ?? "http://localhost:8001";
const FACE_API_TOKEN = process.env.NEXT_PUBLIC_FACE_API_TOKEN ?? "";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

const LAYOUT_KEY = "personnel-logbook-layout";

type Status = "present" | "traveling" | "absent";
type Layout = "vertical" | "horizontal" | "compact";
const LAYOUTS: Layout[] = ["vertical", "horizontal", "compact"];

type Person = {
  _id: Id<"personnel">;
  firstName: string;
  lastName: string;
  position: string;
  division: string;
  email?: string;
  isActive: boolean;
  status: Status;
  lastAction: "time_in" | "time_out" | null;
  lastEventAt: string | null;
  isOverridden: boolean;
  photoUrl: string | null;
};

// ─── Status → styling ──────────────────────────────────────────────
// Each status colours the WHOLE box: a tinted card body (`card`) plus a solid
// label band (`band` + `bandLabel`) for a strong at-a-glance board look.
const STATUS_META: Record<Status, {
  label: string; bandLabel: string;
  ring: string; dot: string; badge: string; card: string; band: string;
}> = {
  present:   { label: "Present",         bandLabel: "Present",   ring: "ring-green-500", dot: "bg-green-500", badge: "bg-green-100 text-green-800 border-green-200", card: "border-green-300 bg-green-50", band: "bg-green-500" },
  traveling: { label: "Traveling / Out", bandLabel: "Traveling", ring: "ring-blue-500",  dot: "bg-blue-500",  badge: "bg-blue-100 text-blue-800 border-blue-200",   card: "border-blue-300 bg-blue-50",   band: "bg-blue-500" },
  absent:    { label: "Absent",          bandLabel: "Absent",    ring: "ring-gray-300",  dot: "bg-gray-400",  badge: "bg-gray-100 text-gray-600 border-gray-200",   card: "border-gray-300 bg-gray-100",  band: "bg-gray-400" },
};

type Toast = { kind: "ok" | "err"; text: string } | null;

export function StaffDirectoryTab() {
  const personnel = useQuery(api.personnel.listWithStatus, { isActive: true }) as
    | Person[] | undefined;

  const [isAdmin, setIsAdmin] = useState(false);
  const [layout, setLayout] = useState<Layout>("horizontal");
  const [toast, setToast] = useState<Toast>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [selectedId, setSelectedId] = useState<Id<"personnel"> | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Resolve role (admin/manager get the management controls).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const role = data?.user?.role;
        if (!cancelled) setIsAdmin(role === "admin" || role === "manager");
      } catch {
        /* non-admin / signed out — controls stay hidden */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persisted layout preference.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(LAYOUT_KEY) : null;
    if (saved && (LAYOUTS as string[]).includes(saved)) setLayout(saved as Layout);
  }, []);
  const changeLayout = (l: Layout) => {
    setLayout(l);
    try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* ignore */ }
  };

  // Coarse "now" for the relative "x ago" labels — updates every 30s (the
  // strings only change at minute granularity), so the whole board doesn't
  // re-render every second. The header's seconds clock is isolated in <LiveClock/>.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => {
    const c = { present: 0, traveling: 0, absent: 0 };
    for (const p of personnel ?? []) c[p.status]++;
    return c;
  }, [personnel]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (personnel ?? []).filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!needle) return true;
      return (
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle) ||
        p.position.toLowerCase().includes(needle) ||
        p.division.toLowerCase().includes(needle) ||
        (p.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [personnel, q, filter]);

  const loading = personnel === undefined;
  const total = personnel?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* ── Board header: title + live clock ─────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight text-gray-900">Attendance Board</h2>
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live · {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* ── Stat tiles (click to filter) ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Present" count={counts.present} accent="green" icon={<UserCheck className="h-5 w-5" />}
          active={filter === "present"} onClick={() => setFilter(filter === "present" ? "all" : "present")} pulse />
        <StatTile label="Traveling / Out" count={counts.traveling} accent="blue" icon={<Plane className="h-5 w-5" />}
          active={filter === "traveling"} onClick={() => setFilter(filter === "traveling" ? "all" : "traveling")} />
        <StatTile label="Absent" count={counts.absent} accent="gray" icon={<UserX className="h-5 w-5" />}
          active={filter === "absent"} onClick={() => setFilter(filter === "absent" ? "all" : "absent")} />
        <StatTile label="Total Staff" count={total} accent="slate" icon={<Briefcase className="h-5 w-5" />}
          active={filter === "all"} onClick={() => setFilter("all")} />
      </div>

      {/* ── Toolbar: search + layout toggle ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, position, division…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filter !== "all" && (
            <button onClick={() => setFilter("all")}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">
              {STATUS_META[filter].label} <X className="h-3 w-3" />
            </button>
          )}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            <LayoutButton active={layout === "vertical"} onClick={() => changeLayout("vertical")} label="List view">
              <List className="h-4 w-4" />
            </LayoutButton>
            <LayoutButton active={layout === "horizontal"} onClick={() => changeLayout("horizontal")} label="Card view">
              <LayoutGrid className="h-4 w-4" />
            </LayoutButton>
            <LayoutButton active={layout === "compact"} onClick={() => changeLayout("compact")} label="Faces (compact)">
              <Grid3x3 className="h-4 w-4" />
            </LayoutButton>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm " +
            (toast.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-900")
          }
        >
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Board body ───────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <Radio className="h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">No one matches your view</p>
          <p className="text-xs text-gray-400">
            {q || filter !== "all" ? "Try clearing the search or filter." : "Register staff from the Attendance page to populate the board."}
          </p>
        </div>
      ) : layout === "vertical" ? (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PersonRow key={p._id} person={p} isAdmin={isAdmin} setToast={setToast} now={now} />
          ))}
        </div>
      ) : layout === "horizontal" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PersonCard key={p._id} person={p} isAdmin={isAdmin} setToast={setToast} now={now} />
          ))}
        </div>
      ) : (
        // ── Compact "Faces" view: dense face wall + drill-down detail ──
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {filtered.map((p) => (
              <CompactTile
                key={p._id}
                person={p}
                selected={selectedId === p._id}
                onSelect={() => setSelectedId(selectedId === p._id ? null : p._id)}
              />
            ))}
          </div>
          {(() => {
            const sel = filtered.find((p) => p._id === selectedId);
            return sel ? (
              <CompactDetail
                person={sel}
                isAdmin={isAdmin}
                setToast={setToast}
                now={now}
                onClose={() => setSelectedId(null)}
              />
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Header helpers ────────────────────────────────────────────────
const TILE_ACCENT: Record<string, { ring: string; icon: string; num: string }> = {
  green: { ring: "ring-green-500 border-green-300 bg-green-50", icon: "bg-green-500", num: "text-green-700" },
  blue:  { ring: "ring-blue-500 border-blue-300 bg-blue-50",   icon: "bg-blue-500",  num: "text-blue-700" },
  gray:  { ring: "ring-gray-400 border-gray-300 bg-gray-50",   icon: "bg-gray-400",  num: "text-gray-700" },
  slate: { ring: "ring-slate-600 border-slate-300 bg-slate-50", icon: "bg-slate-700", num: "text-slate-800" },
};

function StatTile({
  label, count, accent, icon, active, onClick, pulse,
}: {
  label: string; count: number; accent: keyof typeof TILE_ACCENT;
  icon: React.ReactNode; active: boolean; onClick: () => void; pulse?: boolean;
}) {
  const a = TILE_ACCENT[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group flex items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:shadow-md " +
        (active ? `ring-2 ${a.ring}` : "border-gray-200")
      }
    >
      <div className={`relative flex h-11 w-11 items-center justify-center rounded-xl text-white ${a.icon}`}>
        {icon}
        {pulse && count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-green-500" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold leading-none tabular-nums ${a.num}`}>{count}</div>
        <div className="mt-1 truncate text-xs font-medium text-gray-500">{label}</div>
      </div>
    </button>
  );
}

function LayoutButton({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-7 w-8 items-center justify-center rounded-md transition " +
        (active ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100")
      }
    >
      {children}
    </button>
  );
}

/** Self-contained seconds clock — isolated so its 1s tick never re-renders
 *  the personnel list. */
function LiveClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right">
      <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-gray-900">
        {t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">Local time</p>
    </div>
  );
}

// ─── Last-seen helper ──────────────────────────────────────────────
function lastSeen(person: Person): string {
  if (!person.lastEventAt) return "Not seen today";
  const d = new Date(person.lastEventAt);
  const time = isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const verb = person.lastAction === "time_out" ? "Out" : "In";
  return time ? `${verb} · ${time}` : person.status;
}

/** Compact "3m / 2h / 1d ago" relative to `now`. Empty when no event. */
function relativeAgo(iso: string | null, now: Date): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// ─── Avatar ────────────────────────────────────────────────────────
function Avatar({ person, size }: { person: Person; size: "sm" | "lg" }) {
  const m = STATUS_META[person.status];
  const dim = size === "lg" ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm";
  return (
    <div className={`relative shrink-0 rounded-full ring-2 ${m.ring} ring-offset-2`}>
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photoUrl}
          alt={`${person.firstName} ${person.lastName}`}
          className={`${dim} rounded-full object-cover`}
        />
      ) : (
        <div className={`${dim} flex items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700`}>
          {(person.firstName[0] ?? "") + (person.lastName[0] ?? "")}
        </div>
      )}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${m.dot}`}
        title={m.label}
      />
    </div>
  );
}

// ─── Vertical row ──────────────────────────────────────────────────
const PersonRow = memo(function PersonRow({ person, isAdmin, setToast, now }: PersonProps) {
  const m = STATUS_META[person.status];
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden rounded-xl border-2 shadow-sm transition hover:shadow-md ${m.card}`}>
      <div className="flex items-stretch">
        {/* Solid vertical status label band */}
        <div className={`flex items-center justify-center px-2 ${m.band}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white [writing-mode:vertical-rl] rotate-180">
            {m.bandLabel}{person.isOverridden ? " ·M" : ""}
          </span>
        </div>
        <div className="flex flex-1 items-center gap-3 p-3">
          <Avatar person={person} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gray-900">
              {person.firstName} {person.lastName}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-600">{person.position}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />{person.division}
              </span>
              {person.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /><span className="truncate">{person.email}</span>
                </span>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
              <Clock className="h-3 w-3 text-gray-400" />{lastSeen(person)}
            </div>
            <div className="text-[11px] text-gray-400">{relativeAgo(person.lastEventAt, now)}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <HistoryToggle open={open} onToggle={() => setOpen((v) => !v)} />
            {isAdmin && <AdminControls person={person} setToast={setToast} />}
          </div>
        </div>
      </div>
      {open && <AttendanceHistoryPanel personId={person._id} />}
    </div>
  );
});

// ─── Horizontal card ───────────────────────────────────────────────
const PersonCard = memo(function PersonCard({ person, isAdmin, setToast, now }: PersonProps) {
  const m = STATUS_META[person.status];
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden rounded-xl border-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${m.card}`}>
      {/* Solid status label band across the top */}
      <div className={`flex items-center justify-between px-3 py-1.5 ${m.band}`}>
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          {m.bandLabel}{person.isOverridden ? " · Manual" : ""}
        </span>
        <span className="text-[10px] font-medium text-white/80">{relativeAgo(person.lastEventAt, now)}</span>
      </div>
      <div className="flex flex-col items-center p-4 text-center">
        <Avatar person={person} size="lg" />
        <p className="mt-2 truncate w-full font-semibold text-gray-900">
          {person.firstName} {person.lastName}
        </p>
        <p className="mt-0.5 truncate w-full text-xs text-gray-600">{person.position}</p>
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
          <Building2 className="h-3 w-3" />{person.division}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          <Clock className="h-3 w-3 text-gray-400" />{lastSeen(person)}
        </div>
        <div className="mt-3 flex w-full items-center justify-center gap-1.5">
          <HistoryToggle open={open} onToggle={() => setOpen((v) => !v)} />
          {isAdmin && <AdminControls person={person} setToast={setToast} />}
        </div>
      </div>
      {open && <AttendanceHistoryPanel personId={person._id} />}
    </div>
  );
});

type PersonProps = { person: Person; isAdmin: boolean; setToast: (t: Toast) => void; now: Date };

// ─── Compact "Faces" tile ──────────────────────────────────────────
const CompactTile = memo(function CompactTile({
  person, selected, onSelect,
}: { person: Person; selected: boolean; onSelect: () => void }) {
  const m = STATUS_META[person.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${person.firstName} ${person.lastName} — ${m.label}`}
      className={
        "group flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition hover:shadow-md " +
        (selected ? `${m.card} ring-2 ${m.ring}` : `${m.card}`)
      }
    >
      <div className={`relative rounded-full ring-2 ${m.ring} ring-offset-1`}>
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoUrl}
            alt={`${person.firstName} ${person.lastName}`}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
            {(person.firstName[0] ?? "") + (person.lastName[0] ?? "")}
          </div>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${m.dot}`} />
      </div>
      <span className="w-full truncate text-center text-[11px] font-semibold text-gray-800">
        {person.firstName}
      </span>
    </button>
  );
});

// ─── Compact view drill-down detail panel ──────────────────────────
function CompactDetail({
  person, isAdmin, setToast, now, onClose,
}: PersonProps & { onClose: () => void }) {
  const m = STATUS_META[person.status];
  return (
    <div className={`overflow-hidden rounded-xl border-2 shadow-sm ${m.card}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 ${m.band}`}>
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          {m.bandLabel}{person.isOverridden ? " · Manual" : ""}
        </span>
        <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 p-3">
        <Avatar person={person} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">
            {person.firstName} {person.lastName}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-600">{person.position}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />{person.division}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-400" />{lastSeen(person)}
              <span className="text-gray-400">· {relativeAgo(person.lastEventAt, now)}</span>
            </span>
          </div>
        </div>
        {isAdmin && <AdminControls person={person} setToast={setToast} />}
      </div>
      <AttendanceHistoryPanel personId={person._id} />
    </div>
  );
}

// ─── Attendance history follow-ups ─────────────────────────────────
function HistoryToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Attendance history"
      className="inline-flex items-center gap-0.5 rounded-lg border border-gray-300 bg-white/80 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
    >
      <History className="h-3.5 w-3.5" />
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  );
}

type HistoryEvent = {
  _id: string;
  action: "time_in" | "time_out";
  timestamp: string;
  confidence: number;
};

function AttendanceHistoryPanel({ personId }: { personId: Id<"personnel"> }) {
  const history = useQuery(api.personnel.attendanceHistory, { id: personId, limit: 20 }) as
    | HistoryEvent[] | undefined;
  return (
    <div className="border-t border-white/70 bg-white/70 px-4 py-2">
      {history === undefined ? (
        <p className="py-1 text-xs text-gray-400">Loading history…</p>
      ) : history.length === 0 ? (
        <p className="py-1 text-xs text-gray-400">No recognized events in the last 60 days.</p>
      ) : (
        <ul className="space-y-1">
          {history.map((e) => (
            <li key={e._id} className="flex items-center gap-2 text-xs text-gray-600">
              {e.action === "time_in"
                ? <LogIn className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                : <LogOut className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />}
              <span className="font-medium text-gray-800">
                {e.action === "time_in" ? "Time in" : "Time out"}
              </span>
              <Clock className="h-3 w-3 text-gray-300" />
              <span>{formatEventTime(e.timestamp)}</span>
              <span className="ml-auto text-gray-400">{Math.round(e.confidence * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ─── Admin controls: photo upload + status override ────────────────
function AdminControls({ person, setToast }: { person: Person; setToast: (t: Toast) => void }) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const setPhoto = useMutation(api.personnel.setPhoto);
  const setStatus = useMutation(api.personnel.setStatus);
  const clearStatusOverride = useMutation(api.personnel.clearStatusOverride);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setToast({ kind: "err", text: "Only JPEG and PNG are supported." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setToast({ kind: "err", text: `File too large. Max is 8 MB.` });
      return;
    }

    setUploading(true);
    try {
      // 1) Store the display photo in Convex.
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
      const { storageId } = await res.json();
      await setPhoto({ id: person._id, storageId });

      // 2) Enroll the same image on the face server so they stay recognizable.
      //    Non-fatal: the photo is already saved regardless.
      let faceWarning = "";
      try {
        const form = new FormData();
        form.append("userId", person._id);
        form.append("name", `${person.firstName} ${person.lastName}`);
        form.append("role", "staff");
        form.append("program", person.division);
        form.append("file", file, "face.jpg");
        const headers: Record<string, string> = {};
        if (FACE_API_TOKEN) headers["X-Face-Api-Token"] = FACE_API_TOKEN;
        const fr = await fetch(`${FACE_SERVER_BASE}/api/register`, {
          method: "POST", headers, body: form,
        });
        if (!fr.ok) {
          const j = await fr.json().catch(() => ({}));
          faceWarning = ` Face enrollment skipped: ${j.detail ?? j.error ?? `HTTP ${fr.status}`}.`;
        }
      } catch {
        faceWarning = " Photo saved, but the face server was unreachable — enroll later from the Register page.";
      }

      setToast({
        kind: faceWarning ? "err" : "ok",
        text: `Photo updated for ${person.firstName}.${faceWarning}`,
      });
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setUploading(false);
    }
  };

  const onStatusChange = async (value: string) => {
    try {
      if (value === "auto") {
        await clearStatusOverride({ id: person._id });
      } else {
        await setStatus({ id: person._id, status: value as Status });
      }
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Upload photo (also enrolls for face recognition)"
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        Photo
      </button>
      <select
        value={person.isOverridden ? person.status : "auto"}
        onChange={(e) => onStatusChange(e.target.value)}
        title="Override status for today"
        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="auto">Auto{person.isOverridden ? "" : " ✓"}</option>
        <option value="present">Present</option>
        <option value="traveling">Traveling</option>
        <option value="absent">Absent</option>
      </select>
      {person.isOverridden && <Check className="h-3.5 w-3.5 text-amber-500" />}
    </div>
  );
}
