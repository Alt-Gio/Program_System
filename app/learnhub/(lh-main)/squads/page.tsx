"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { ORG_CONFIG } from "@/lib/learnhub/org-config";
import type { Id } from "@/convex/_generated/dataModel";

const BG = "var(--lh-bg)";
const CARD = "var(--lh-card)";
const CARD2 = "var(--lh-card-2)";
const BORDER = "var(--lh-border)";
const BORDER2 = "var(--lh-border-strong)";
const TEXT = "var(--lh-text)";
const MUTED = "var(--lh-text-2)";
const ORANGE = "#f97316";
const GREEN = "#22c55e";
const SKY = "#38bdf8";
const INDIGO = "#6366f1";

type LifecycleStatus = "draft" | "upcoming" | "active" | "completed" | "archived";

function statusChip(status: LifecycleStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case "upcoming":
      return { label: "Starts soon", bg: "rgba(56,189,248,0.14)", fg: SKY };
    case "active":
      return { label: "Active", bg: "rgba(34,197,94,0.14)", fg: GREEN };
    case "completed":
      return { label: "Completed", bg: "rgba(168,85,247,0.14)", fg: "#a855f7" };
    case "draft":
      return { label: "Draft", bg: "rgba(185,190,230,0.14)", fg: MUTED };
    case "archived":
      return { label: "Archived", bg: "rgba(100,110,165,0.14)", fg: MUTED };
  }
}

function daysUntil(dateStr?: string): string | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00Z").getTime();
  const days = Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

function SquadsPageInner() {
  const { userId } = useLearnhubSession();
  const myCohorts = useQuery(
    api.learnhub_groups.listMyCohorts,
    userId ? { userId: userId as Id<"learnhub_users"> } : "skip",
  );
  const discoverable = useQuery(
    api.learnhub_groups.listDiscoverableCohorts,
    userId ? { userId: userId as Id<"learnhub_users"> } : "skip",
  );
  const join = useMutation(api.learnhub_groups.joinCohort);

  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "active">("all");
  const [joining, setJoining] = useState<string | null>(null);

  const regions = useMemo(() => {
    if (!discoverable) return [] as string[];
    const set = new Set<string>();
    for (const c of discoverable) {
      if (c.group.regionScope) set.add(c.group.regionScope);
    }
    return Array.from(set).sort();
  }, [discoverable]);

  const filtered = useMemo(() => {
    if (!discoverable) return [];
    return discoverable.filter((c) => {
      if (c.isMember) return false;
      if (filterRegion && c.group.regionScope !== filterRegion) return false;
      if (filterStatus === "open") {
        const cap = c.group.capacity;
        const remaining = cap ? cap - c.group.memberCount : 1;
        return remaining > 0 && (c.status === "upcoming" || c.status === "active");
      }
      if (filterStatus === "active") return c.status === "active";
      return c.status !== "archived" && c.status !== "draft";
    });
  }, [discoverable, filterRegion, filterStatus]);

  const handleJoin = async (groupId: Id<"learnhub_groups">) => {
    if (!userId) return;
    setJoining(groupId as string);
    try {
      await join({ userId: userId as Id<"learnhub_users">, groupId });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setJoining(null);
    }
  };

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", padding: "24px 32px" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          {ORG_CONFIG.squadLabel ?? "Squads"}
        </h1>
        <p style={{ color: MUTED, marginTop: 6, fontSize: 14 }}>
          Learn together. Pick a {ORG_CONFIG.cohortLabel?.toLowerCase() ?? "cohort"} of learners moving through the same path — optionally led by a {ORG_CONFIG.mentorTitle ?? "mentor"}.
        </p>
      </header>

      {/* My cohorts */}
      {myCohorts && myCohorts.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>
            Your {ORG_CONFIG.squadLabel?.toLowerCase() ?? "squads"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {myCohorts.map((c) => {
              const chip = statusChip(c.status);
              return (
                <Link
                  key={c.group._id}
                  href={`/learnhub/squads/${c.group._id}`}
                  style={{ display: "block", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, textDecoration: "none", color: TEXT }}
                >
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 22 }}>{c.group.coverEmoji ?? "🚀"}</div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: chip.bg, color: chip.fg, fontWeight: 600 }}>
                      {chip.label}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 4px" }}>{c.group.name}</h3>
                  <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                    {c.group.memberCount} members{c.role === "admin" ? " · you lead" : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Filters */}
      <section style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["all", "open", "active"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: "6px 14px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${filterStatus === s ? INDIGO : BORDER2}`,
              background: filterStatus === s ? "rgba(99,102,241,0.14)" : "transparent",
              color: filterStatus === s ? INDIGO : TEXT,
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : s === "open" ? "Open seats" : "Active now"}
          </button>
        ))}
        {regions.length > 0 && (
          <select
            value={filterRegion ?? ""}
            onChange={(e) => setFilterRegion(e.target.value || null)}
            style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12, background: CARD2, color: TEXT, border: `1px solid ${BORDER2}` }}
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
      </section>

      {/* Discover */}
      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>
          Discover
        </h2>
        {discoverable === undefined ? (
          <p style={{ color: MUTED }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
            <p style={{ color: MUTED, margin: 0 }}>
              No {ORG_CONFIG.squadLabel?.toLowerCase() ?? "squads"} match your filters yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {filtered.map((c) => {
              const chip = statusChip(c.status);
              const starts = daysUntil(c.group.startDate);
              const cap = c.group.capacity;
              const remaining = cap ? cap - c.group.memberCount : null;
              const full = remaining !== null && remaining <= 0;
              return (
                <article key={c.group._id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 26 }}>{c.group.coverEmoji ?? "🚀"}</div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: chip.bg, color: chip.fg, fontWeight: 600 }}>
                      {chip.label}{starts ? ` · ${starts}` : ""}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>{c.group.name}</h3>
                    {c.path && (
                      <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                        Path: <span style={{ color: TEXT }}>{c.path.title}</span>
                      </p>
                    )}
                  </div>
                  {c.lead && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={c.lead.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: 99 }} />
                      <span style={{ fontSize: 12, color: MUTED }}>Led by {c.lead.name}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 4 }}>
                    <span style={{ fontSize: 12, color: MUTED }}>
                      {c.group.memberCount}{cap ? ` / ${cap}` : ""} members
                      {c.group.regionScope ? ` · ${c.group.regionScope}` : ""}
                    </span>
                    <button
                      onClick={() => handleJoin(c.group._id)}
                      disabled={full || joining === (c.group._id as unknown as string)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background: full ? "transparent" : ORANGE,
                        color: full ? MUTED : "#fff",
                        border: full ? `1px solid ${BORDER2}` : "none",
                        cursor: full ? "not-allowed" : "pointer",
                      }}
                    >
                      {full ? "Full" : joining === (c.group._id as unknown as string) ? "Joining…" : "Join"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function SquadsPage() {
  return (
    <Suspense fallback={null}>
      <SquadsPageInner />
    </Suspense>
  );
}
