"use client";

/**
 * Mentor & Coordinator restricted progress console.
 *
 * Access is enforced server-side in convex/learnhub_progress.ts. The page
 * shape:
 *   1. Tier banner — explains who sees what
 *   2. KPI strip — six big numbers
 *   3. "Needs attention" triage panel — at-risk + inactive students with
 *      one-click Message buttons. Surfacing this above the fold is the
 *      whole point of this console for mentors.
 *   4. Coordinator-only mentors leaderboard (click to filter the roster).
 *   5. Roster table with search + status filter + clickable rows that
 *      open a drawer with full student detail + quick actions.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ChevronRight, MessageCircle, Search, RefreshCw, AlertTriangle,
  Users, Activity, Award, Clock, Sparkles, ArrowUpRight,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { initialsAvatar } from "@/lib/learnhub/avatar";

const CYAN = "#00d4ff";
const PURPLE = "#a855f7";
const PINK = "#ec4899";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";

type StatusKey = "on-track" | "risk" | "inactive" | "done";
const STATUS_META: Record<StatusKey, { label: string; color: string }> = {
  "on-track": { label: "On Track", color: GREEN },
  risk: { label: "At Risk", color: AMBER },
  inactive: { label: "Inactive", color: RED },
  done: { label: "Completed", color: "#06b6d4" },
};

function Pill({ tone = CYAN, children, dot = false }: { tone?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "5px 11px", borderRadius: 99,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      letterSpacing: 1.4, textTransform: "uppercase",
      background: `${tone}14`, border: `1px solid ${tone}44`, color: tone,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone, boxShadow: `0 0 8px ${tone}` }} />}
      {children}
    </span>
  );
}

function StatusChip({ status }: { status: StatusKey }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 99,
      background: `${m.color}1c`, border: `1px solid ${m.color}55`,
      fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
      color: m.color, letterSpacing: 1, textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, boxShadow: `0 0 8px ${m.color}88`, display: "inline-block" }} />
      {m.label}
    </span>
  );
}

function ProgressBar({ value, color = CYAN, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ width: "100%", height, borderRadius: 99, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.max(0, Math.min(100, value))}%`,
        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        borderRadius: 99, boxShadow: `0 0 10px ${color}66`, transition: "width 400ms ease",
      }} />
    </div>
  );
}

function Avatar({ name, color = CYAN, size = 32, src }: { name: string; color?: string; size?: number; src?: string | null }) {
  const safe = src && src.length > 0 ? src : initialsAvatar(name);
  return (
    <img
      src={safe}
      alt=""
      style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        border: `1px solid ${color}88`, flexShrink: 0, background: "#0a0a14",
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = initialsAvatar(name);
      }}
    />
  );
}

function KPI({ label, value, sub, color = CYAN, icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ElementType;
}) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 18, padding: "16px 18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}22, transparent 70%)`, pointerEvents: "none",
      }} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5,
        color: "rgba(255,255,255,0.5)", letterSpacing: 1.6,
        textTransform: "uppercase", marginBottom: 10,
      }}>
        <span>{label}</span>
        {Icon ? <Icon size={12} style={{ color }} /> : null}
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color, marginTop: 8, letterSpacing: 0.4 }}>{sub}</div>}
    </div>
  );
}

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
    <div style={{ padding: 24, color: "#fff" }}>
      <div style={{ height: 28, width: 220, background: "rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ height: 110, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
        ))}
      </div>
      <div style={{ height: 14, width: 200, marginTop: 22, background: "rgba(255,255,255,0.06)", borderRadius: 6 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 62, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} />
        ))}
      </div>
    </div>
  );
}

function AccessDenied({ reason }: { reason: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 360, padding: 24 }}>
      <div style={{ maxWidth: 460, padding: 28, textAlign: "center", borderRadius: 20,
        background: "linear-gradient(180deg, rgba(236,72,153,0.06), rgba(255,255,255,0.02))", border: `1px solid ${PINK}44` }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>🔒</div>
        <h2 style={{ margin: 0, color: "#fff", fontWeight: 800, letterSpacing: "-0.02em" }}>Restricted view</h2>
        <p style={{ margin: "8px 0 18px", color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.5 }}>
          Student Progress is visible only to <strong style={{ color: CYAN }}>Mentors</strong> and{" "}
          <strong style={{ color: PURPLE }}>Coordinators</strong>. Students do not have access to other learners&rsquo; data.
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: PINK, letterSpacing: 1.4, textTransform: "uppercase" }}>
          {reason === "not_your_student" ? "Not assigned to your cohort" : reason === "forbidden" ? "Insufficient permissions" : "Sign in to continue"}
        </p>
        <Link href="/learnhub/feed" style={{ display: "inline-block", marginTop: 16, padding: "9px 16px", borderRadius: 10,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
          Back to feed →
        </Link>
      </div>
    </div>
  );
}

type DashboardData = NonNullable<Exclude<ReturnType<typeof useQuery<typeof api.learnhub_progress.getDashboard>>, undefined>>;

function ProgressConsole({ data }: { data: DashboardData }) {
  if (data.forbidden) return null;
  const tier = data.tier;
  const accent = tier === "coordinator" ? PURPLE : CYAN;
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [activeMentorId, setActiveMentorId] = useState<string | null>(null);
  const [openStudent, setOpenStudent] = useState<Student | null>(null);

  const students = data.students as Student[];
  const mentors = (data.mentors ?? []) as MentorRollup[];

  // Sort priority: inactive > risk > on-track > done. Inside each bucket,
  // longest-idle first so the mentor's eye goes to whoever needs the most
  // intervention.
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
    <div style={{ color: "#fff", background: "#06060f", minHeight: "100%", padding: "0 0 32px", fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" }}>
      {/* Tier banner */}
      <div style={{ background: `linear-gradient(90deg, ${accent}15, transparent 70%)`, borderBottom: `1px solid ${accent}22`,
        padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "rgba(255,255,255,0.78)" }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${accent}22`, border: `1px solid ${accent}55`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: accent, fontSize: 16,
          }}>🛡️</span>
          <span>
            <strong style={{ color: "#fff" }}>Restricted view</strong> ·{" "}
            <strong style={{ color: CYAN }}>Mentors</strong> &amp;{" "}
            <strong style={{ color: PURPLE }}>Coordinators</strong> only — students cannot access.
            <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.5)" }}>
              {tier === "mentor" ? "You see only your own cohort." : "You see all cohorts + confidential flags."}
            </span>
          </span>
        </div>
        <Pill tone={accent}>{tier === "coordinator" ? "Permission · Tier 2" : "Permission · Tier 1"}</Pill>
      </div>

      <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1320, margin: "0 auto" }}>
        {/* Title + refresh */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(22px, 2.8vw, 30px)", fontWeight: 900, letterSpacing: "-0.03em" }}>
              {tier === "coordinator" ? "Region-wide Progress" : "Your Cohort Progress"}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              {tier === "coordinator"
                ? "Live rollup across every mentor and student in the program."
                : "Your assigned students, ranked by overall progress."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              title="Reload data"
              style={{
                padding: "8px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)", fontSize: 12,
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
              }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <Pill tone={accent} dot>Live · synced now</Pill>
          </div>
        </header>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <KPI label="Students" value={data.kpi.totalStudents} sub={tier === "coordinator" ? `${data.kpi.totalMentors ?? 0} mentors active` : "in your cohort"} color={accent} icon={Users} />
          <KPI label="Avg progress" value={`${data.kpi.avgProgress}%`} sub="across modules" color={GREEN} icon={Activity} />
          <KPI label="At risk" value={data.kpi.atRisk} sub="needs check-in" color={AMBER} icon={AlertTriangle} />
          <KPI label="Inactive" value={data.kpi.inactive} sub="14+ days idle" color={RED} icon={Clock} />
          <KPI label="Completed" value={data.kpi.completed} sub="reached 92%+" color="#06b6d4" icon={Award} />
          <KPI label="Total XP" value={data.kpi.totalXp.toLocaleString()} sub="across cohort" color={PURPLE} icon={Sparkles} />
        </div>

        {/* Mentor-tier zero state — show what to do next */}
        {tier === "mentor" && students.length === 0 && (
          <div style={{
            padding: "22px 22px", borderRadius: 16,
            background: "linear-gradient(180deg, rgba(0,212,255,0.08), rgba(0,212,255,0.02))",
            border: `1px solid ${CYAN}44`,
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>No mentees yet</h3>
            <p style={{ margin: "6px 0 14px", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>
              Students appear here once you accept a mentorship request. Open the Mentors directory
              and review incoming requests, or share your mentor profile so learners can find you.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/learnhub/mentors" style={primaryBtn(CYAN)}>Open Mentors directory</Link>
              <Link href="/learnhub/profile" style={ghostBtn()}>Edit my profile</Link>
            </div>
          </div>
        )}

        {/* Needs attention triage */}
        {needsAttention.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} style={{ color: AMBER }} /> Needs your attention
              </h2>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>
                Top {needsAttention.length} highest-priority — sorted by idle time
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {needsAttention.map((s) => (
                <div key={s.id as unknown as string} style={{
                  padding: "14px 14px", borderRadius: 14,
                  background: s.status === "inactive" ? `${RED}0e` : `${AMBER}0e`,
                  border: `1px solid ${s.status === "inactive" ? RED : AMBER}44`,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Avatar name={s.name} src={s.avatarUrl} color={s.status === "inactive" ? RED : AMBER} size={36} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                        {s.overall}% · {s.days === 0 ? "Today" : s.days >= 999 ? "Never active" : `${s.days}d idle`}
                      </div>
                    </div>
                    <StatusChip status={s.status} />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => messageStudent(s.id)}
                      style={{ ...primaryBtn(s.status === "inactive" ? RED : AMBER), padding: "7px 11px", fontSize: 12, flex: 1 }}
                    >
                      <MessageCircle size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                      Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenStudent(s)}
                      style={{ ...ghostBtn(), padding: "7px 11px", fontSize: 12 }}
                    >
                      Details <ChevronRight size={12} style={{ marginLeft: 4, verticalAlign: -1 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Coordinator mentors leaderboard */}
        {tier === "coordinator" && mentors.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>Mentors leaderboard</h2>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>
                Click a mentor to filter the roster below
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mentors.map((m) => {
                const isActive = activeMentorId === (m.id as unknown as string);
                return (
                  <button key={m.id as unknown as string} type="button"
                    onClick={() => setActiveMentorId(isActive ? null : (m.id as unknown as string))}
                    className="lh-progress-mentor-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(220px, 1.5fr) 70px minmax(140px, 1fr) minmax(130px, 1fr) 90px",
                      alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px", borderRadius: 12,
                      background: isActive ? `${PURPLE}10` : "rgba(255,255,255,0.02)",
                      border: isActive ? `1px solid ${PURPLE}55` : "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer", color: "#fff",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <Avatar name={m.name} src={m.avatarUrl} color={PURPLE} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                          {m.province ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700 }}>{m.total}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                        Avg · {m.avgProgress}%
                      </div>
                      <ProgressBar value={m.avgProgress} color={PURPLE} height={5} />
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {m.done > 0 && <Pill tone={GREEN}>{m.done} done</Pill>}
                      {m.atRisk > 0 && <Pill tone={AMBER}>{m.atRisk} risk</Pill>}
                      {m.inactive > 0 && <Pill tone={RED}>{m.inactive} idle</Pill>}
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: PURPLE, textAlign: "right" }}>
                      {m.totalXp.toLocaleString()} XP
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Search + filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: 12, color: "rgba(255,255,255,0.4)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or province…"
              style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
                color: "#fff", fontSize: 13, outline: "none" }} />
          </div>
          {(["all", "on-track", "risk", "inactive", "done"] as const).map((s) => {
            const active = statusFilter === s;
            const c = s === "all" ? accent : STATUS_META[s].color;
            return (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                style={{ padding: "8px 12px", borderRadius: 99,
                  background: active ? `${c}22` : "rgba(255,255,255,0.03)",
                  border: active ? `1px solid ${c}66` : "1px solid rgba(255,255,255,0.08)",
                  color: active ? c : "rgba(255,255,255,0.65)",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
                  letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer" }}>
                {s === "all" ? "All" : STATUS_META[s].label}
              </button>
            );
          })}
          {activeMentorId && (
            <button type="button" onClick={() => setActiveMentorId(null)}
              style={{ padding: "8px 12px", borderRadius: 99, background: "rgba(168,85,247,0.18)",
                border: `1px solid ${PURPLE}66`, color: PURPLE, fontSize: 11, cursor: "pointer" }}>
              Clear mentor filter ✕
            </button>
          )}
        </div>

        {/* Roster */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
              Roster <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500, fontSize: 13 }}>({filtered.length})</span>
            </h2>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>
              Click a row for full detail
            </span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", borderRadius: 14,
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
              {tier === "mentor" && students.length === 0
                ? "No students linked yet — accept a mentorship request to populate this view."
                : "No students match the current filters. Try clearing them above."}
            </div>
          ) : filtered.map((s) => (
            <button key={s.id as unknown as string} type="button" onClick={() => setOpenStudent(s)}
              className="lh-progress-row"
              style={{ display: "grid",
                gridTemplateColumns: "minmax(180px, 1.6fr) minmax(130px, 1fr) minmax(110px, 0.9fr) 100px 110px 18px",
                alignItems: "center", gap: 12, textAlign: "left", padding: "13px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <Avatar name={s.name} src={s.avatarUrl} color={accent} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                    {s.province ?? "—"} · {s.hours}h logged
                  </div>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{s.overall}%</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1 }}>overall</span>
                </div>
                <ProgressBar value={s.overall} color={s.overall >= 80 ? GREEN : s.overall >= 40 ? accent : AMBER} height={5} />
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                color: s.days > 14 ? RED : s.days > 5 ? AMBER : "rgba(255,255,255,0.7)", letterSpacing: 0.4 }}>
                {s.days === 0 ? "Today" : s.days === 1 ? "1d ago" : s.days >= 999 ? "Never" : `${s.days}d ago`}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: accent, fontWeight: 700 }}>
                {s.xp.toLocaleString()} XP
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><StatusChip status={s.status} /></div>
              <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.3)" }} />
            </button>
          ))}
        </section>
      </div>

      {openStudent && (
        <StudentDrawer studentId={openStudent.id} viewerId={data.viewer.id} tier={tier} onClose={() => setOpenStudent(null)} />
      )}

      <style jsx>{`
        :global(.lh-progress-row):hover,
        :global(.lh-progress-mentor-row):hover {
          background: rgba(255, 255, 255, 0.045) !important;
          border-color: rgba(255, 255, 255, 0.14) !important;
        }
        @media (max-width: 720px) {
          :global(.lh-progress-row) {
            grid-template-columns: 1fr 90px 18px !important;
            grid-template-areas:
              "name xp chev"
              "bar bar bar"
              "meta status status" !important;
            row-gap: 8px !important;
          }
          :global(.lh-progress-row) > *:nth-child(1) { grid-area: name; }
          :global(.lh-progress-row) > *:nth-child(2) { grid-area: bar; }
          :global(.lh-progress-row) > *:nth-child(3) { grid-area: meta; }
          :global(.lh-progress-row) > *:nth-child(4) { grid-area: xp; text-align: right; }
          :global(.lh-progress-row) > *:nth-child(5) { grid-area: status; justify-self: end; }
          :global(.lh-progress-row) > *:nth-child(6) { grid-area: chev; }
          :global(.lh-progress-mentor-row) {
            grid-template-columns: 1fr auto !important;
            grid-template-areas:
              "name xp"
              "bar bar"
              "pills pills" !important;
            row-gap: 8px !important;
          }
          :global(.lh-progress-mentor-row) > *:nth-child(1) { grid-area: name; }
          :global(.lh-progress-mentor-row) > *:nth-child(2) { grid-area: name; justify-self: end; align-self: start; }
          :global(.lh-progress-mentor-row) > *:nth-child(3) { grid-area: bar; }
          :global(.lh-progress-mentor-row) > *:nth-child(4) { grid-area: pills; }
          :global(.lh-progress-mentor-row) > *:nth-child(5) { grid-area: xp; }
        }
      `}</style>
    </div>
  );
}

function primaryBtn(color: string): React.CSSProperties {
  return {
    padding: "9px 14px", borderRadius: 10,
    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: "#06060f", border: 0, fontSize: 13, fontWeight: 700,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
    textDecoration: "none",
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    padding: "9px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff", fontSize: 13, fontWeight: 600,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
    textDecoration: "none",
  };
}

function StudentDrawer({ studentId, viewerId, tier, onClose }: {
  studentId: Id<"learnhub_users">; viewerId: Id<"learnhub_users">; tier: "mentor" | "coordinator"; onClose: () => void;
}) {
  const detail = useQuery(api.learnhub_progress.getStudentDetail, { viewerId, studentId });
  const accent = tier === "coordinator" ? PURPLE : CYAN;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(520px, 96vw)", height: "100%",
        background: "#0a0a14", borderLeft: "1px solid rgba(255,255,255,0.08)",
        boxShadow: `0 0 80px ${accent}22`, overflowY: "auto",
      }}>
        {detail === undefined ? (
          <div style={{ padding: 30, color: "#fff" }}>Loading…</div>
        ) : detail.forbidden ? (
          <div style={{ padding: 30, color: PINK }}>You don&rsquo;t have permission to view this student.</div>
        ) : (
          <DrawerBody detail={detail} accent={accent} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function DrawerBody({ detail, accent, onClose }: {
  detail: {
    student: { id: Id<"learnhub_users">; name: string; initials: string; avatarUrl: string; province: string | null;
      overall: number; hours: number; xp: number; days: number; certs: number; status: StatusKey;
      bio: string | null; email: string; school: string | null; interests: string[]; };
    mentor: { id: Id<"learnhub_users">; name: string; initials: string; avatarUrl: string; province: string | null } | null;
    journalDays: number; lastJournalDate: string | null;
    certificates: Array<{ id: string; title: string; issuedAt: number; status: string }>;
    tier: "mentor" | "coordinator";
  };
  accent: string;
  onClose: () => void;
}) {
  const s = detail.student;
  const router = useRouter();
  return (
    <>
      <div style={{ padding: "22px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={s.name} src={s.avatarUrl} color={accent} size={54} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{s.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              {s.province ?? "—"} · {s.school ?? s.email}
            </div>
            <div style={{ marginTop: 8 }}><StatusChip status={s.status} /></div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{
          padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer",
        }}>✕</button>
      </div>

      {/* Quick actions */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => router.push(`/learnhub/messages?to=${s.id as unknown as string}`)}
          style={primaryBtn(accent)}
        >
          <MessageCircle size={14} /> Message
        </button>
        <Link href={`/learnhub/profile/${s.id as unknown as string}`} style={ghostBtn()}>
          View full profile <ArrowUpRight size={13} />
        </Link>
      </div>

      <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.6 }}>
            Overall Track
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>{s.overall}%</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{s.xp.toLocaleString()} XP earned</span>
          </div>
          <ProgressBar value={s.overall} color={s.overall >= 80 ? GREEN : accent} height={8} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Stat label="Hours" value={s.hours} color="#fff" />
          <Stat label="Certs" value={s.certs} color={GREEN} />
          <Stat label="Journal days" value={detail.journalDays} color={CYAN} />
        </div>

        {detail.mentor && (
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.6 }}>
              Assigned Mentor
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Avatar name={detail.mentor.name} src={detail.mentor.avatarUrl} color={PURPLE} size={36} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fff" }}>{detail.mentor.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
                  {detail.mentor.province ?? "—"} · Mentor
                </div>
              </div>
            </div>
          </div>
        )}

        {s.interests.length > 0 && (
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.6 }}>
              Interests
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {s.interests.map((tag) => <Pill key={tag} tone={accent}>{tag}</Pill>)}
            </div>
          </div>
        )}

        {detail.certificates.length > 0 && (
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.6 }}>
              Certificates
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {detail.certificates.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "rgba(16,185,129,0.06)", border: `1px solid ${GREEN}33` }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.title}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: GREEN, letterSpacing: 0.6 }}>
                    {c.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail.tier === "coordinator" && (
          <div style={{
            padding: "14px 16px", borderRadius: 12, border: `1px solid ${PINK}55`,
            background: `linear-gradient(180deg, ${PINK}0d, transparent)`,
            backgroundImage: `repeating-linear-gradient(135deg, ${PINK}14 0, ${PINK}14 14px, transparent 14px, transparent 28px)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: PINK }}>🔒</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: PINK, letterSpacing: 1.6, textTransform: "uppercase" }}>
                Coordinator-Only Notes
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Confidential notes will land here once the flags table is migrated. Use this space for context the mentor and student should not see.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
      border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 12,
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1.6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}
