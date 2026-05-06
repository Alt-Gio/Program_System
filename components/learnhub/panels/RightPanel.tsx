"use client";

/**
 * Unified LearnHub right panel.
 *
 * One scroll-friendly column that combines what used to be two
 * separate modes (Suggested/Top-XP/Explore vs Events/Online) into a
 * single denser panel. Sections, top to bottom:
 *
 *   1. ── Me card ─── avatar + name + Facebook-style STATUS picker
 *                     (Active / Away / Do Not Disturb / Invisible).
 *                     The choice is persisted in localStorage and
 *                     will be forwarded to the Convex presence
 *                     heartbeat when learnhub_presence ships.
 *
 *   2. ── Upcoming Events ── top 4, "View all" link expands to the
 *                     /learning-path page.
 *
 *   3. ── People Online ──── mentors + students only (policy:
 *                     org_partner and admin are excluded). Uses
 *                     usePresenceMock() today; swap for a Convex
 *                     query when the presence table lands.
 *
 *   4. ── Suggested for you ── same role filter, excludes self and
 *                     anyone already online above.
 *
 *   5. ── Top XP ── leaderboard-lite from learnhub_bookmarks.getLeaderboard.
 *
 *   6. ── Explore ── static in-site links.
 *
 * Every section uses the existing .lh-card container so dark/light
 * mode keeps working through the --lh-* tokens; the mini-profile
 * and status picker get their own compact classes added in
 * learnhub.css.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChevronDown, Calendar, MapPin } from "lucide-react";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { usePresenceMock } from "@/lib/learnhub/presence";
import { DTC_OFFICES } from "@/lib/learnhub/dtc-offices";
import { DtcOfficeModal } from "@/components/learnhub/dtc/DtcOfficeModal";

// ─────────────────────────── Status model ───────────────────────────

type Status = "online" | "away" | "busy" | "invisible";

const STATUS_META: Record<Status, { label: string; color: string; hint: string }> = {
  online:    { label: "Active",         color: "#10B981", hint: "Others can see you're online" },
  away:      { label: "Away",           color: "#F59E0B", hint: "Still around, just idle" },
  busy:      { label: "Do Not Disturb", color: "#EF4444", hint: "Mute mentions & DMs" },
  invisible: { label: "Appear offline", color: "#94A3B8", hint: "Browse without presence" },
};

const STATUS_KEY = "lh-user-status";

function useUserStatus() {
  const [status, setStatus] = useState<Status>("online");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATUS_KEY) as Status | null;
      if (saved && saved in STATUS_META) setStatus(saved);
    } catch { /* ignore */ }
  }, []);

  function choose(next: Status) {
    setStatus(next);
    try { localStorage.setItem(STATUS_KEY, next); } catch { /* ignore */ }
    // TODO: when convex/learnhub_presence.ts lands, fire the heartbeat
    // mutation here with the new status so other tabs/users see it.
  }
  return [status, choose] as const;
}

// ─────────────────────────── Mock events ───────────────────────────

type EventStatus = "Open" | "Upcoming" | "Register";

type EventRow = {
  id: string; title: string; org: string;
  date: string; time: string; status: EventStatus;
};

const MOCK_EVENTS: EventRow[] = [
  { id: "e1", title: "SPARK Leadership Webinar",         org: "DICT Region V", date: "May 3",  time: "2:00 PM", status: "Open" },
  { id: "e2", title: "Tech4ED Teachers Workshop",        org: "DepEd R-V",     date: "May 5",  time: "9:00 AM", status: "Upcoming" },
  { id: "e3", title: "Cybersecurity Awareness Training", org: "DICT-V",        date: "May 8",  time: "1:00 PM", status: "Open" },
  { id: "e4", title: "Cloud Computing 101 Bootcamp",     org: "Tech Hub Naga", date: "May 10", time: "3:00 PM", status: "Register" },
];

function statusBadge(s: EventStatus) {
  if (s === "Open")     return { bg: "rgba(16,185,129,0.15)", color: "#10B981" };
  if (s === "Upcoming") return { bg: "rgba(168,85,247,0.18)", color: "#A855F7" };
  return { bg: "rgba(99,102,241,0.18)", color: "#818CF8" };
}

// ─────────────────────────── Component ───────────────────────────

export function RightPanel() {
  const { userId, session } = useLearnhubSession();

  const me = useQuery(
    api.learnhub_users.getUser,
    userId ? { id: userId as Id<"learnhub_users"> } : "skip"
  );

  const allUsers    = useQuery(api.learnhub_users.listUsers);
  const leaderboard = useQuery(api.learnhub_bookmarks.getLeaderboard, { limit: 4 });

  // Policy: presence UI is limited to mentors and students. org_partner
  // and admin are never surfaced in the "online" or "suggested" lists.
  const peerPool = useMemo(
    () => (allUsers ?? []).filter(
      (u) => u._id !== userId && (u.role === "mentor" || u.role === "student")
    ),
    [allUsers, userId]
  );

  const onlineIds   = usePresenceMock(peerPool.map((u) => u._id));
  const onlineUsers = useMemo(
    () => peerPool.filter((u) => onlineIds.has(u._id)).slice(0, 6),
    [peerPool, onlineIds]
  );
  const suggestions = useMemo(
    () => peerPool.filter((u) => !onlineIds.has(u._id)).slice(0, 3),
    [peerPool, onlineIds]
  );

  const [status, setStatus] = useUserStatus();

  return (
    <div className="lh-rp">
      <MeCard session={session} me={me} status={status} onStatus={setStatus} />
      <EventsCard />
      <PeopleOnlineCard users={onlineUsers} loading={allUsers === undefined} />
      <SuggestedCard users={suggestions} />
      <TopXpCard rows={leaderboard ?? []} />
      <DtcOfficesCard />
      <ExploreCard />
    </div>
  );
}

// ─────────────────────────── DTC Offices ───────────────────────────

/**
 * Surfaces all six DTC hub offices in Region V. Clicking a row opens
 * the shared DtcOfficeModal with that office pre-selected; clicking
 * the card header opens it without a focus.
 *
 * The address list comes from `lib/learnhub/dtc-offices.ts` so the
 * "Hosted by …" badge on Meet/webinar posts uses the same source of
 * truth.
 */
function DtcOfficesCard() {
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const handleOpen = (id?: string) => {
    setFocusId(id ?? null);
    setOpen(true);
  };

  return (
    <>
      <div className="lh-card lh-card--compact lh-dtc-card">
        <div className="lh-card-header">
          <span className="lh-card-title">
            <MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            DTC Offices
          </span>
          <button
            type="button"
            onClick={() => handleOpen()}
            className="lh-see-all"
            style={{ background: "transparent", border: 0, cursor: "pointer" }}
          >
            View map →
          </button>
        </div>
        {DTC_OFFICES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => handleOpen(o.id)}
            className="lh-dtc-row"
          >
            <span className={`lh-dtc-pin${o.isMain ? " is-main" : ""}`}>
              <MapPin size={14} />
            </span>
            <div className="lh-dtc-row-body">
              <div className="lh-dtc-row-name">
                {o.city}, {o.province}
                {o.isMain && <span className="lh-dtc-row-tag">MAIN</span>}
              </div>
              <div className="lh-dtc-row-addr">{o.address}</div>
            </div>
          </button>
        ))}
      </div>
      <DtcOfficeModal open={open} onClose={() => setOpen(false)} initialOfficeId={focusId} />
    </>
  );
}

// ─────────────────────────── Me card ───────────────────────────

function MeCard({
  session, me, status, onStatus,
}: {
  session: { name?: string; avatarUrl?: string; role?: string } | null | undefined;
  me: { xpPoints?: number; programBatch?: string; programType?: string } | null | undefined;
  status: Status;
  onStatus: (s: Status) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close the picker when the user clicks anywhere else.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const meta = STATUS_META[status];
  const avatar = session?.avatarUrl
    ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(session?.name ?? "U")}&backgroundColor=5B6CFF&textColor=ffffff`;

  const xp = me?.xpPoints ?? 0;
  const subLine = me?.programBatch || me?.programType
    ? `${me?.programBatch ?? ""}${me?.programBatch && me?.programType ? " · " : ""}${me?.programType ?? ""}`
    : session?.role ?? "";

  return (
    <div className="lh-card lh-me-card" ref={ref}>
      <div className="lh-me-row">
        <div className="lh-me-avatar-wrap">
          <img
            src={avatar}
            alt={session?.name ?? "Me"}
            className="lh-me-avatar"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "https://api.dicebear.com/7.x/shapes/svg?seed=user";
            }}
          />
          <span
            className="lh-me-dot"
            style={{ background: meta.color, boxShadow: `0 0 0 3px var(--lh-surface)` }}
          />
        </div>

        <div className="lh-me-info">
          <div className="lh-me-name">{session?.name ?? "Loading…"}</div>
          <div className="lh-me-sub">{subLine || "—"}</div>
        </div>

        <div className="lh-me-xp">
          <span className="lh-me-xp-num">{xp >= 1000 ? (xp / 1000).toFixed(1) + "k" : xp}</span>
          <span className="lh-me-xp-label">XP</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="lh-status-pill"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={meta.hint}
      >
        <span className="lh-status-pill-dot" style={{ background: meta.color }} />
        <span className="lh-status-pill-label">{meta.label}</span>
        <ChevronDown size={12} className={`lh-status-pill-caret ${open ? "is-open" : ""}`} />
      </button>

      {open && (
        <div className="lh-status-menu" role="listbox">
          {(Object.keys(STATUS_META) as Status[]).map((key) => {
            const m = STATUS_META[key];
            const isActive = key === status;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => { onStatus(key); setOpen(false); }}
                className={`lh-status-option ${isActive ? "is-active" : ""}`}
              >
                <span className="lh-status-option-dot" style={{ background: m.color }} />
                <span className="lh-status-option-body">
                  <span className="lh-status-option-label">{m.label}</span>
                  <span className="lh-status-option-hint">{m.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Events ───────────────────────────

function EventsCard() {
  return (
    <div className="lh-card lh-card--compact">
      <div className="lh-card-header">
        <span className="lh-card-title">
          <Calendar size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          Upcoming Events
        </span>
        <Link href="/learnhub/learning-path" className="lh-see-all">View all →</Link>
      </div>

      <div className="lh-ev-list">
        {MOCK_EVENTS.map((ev) => {
          const s = statusBadge(ev.status);
          return (
            <div key={ev.id} className="lh-ev-item">
              <div className="lh-ev-date" aria-hidden>
                <span className="lh-ev-date-day">{ev.date.split(" ")[1]}</span>
                <span className="lh-ev-date-mon">{ev.date.split(" ")[0]}</span>
              </div>
              <div className="lh-ev-body">
                <div className="lh-ev-title">{ev.title}</div>
                <div className="lh-ev-meta">
                  <span>{ev.org}</span><span aria-hidden>·</span><span>{ev.time}</span>
                </div>
              </div>
              <span className="lh-ev-pill" style={{ background: s.bg, color: s.color }}>
                {ev.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── People list primitives ───────────────────────────

type PeerUser = {
  _id: string;
  name?: string;
  avatarUrl?: string;
  role?: string;
  programBatch?: string;
  xpPoints?: number;
};

function PeerRow({
  user, online, actionLabel, href,
}: {
  user: PeerUser; online?: boolean;
  actionLabel: string; href: string;
}) {
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name ?? "U")}&backgroundColor=5B6CFF&textColor=ffffff`;
  const roleShort = user.role === "mentor" ? "Mentor" : "Student";
  return (
    <div className="lh-peer-row">
      <div className="lh-peer-avatar-wrap">
        <img
          src={user.avatarUrl ?? fallback}
          alt={user.name ?? "user"}
          className="lh-peer-avatar"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
        />
        {online && <span className="lh-peer-dot" />}
      </div>
      <div className="lh-peer-info">
        <div className="lh-peer-name">{user.name ?? "User"}</div>
        <div className="lh-peer-meta">
          <span className={`lh-peer-role lh-peer-role--${user.role ?? "student"}`}>{roleShort}</span>
          {user.programBatch && <span>· {user.programBatch}</span>}
        </div>
      </div>
      <Link href={href} className="lh-peer-cta">{actionLabel}</Link>
    </div>
  );
}

// ─────────────────────────── People Online ───────────────────────────

function PeopleOnlineCard({ users, loading }: { users: PeerUser[]; loading: boolean }) {
  return (
    <div className="lh-card lh-card--compact">
      <div className="lh-card-header">
        <span className="lh-card-title">
          <span className="lh-online-title-dot" aria-hidden />
          People Online
        </span>
        <span className="lh-card-meta">
          {loading ? "—" : users.length}
        </span>
      </div>
      {loading ? (
        <div className="lh-peer-skeletons">
          {[0, 1, 2].map((i) => (
            <div key={i} className="lh-peer-row">
              <div className="lh-skeleton" style={{ width: 32, height: 32, borderRadius: "50%" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="lh-skeleton" style={{ height: 10, width: "60%" }} />
                <div className="lh-skeleton" style={{ height: 8,  width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="lh-rp-empty">Nobody from your cohort is online right now.</p>
      ) : (
        users.map((u) => (
          <PeerRow
            key={u._id}
            user={u}
            online
            actionLabel="Message"
            href={`/learnhub/messages?to=${u._id}`}
          />
        ))
      )}
    </div>
  );
}

// ─────────────────────────── Suggested ───────────────────────────

function SuggestedCard({ users }: { users: PeerUser[] }) {
  if (users.length === 0) return null;
  return (
    <div className="lh-card lh-card--compact">
      <div className="lh-card-header">
        <span className="lh-card-title">Suggested for you</span>
        <Link href="/learnhub/work" className="lh-see-all">See all</Link>
      </div>
      {users.map((u) => (
        <PeerRow
          key={u._id}
          user={u}
          actionLabel="Follow"
          href={`/learnhub/profile?u=${u._id}`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────── Top XP ───────────────────────────

type LeaderRow = { _id: string; name?: string; avatarUrl?: string; xpPoints: number; rank: number };

function TopXpCard({ rows }: { rows: LeaderRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="lh-card lh-card--compact">
      <div className="lh-card-header">
        <span className="lh-card-title">🏆 Top XP</span>
        <Link href="/learnhub/leaderboard" className="lh-see-all">View all</Link>
      </div>
      {rows.map((r) => {
        const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.name ?? "U")}&backgroundColor=5B6CFF&textColor=ffffff`;
        const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`;
        return (
          <div key={r._id} className="lh-peer-row">
            <span className="lh-xp-rank">{medal}</span>
            <img src={r.avatarUrl ?? fallback} alt={r.name ?? "u"} className="lh-peer-avatar" />
            <div className="lh-peer-info">
              <div className="lh-peer-name">{r.name ?? "User"}</div>
              <div className="lh-peer-meta">⚡ {r.xpPoints.toLocaleString()} XP</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────── Explore ───────────────────────────

const EXPLORE_LINKS = [
  { href: "/learnhub/work",          icon: "💼", title: "Work Board",  sub: "Find opportunities" },
  { href: "/learnhub/journal",       icon: "📝", title: "Daily Journal", sub: "Reflect on progress" },
  { href: "/learnhub/certificates",  icon: "🏅", title: "Certificates", sub: "Your achievements" },
];

function ExploreCard() {
  return (
    <div className="lh-card lh-card--compact">
      <div className="lh-card-header"><span className="lh-card-title">Explore</span></div>
      {EXPLORE_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="lh-explore-row">
          <span className="lh-explore-icon" aria-hidden>{l.icon}</span>
          <span>
            <span className="lh-explore-title">{l.title}</span>
            <span className="lh-explore-sub">{l.sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
