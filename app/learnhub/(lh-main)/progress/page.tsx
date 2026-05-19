"use client";

/**
 * Mentor & Coordinator restricted progress console.
 *
 * Access is enforced server-side in convex/learnhub_progress.ts; students
 * never see this page.
 *
 * Visual language matches the rest of LearnHub — uses the `--lh-*` CSS
 * tokens, `.lh-card`-style chrome, Plus Jakarta Sans headings, and the
 * dual-accent system (orange `--lh-accent` for coordinators, indigo
 * `--lh-accent-2` for mentors). Bespoke styles live under the
 * `.lh-progress-page` namespace in `app/learnhub/learnhub.css`.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ChevronRight, MessageCircle, Search, RefreshCw, AlertTriangle,
  Users, Activity, Award, Clock, Sparkles, ArrowUpRight, ShieldCheck, X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { initialsAvatar } from "@/lib/learnhub/avatar";

type StatusKey = "on-track" | "risk" | "inactive" | "done";

const STATUS_META: Record<StatusKey, { label: string; varName: string }> = {
  "on-track": { label: "On Track",  varName: "--lh-green" },
  risk:       { label: "At Risk",   varName: "--lh-yellow" },
  inactive:   { label: "Inactive",  varName: "--lh-red" },
  done:       { label: "Completed", varName: "--lh-blue" },
};

type Student = {
  id: Id<"learnhub_users">;
  name: string;
  initials: string;
  avatarUrl: string;
  mentorId: Id<"learnhub_users"> | null;
  province: string | null;
  overall: number;
  hours: number;
  xp: number;
  days: number;
  certs: number;
  status: StatusKey;
};

type MentorRollup = {
  id: Id<"learnhub_users">;
  name: string;
  initials: string;
  avatarUrl: string;
  province: string | null;
  total: number;
  avgProgress: number;
  atRisk: number;
  inactive: number;
  done: number;
  totalXp: number;
};

export default function ProgressPage() {
  const { userId, loading } = useLearnhubSession();
  const data = useQuery(
    api.learnhub_progress.getDashboard,
    userId ? { viewerId: userId as Id<"learnhub_users"> } : "skip",
  );

  if (loading || data === undefined) return <ProgressSkeleton />;
  if (!userId || data.forbidden) {
    return <AccessDenied reason={(data && data.forbidden && data.reason) || "unauth"} />;
  }
  return <ProgressConsole data={data} />;
}

function ProgressSkeleton() {
  return (
    <main className="lh-page lh-progress-page" style={{ padding: 20 }}>
      <div className="lh-progress-skel-head" />
      <div className="lh-progress-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="lh-progress-skel-tile" />)}
      </div>
      <div className="lh-progress-skel-rows">
        {[0, 1, 2, 3].map((i) => <div key={i} className="lh-progress-skel-row" />)}
      </div>
    </main>
  );
}

function AccessDenied({ reason }: { reason: string }) {
  return (
    <main className="lh-page lh-progress-page" style={{ padding: "32px 20px", display: "flex", justifyContent: "center" }}>
      <div className="lh-card" style={{ maxWidth: 480, textAlign: "center", padding: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>🔒</div>
        <h2 style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--lh-text)" }}>Restricted view</h2>
        <p style={{ margin: "8px 0 16px", color: "var(--lh-text-2)", fontSize: 13.5, lineHeight: 1.55 }}>
          Student progress is visible only to{" "}
          <strong style={{ color: "var(--lh-accent-2)" }}>Mentors</strong> and{" "}
          <strong style={{ color: "var(--lh-accent)" }}>Coordinators</strong>. Students don&rsquo;t have access to other learners&rsquo; data.
        </p>
        <p className="lh-progress-eyebrow" style={{ color: "var(--lh-red)" }}>
          {reason === "not_your_student" ? "Not assigned to your cohort" : reason === "forbidden" ? "Insufficient permissions" : "Sign in to continue"}
        </p>
        <Link href="/learnhub/feed" className="lh-progress-ghost-btn" style={{ marginTop: 14, display: "inline-flex" }}>
          Back to feed →
        </Link>
      </div>
    </main>
  );
}

type DashboardData = NonNullable<Exclude<ReturnType<typeof useQuery<typeof api.learnhub_progress.getDashboard>>, undefined>>;

function ProgressConsole({ data }: { data: DashboardData }) {
  if (data.forbidden) return null;
  const tier = data.tier;
  const accentVar = tier === "coordinator" ? "--lh-accent" : "--lh-accent-2";
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [activeMentorId, setActiveMentorId] = useState<string | null>(null);
  const [openStudent, setOpenStudent] = useState<Student | null>(null);

  const students = data.students as Student[];
  const mentors = (data.mentors ?? []) as MentorRollup[];

  const needsAttention = useMemo(() => {
    return students
      .filter((s) => s.status === "risk" || s.status === "inactive")
      .sort((a, b) => {
        const rank = { inactive: 0, risk: 1, "on-track": 2, done: 3 } as Record<StatusKey, number>;
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return b.days - a.days;
      })
      .slice(0, 6);
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (activeMentorId && (s.mentorId as unknown as string) !== activeMentorId) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.province ?? "").toLowerCase().includes(q);
      }
      return true;
    }).slice(0, 200);
  }, [students, search, statusFilter, activeMentorId]);

  const messageStudent = (id: Id<"learnhub_users">) => {
    router.push(`/learnhub/messages?to=${id as unknown as string}`);
  };

  return (
    <main
      className="lh-page lh-progress-page"
      style={{ ["--lh-progress-accent" as string]: `var(${accentVar})` }}
    >
      <div className="lh-progress-tier-banner">
        <div className="lh-progress-tier-banner-left">
          <span className="lh-progress-tier-icon"><ShieldCheck size={16} /></span>
          <span>
            <strong>Restricted view</strong> ·{" "}
            <strong style={{ color: "var(--lh-accent-2)" }}>Mentors</strong> &amp;{" "}
            <strong style={{ color: "var(--lh-accent)" }}>Coordinators</strong> only.
            <span className="lh-progress-tier-sub">
              {tier === "mentor" ? " You see only your own cohort." : " You see all cohorts + confidential flags."}
            </span>
          </span>
        </div>
        <span className="lh-progress-pill">
          {tier === "coordinator" ? "Tier 2 · Region-wide" : "Tier 1 · Cohort"}
        </span>
      </div>

      <header className="lh-progress-header">
        <div>
          <h1>{tier === "coordinator" ? "Region-wide Progress" : "Your Cohort Progress"}</h1>
          <p>
            {tier === "coordinator"
              ? "Live rollup across every mentor and student in the program."
              : "Your assigned students, ranked by overall progress."}
          </p>
        </div>
        <div className="lh-progress-header-actions">
          <button type="button" onClick={() => window.location.reload()} className="lh-progress-ghost-btn" title="Reload data">
            <RefreshCw size={13} /> Refresh
          </button>
          <span className="lh-progress-pill is-live">
            <span className="lh-progress-pill-dot" /> Live · synced now
          </span>
        </div>
      </header>

      <section className="lh-progress-grid">
        <KPI label="Students" value={data.kpi.totalStudents} sub={tier === "coordinator" ? `${data.kpi.totalMentors ?? 0} mentors active` : "in your cohort"} icon={Users} colorVar="--lh-accent-2" />
        <KPI label="Avg progress" value={`${data.kpi.avgProgress}%`} sub="across modules" icon={Activity} colorVar="--lh-green" />
        <KPI label="At risk" value={data.kpi.atRisk} sub="needs check-in" icon={AlertTriangle} colorVar="--lh-yellow" />
        <KPI label="Inactive" value={data.kpi.inactive} sub="14+ days idle" icon={Clock} colorVar="--lh-red" />
        <KPI label="Completed" value={data.kpi.completed} sub="reached 92%+" icon={Award} colorVar="--lh-blue" />
        <KPI label="Total XP" value={data.kpi.totalXp.toLocaleString()} sub="across cohort" icon={Sparkles} colorVar="--lh-accent" />
      </section>

      {tier === "mentor" && students.length === 0 && (
        <section className="lh-card lh-progress-zero">
          <h3>No mentees yet</h3>
          <p>
            Students appear here once you accept a mentorship request. Open the Mentors directory
            and review incoming requests, or share your mentor profile so learners can find you.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/learnhub/mentors" className="lh-progress-primary-btn">Open Mentors directory</Link>
            <Link href="/learnhub/profile" className="lh-progress-ghost-btn">Edit my profile</Link>
          </div>
        </section>
      )}

      {needsAttention.length > 0 && (
        <section className="lh-progress-section">
          <div className="lh-progress-section-head">
            <h2><AlertTriangle size={16} style={{ color: "var(--lh-yellow)" }} /> Needs your attention</h2>
            <span>Top {needsAttention.length} — sorted by idle time</span>
          </div>
          <div className="lh-progress-triage-grid">
            {needsAttention.map((s) => (
              <div
                key={s.id as unknown as string}
                className={`lh-progress-triage-card ${s.status === "inactive" ? "is-inactive" : "is-risk"}`}
              >
                <div className="lh-progress-triage-top">
                  <img
                    src={s.avatarUrl || initialsAvatar(s.name)}
                    alt=""
                    className="lh-progress-avatar"
                    style={{ width: 36, height: 36 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = initialsAvatar(s.name); }}
                  />
                  <div className="lh-progress-triage-meta">
                    <div className="lh-progress-triage-name">{s.name}</div>
                    <div className="lh-progress-triage-sub">
                      {s.overall}% · {s.days === 0 ? "Today" : s.days >= 999 ? "Never active" : `${s.days}d idle`}
                    </div>
                  </div>
                  <StatusChip status={s.status} />
                </div>
                <div className="lh-progress-triage-actions">
                  <button type="button" onClick={() => messageStudent(s.id)} className="lh-progress-primary-btn">
                    <MessageCircle size={13} /> Message
                  </button>
                  <button type="button" onClick={() => setOpenStudent(s)} className="lh-progress-ghost-btn">
                    Details <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tier === "coordinator" && mentors.length > 0 && (
        <section className="lh-progress-section">
          <div className="lh-progress-section-head">
            <h2>Mentors leaderboard</h2>
            <span>Click a mentor to filter the roster below</span>
          </div>
          <div className="lh-progress-mentor-list">
            {mentors.map((m) => {
              const isActive = activeMentorId === (m.id as unknown as string);
              return (
                <button
                  key={m.id as unknown as string}
                  type="button"
                  onClick={() => setActiveMentorId(isActive ? null : (m.id as unknown as string))}
                  className={`lh-progress-mentor-row${isActive ? " is-active" : ""}`}
                >
                  <div className="lh-progress-mentor-id">
                    <img
                      src={m.avatarUrl || initialsAvatar(m.name)}
                      alt=""
                      className="lh-progress-avatar"
                      style={{ width: 36, height: 36 }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = initialsAvatar(m.name); }}
                    />
                    <div>
                      <div className="lh-progress-mentor-name">{m.name}</div>
                      <div className="lh-progress-mentor-sub">{m.province ?? "—"}</div>
                    </div>
                  </div>
                  <div className="lh-progress-mentor-num">{m.total}</div>
                  <div className="lh-progress-mentor-bar">
                    <div className="lh-progress-mentor-bar-label">Avg · {m.avgProgress}%</div>
                    <ProgressBar value={m.avgProgress} colorVar="--lh-accent" />
                  </div>
                  <div className="lh-progress-mentor-pills">
                    {m.done > 0 && <span className="lh-progress-mini-pill" style={{ color: "var(--lh-green)", borderColor: "var(--lh-green)" }}>{m.done} done</span>}
                    {m.atRisk > 0 && <span className="lh-progress-mini-pill" style={{ color: "var(--lh-yellow)", borderColor: "var(--lh-yellow)" }}>{m.atRisk} risk</span>}
                    {m.inactive > 0 && <span className="lh-progress-mini-pill" style={{ color: "var(--lh-red)", borderColor: "var(--lh-red)" }}>{m.inactive} idle</span>}
                  </div>
                  <div className="lh-progress-mentor-xp">{m.totalXp.toLocaleString()} XP</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="lh-progress-controls">
        <div className="lh-progress-search">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or province…" />
        </div>
        {(["all", "on-track", "risk", "inactive", "done"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`lh-progress-filter-pill${statusFilter === s ? " is-active" : ""}`}
            data-color={s === "all" ? "accent" : s}
          >
            {s === "all" ? "All" : STATUS_META[s].label}
          </button>
        ))}
        {activeMentorId && (
          <button
            type="button"
            onClick={() => setActiveMentorId(null)}
            className="lh-progress-filter-pill is-active"
            data-color="accent"
          >
            Clear mentor filter ✕
          </button>
        )}
      </div>

      <section className="lh-progress-section">
        <div className="lh-progress-section-head">
          <h2>Roster <span className="lh-progress-section-count">({filtered.length})</span></h2>
          <span>Click a row for full detail</span>
        </div>
        {filtered.length === 0 ? (
          <div className="lh-progress-empty">
            {tier === "mentor" && students.length === 0
              ? "No students linked yet — accept a mentorship request to populate this view."
              : "No students match the current filters. Try clearing them above."}
          </div>
        ) : (
          <div className="lh-progress-row-list">
            {filtered.map((s) => (
              <button
                key={s.id as unknown as string}
                type="button"
                onClick={() => setOpenStudent(s)}
                className="lh-progress-row"
              >
                <div className="lh-progress-row-id">
                  <img
                    src={s.avatarUrl || initialsAvatar(s.name)}
                    alt=""
                    className="lh-progress-avatar"
                    style={{ width: 36, height: 36 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = initialsAvatar(s.name); }}
                  />
                  <div>
                    <div className="lh-progress-row-name">{s.name}</div>
                    <div className="lh-progress-row-sub">{s.province ?? "—"} · {s.hours}h logged</div>
                  </div>
                </div>
                <div className="lh-progress-row-bar">
                  <div className="lh-progress-row-bar-label">
                    <span className="lh-progress-row-pct">{s.overall}%</span>
                    <span>overall</span>
                  </div>
                  <ProgressBar
                    value={s.overall}
                    colorVar={s.overall >= 80 ? "--lh-green" : s.overall >= 40 ? "--lh-progress-accent" : "--lh-yellow"}
                  />
                </div>
                <div
                  className="lh-progress-row-idle"
                  data-warn={s.days > 14 ? "high" : s.days > 5 ? "med" : "low"}
                >
                  {s.days === 0 ? "Today" : s.days === 1 ? "1d ago" : s.days >= 999 ? "Never" : `${s.days}d ago`}
                </div>
                <div className="lh-progress-row-xp">{s.xp.toLocaleString()} XP</div>
                <StatusChip status={s.status} />
                <ChevronRight size={16} className="lh-progress-row-chev" />
              </button>
            ))}
          </div>
        )}
      </section>

      {openStudent && (
        <StudentDrawer
          studentId={openStudent.id}
          viewerId={data.viewer.id}
          tier={tier}
          onClose={() => setOpenStudent(null)}
        />
      )}
    </main>
  );
}

function KPI({
  label, value, sub, icon: Icon, colorVar,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; colorVar: string;
}) {
  return (
    <div className="lh-progress-kpi" style={{ ["--kpi-color" as string]: `var(${colorVar})` }}>
      <div className="lh-progress-kpi-glow" />
      <div className="lh-progress-kpi-head">
        <span>{label}</span>
        <Icon size={12} />
      </div>
      <div className="lh-progress-kpi-value">{value}</div>
      {sub && <div className="lh-progress-kpi-sub">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, colorVar = "--lh-accent-2" }: { value: number; colorVar?: string }) {
  return (
    <div className="lh-progress-bar">
      <div
        className="lh-progress-bar-fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `var(${colorVar})` }}
      />
    </div>
  );
}

function StatusChip({ status }: { status: StatusKey }) {
  const m = STATUS_META[status];
  return (
    <span className="lh-progress-status-chip" style={{ ["--chip-color" as string]: `var(${m.varName})` }}>
      <span className="lh-progress-status-dot" />
      {m.label}
    </span>
  );
}

function StudentDrawer({ studentId, viewerId, tier, onClose }: {
  studentId: Id<"learnhub_users">;
  viewerId: Id<"learnhub_users">;
  tier: "mentor" | "coordinator";
  onClose: () => void;
}) {
  const detail = useQuery(api.learnhub_progress.getStudentDetail, { viewerId, studentId });
  const accentVar = tier === "coordinator" ? "--lh-accent" : "--lh-accent-2";

  return (
    <div className="lh-progress-drawer-scrim" onClick={onClose}>
      <aside
        className="lh-progress-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--lh-progress-accent" as string]: `var(${accentVar})` }}
      >
        {detail === undefined ? (
          <div style={{ padding: 28, color: "var(--lh-text-2)" }}>Loading…</div>
        ) : detail.forbidden ? (
          <div style={{ padding: 28, color: "var(--lh-red)" }}>You don&rsquo;t have permission to view this student.</div>
        ) : (
          <DrawerBody detail={detail} onClose={onClose} />
        )}
      </aside>
    </div>
  );
}

function DrawerBody({ detail, onClose }: {
  detail: {
    student: {
      id: Id<"learnhub_users">; name: string; initials: string; avatarUrl: string; province: string | null;
      overall: number; hours: number; xp: number; days: number; certs: number; status: StatusKey;
      bio: string | null; email: string; school: string | null; interests: string[];
    };
    mentor: { id: Id<"learnhub_users">; name: string; initials: string; avatarUrl: string; province: string | null } | null;
    journalDays: number; lastJournalDate: string | null;
    certificates: Array<{ id: string; title: string; issuedAt: number; status: string }>;
    tier: "mentor" | "coordinator";
  };
  onClose: () => void;
}) {
  const s = detail.student;
  const router = useRouter();
  return (
    <>
      <header className="lh-progress-drawer-head">
        <div className="lh-progress-drawer-id">
          <img
            src={s.avatarUrl || initialsAvatar(s.name)}
            alt=""
            className="lh-progress-avatar"
            style={{ width: 54, height: 54 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = initialsAvatar(s.name); }}
          />
          <div>
            <div className="lh-progress-drawer-name">{s.name}</div>
            <div className="lh-progress-drawer-sub">{s.province ?? "—"} · {s.school ?? s.email}</div>
            <div style={{ marginTop: 8 }}><StatusChip status={s.status} /></div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="lh-progress-ghost-btn lh-progress-icon-btn">
          <X size={16} />
        </button>
      </header>

      <div className="lh-progress-drawer-actions">
        <button
          type="button"
          onClick={() => router.push(`/learnhub/messages?to=${s.id as unknown as string}`)}
          className="lh-progress-primary-btn"
        >
          <MessageCircle size={14} /> Message
        </button>
        <Link href={`/learnhub/profile/${s.id as unknown as string}`} className="lh-progress-ghost-btn">
          View full profile <ArrowUpRight size={13} />
        </Link>
      </div>

      <div className="lh-progress-drawer-body">
        <section>
          <div className="lh-progress-eyebrow">Overall track</div>
          <div className="lh-progress-drawer-overall">
            <span className="lh-progress-drawer-overall-num">{s.overall}%</span>
            <span className="lh-progress-drawer-overall-xp">{s.xp.toLocaleString()} XP earned</span>
          </div>
          <ProgressBar
            value={s.overall}
            colorVar={s.overall >= 80 ? "--lh-green" : "--lh-progress-accent"}
          />
        </section>

        <section className="lh-progress-stat-row">
          <Stat label="Hours" value={s.hours} colorVar="--lh-text" />
          <Stat label="Certs" value={s.certs} colorVar="--lh-green" />
          <Stat label="Journal days" value={detail.journalDays} colorVar="--lh-accent-2" />
        </section>

        {detail.mentor && (
          <section>
            <div className="lh-progress-eyebrow">Assigned Mentor</div>
            <div className="lh-progress-mentor-card">
              <img
                src={detail.mentor.avatarUrl || initialsAvatar(detail.mentor.name)}
                alt=""
                className="lh-progress-avatar"
                style={{ width: 36, height: 36 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = initialsAvatar(detail.mentor!.name); }}
              />
              <div>
                <div style={{ fontWeight: 600, color: "var(--lh-text)" }}>{detail.mentor.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--lh-text-3)", marginTop: 2 }}>
                  {detail.mentor.province ?? "—"} · Mentor
                </div>
              </div>
            </div>
          </section>
        )}

        {s.interests.length > 0 && (
          <section>
            <div className="lh-progress-eyebrow">Interests</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {s.interests.map((tag) => (
                <span key={tag} className="lh-progress-mini-pill">{tag}</span>
              ))}
            </div>
          </section>
        )}

        {detail.certificates.length > 0 && (
          <section>
            <div className="lh-progress-eyebrow">Certificates</div>
            <div className="lh-progress-cert-list">
              {detail.certificates.map((c) => (
                <div key={c.id} className="lh-progress-cert-row">
                  <span>{c.title}</span>
                  <span style={{ color: "var(--lh-green)" }}>{c.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {detail.tier === "coordinator" && (
          <section className="lh-progress-coord-note">
            <div className="lh-progress-eyebrow" style={{ color: "var(--lh-accent)" }}>🔒 Coordinator-only notes</div>
            <p>
              Confidential notes will land here once the flags table is migrated. Use this space for
              context the mentor and student should not see.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  return (
    <div className="lh-progress-stat-card">
      <div className="lh-progress-eyebrow">{label}</div>
      <div className="lh-progress-stat-num" style={{ color: `var(${colorVar})` }}>{value}</div>
    </div>
  );
}
