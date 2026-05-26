"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { ORG_CONFIG } from "@/lib/learnhub/org-config";
import { GroupChatPanel } from "@/components/learnhub/cohort/GroupChatPanel";
import { CohortPostsFeed } from "@/components/learnhub/cohort/CohortPostsFeed";
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

type Tab = "milestones" | "members" | "chat" | "posts";

function statusChip(status: "draft" | "upcoming" | "active" | "completed" | "archived") {
  switch (status) {
    case "upcoming": return { label: "Starts soon", bg: "rgba(56,189,248,0.14)", fg: SKY };
    case "active":   return { label: "Active", bg: "rgba(34,197,94,0.14)", fg: GREEN };
    case "completed":return { label: "Completed", bg: "rgba(168,85,247,0.14)", fg: "#a855f7" };
    case "draft":    return { label: "Draft", bg: "rgba(185,190,230,0.14)", fg: MUTED };
    case "archived": return { label: "Archived", bg: "rgba(100,110,165,0.14)", fg: MUTED };
  }
}

function CohortPageInner() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId as Id<"learnhub_groups">;
  const { userId } = useLearnhubSession();
  const dashboard = useQuery(api.learnhub_groups.getCohortDashboard, {
    groupId,
    viewerId: userId ? (userId as Id<"learnhub_users">) : undefined,
  });
  const join = useMutation(api.learnhub_groups.joinCohort);
  const leave = useMutation(api.learnhub_groups.leaveCohort);
  const mute = useMutation(api.learnhub_groups.muteCohortNotifications);

  const [tab, setTab] = useState<Tab>("milestones");
  const [busy, setBusy] = useState(false);

  if (dashboard === undefined) {
    return <div style={{ background: BG, color: MUTED, padding: 32, minHeight: "100vh" }}>Loading…</div>;
  }
  if (dashboard === null) {
    return (
      <div style={{ background: BG, color: TEXT, padding: 32, minHeight: "100vh" }}>
        <p style={{ color: MUTED }}>This {ORG_CONFIG.cohortLabel.toLowerCase()} doesn't exist.</p>
        <Link href="/learnhub/squads" style={{ color: SKY }}>← Back to {ORG_CONFIG.squadLabel}</Link>
      </div>
    );
  }

  const { group, status, lead, path, members, viewerIsMember, viewerRole, viewerMuted, remainingSeats } = dashboard;
  const chip = statusChip(status);

  const handleJoin = async () => {
    if (!userId) return;
    setBusy(true);
    try { await join({ userId: userId as Id<"learnhub_users">, groupId }); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };
  const handleLeave = async () => {
    if (!userId) return;
    if (!confirm("Leave this cohort? Your progress is preserved.")) return;
    setBusy(true);
    try { await leave({ userId: userId as Id<"learnhub_users">, groupId }); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };
  const handleMute = async () => {
    if (!userId) return;
    await mute({ userId: userId as Id<"learnhub_users">, groupId, muted: !viewerMuted });
  };

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", padding: "24px 32px" }}>
      <Link href="/learnhub/squads" style={{ color: MUTED, fontSize: 12, textDecoration: "none" }}>
        ← {ORG_CONFIG.squadLabel}
      </Link>

      {/* Header */}
      <header style={{ marginTop: 12, marginBottom: 24, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "start" }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>{group.coverEmoji ?? "🚀"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{group.name}</h1>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: chip.bg, color: chip.fg, fontWeight: 600 }}>
                {chip.label}
              </span>
            </div>
            <p style={{ color: MUTED, fontSize: 13, margin: "4px 0" }}>{group.description}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: MUTED, marginTop: 8 }}>
              {path && <span>Path: <span style={{ color: TEXT }}>{path.title}</span></span>}
              {group.regionScope && <span>Region: <span style={{ color: TEXT }}>{group.regionScope}</span></span>}
              {group.startDate && <span>Starts: <span style={{ color: TEXT }}>{group.startDate}</span></span>}
              {group.endDate && <span>Ends: <span style={{ color: TEXT }}>{group.endDate}</span></span>}
              <span>{group.memberCount}{group.capacity ? ` / ${group.capacity}` : ""} members</span>
            </div>
            {lead && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <img src={lead.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: 99 }} />
                <span style={{ fontSize: 13 }}>
                  Led by <span style={{ fontWeight: 600 }}>{lead.name}</span>
                  {lead.role === "mentor" && lead.mentorStatus === "verified" && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: GREEN }}>✓ Verified</span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!viewerIsMember && (status === "upcoming" || status === "active") && (
              <button
                onClick={handleJoin}
                disabled={busy || (remainingSeats !== null && remainingSeats <= 0)}
                style={{ padding: "8px 18px", borderRadius: 99, background: ORANGE, color: "#fff", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}
              >
                {remainingSeats !== null && remainingSeats <= 0 ? "Full" : busy ? "Joining…" : "Join"}
              </button>
            )}
            {viewerIsMember && viewerRole !== "admin" && (
              <>
                <button onClick={handleMute} style={{ padding: "6px 12px", borderRadius: 99, background: "transparent", color: TEXT, fontSize: 12, border: `1px solid ${BORDER2}`, cursor: "pointer" }}>
                  {viewerMuted ? "Unmute" : "Mute"}
                </button>
                <button onClick={handleLeave} disabled={busy} style={{ padding: "6px 12px", borderRadius: 99, background: "transparent", color: "#fca5a5", fontSize: 12, border: `1px solid ${BORDER2}`, cursor: "pointer" }}>
                  Leave
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
        {(["milestones", "members", "chat", "posts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              color: tab === t ? TEXT : MUTED,
              border: "none",
              borderBottom: `2px solid ${tab === t ? INDIGO : "transparent"}`,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === "milestones" && (
        <section>
          {!path ? (
            <p style={{ color: MUTED }}>No path bound to this cohort yet.</p>
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 8px", color: MUTED, fontWeight: 600 }}>Member</th>
                    {path.modules.map((m, i) => (
                      <th key={i} style={{ padding: "8px 4px", color: MUTED, fontWeight: 600, minWidth: 40 }}>
                        M{m.order}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.userId} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "8px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                        <img src={m.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: 99 }} />
                        <span style={{ color: TEXT }}>{m.name}</span>
                        {m.role === "admin" && <span style={{ fontSize: 10, color: GREEN }}>· lead</span>}
                      </td>
                      {path.modules.map((_, i) => {
                        const isComplete = i < m.completedCount;
                        const isCurrent = i === m.completedCount;
                        return (
                          <td key={i} style={{ padding: "8px 4px", textAlign: "center" }}>
                            {isComplete ? (
                              <span style={{ color: GREEN, fontSize: 14 }}>✓</span>
                            ) : isCurrent ? (
                              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: ORANGE, animation: "pulse 1.5s infinite" }} />
                            ) : (
                              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: "rgba(100,110,165,0.2)" }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "members" && (
        <section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {members.map((m) => (
              <article key={m.userId} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                <img src={m.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: 99 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Link href={`/learnhub/profile/${m.userId}`} style={{ color: TEXT, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                      {m.name}
                    </Link>
                    {m.role === "admin" && <span style={{ fontSize: 10, color: GREEN }}>lead</span>}
                  </div>
                  <div style={{ marginTop: 6, height: 6, borderRadius: 99, background: "rgba(100,110,165,0.2)", overflow: "hidden" }}>
                    <div style={{ width: `${m.progressPct}%`, height: "100%", background: m.progressPct === 100 ? GREEN : INDIGO }} />
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                    {m.completedCount} / {m.totalModules} modules · {m.progressPct}%
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "chat" && (
        <section>
          {viewerIsMember ? (
            <GroupChatPanel groupId={groupId} canSend />
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, textAlign: "center", color: MUTED }}>
              <p style={{ margin: 0 }}>Join this {ORG_CONFIG.cohortLabel.toLowerCase()} to participate in chat.</p>
            </div>
          )}
        </section>
      )}

      {tab === "posts" && (
        <section>
          <CohortPostsFeed groupId={groupId} canPost={viewerIsMember} />
        </section>
      )}
    </div>
  );
}

export default function CohortDashboardPage() {
  return (
    <Suspense fallback={null}>
      <CohortPageInner />
    </Suspense>
  );
}
