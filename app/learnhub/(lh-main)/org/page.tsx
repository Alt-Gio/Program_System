"use client";

/**
 * Org Partner home — manager-style dashboard.
 *
 * Org partners + coordinators + admins land here to:
 *   • see all opportunities they posted (with applicant counts)
 *   • verify mentors pending review
 *   • peek at cohorts associated with the program
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { initialsAvatar } from "@/lib/learnhub/avatar";
import { Briefcase, Users, ShieldCheck, Layers, CheckCircle2, XCircle, Plus, ExternalLink } from "lucide-react";

const ORANGE = "#f97316";
const GREEN = "#10b981";
const SKY = "#0ea5e9";
const PINK = "#ec4899";

function KPI({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
      border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18,
      padding: "18px 20px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}22, transparent 70%)`, pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5,
          color: "rgba(255,255,255,0.5)", letterSpacing: 1.6, textTransform: "uppercase" }}>{label}</div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}1f`,
          border: `1px solid ${color}44`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} />
        </div>
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 900, fontSize: 30,
        letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color, marginTop: 8, letterSpacing: 0.4 }}>{sub}</div>}
    </div>
  );
}

export default function OrgHomePage() {
  const { userId, role, loading } = useLearnhubSession();
  const summary = useQuery(
    api.learnhub_org.getOrgSummary,
    userId ? { orgId: userId as Id<"learnhub_users"> } : "skip",
  );

  if (loading || summary === undefined) {
    return (
      <div style={{ padding: 24, color: "#fff" }}>
        <div style={{ height: 28, width: 240, background: "rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 18 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 110, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!userId || (role !== "org_partner" && role !== "coordinator" && role !== "admin")) {
    return (
      <div style={{ padding: 24, color: "#fff" }}>
        <div style={{ margin: "30px auto", maxWidth: 440, padding: 28, textAlign: "center", borderRadius: 20,
          background: "linear-gradient(180deg, rgba(236,72,153,0.06), rgba(255,255,255,0.02))", border: `1px solid ${PINK}44` }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🔒</div>
          <h2 style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>Org Console</h2>
          <p style={{ margin: "8px 0 18px", color: "rgba(255,255,255,0.65)", fontSize: 13.5 }}>
            This console is for <strong style={{ color: ORANGE }}>Org Partners</strong>,{" "}
            <strong style={{ color: "#a855f7" }}>Coordinators</strong>, and <strong>Admins</strong>.
            Switch to one of those roles to manage opportunities and verify mentors.
          </p>
          <Link href="/learnhub/feed" style={{ display: "inline-block", padding: "9px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            Back to feed →
          </Link>
        </div>
      </div>
    );
  }

  if (summary.forbidden) return <div style={{ padding: 24, color: "#fff" }}>You are not authorized.</div>;

  return <OrgConsole summary={summary} />;
}

type SummaryData = Exclude<ReturnType<typeof useQuery<typeof api.learnhub_org.getOrgSummary>>, undefined>;

function OrgConsole({ summary }: { summary: NonNullable<SummaryData> }) {
  if (summary.forbidden) return null;

  return (
    <div style={{ color: "#fff", background: "#06060f", minHeight: "100%", padding: "0 0 32px", fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" }}>
      <div style={{
        background: `linear-gradient(90deg, ${ORANGE}11, transparent 70%)`,
        borderBottom: `1px solid ${ORANGE}22`, padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          <span style={{ color: ORANGE }}>🏢</span>
          <span><strong style={{ color: "#fff" }}>Org Console</strong> · Manage job orders, verify mentors, and view cohorts.</span>
        </div>
        <Link href="/learnhub/work/post" style={{
          padding: "8px 14px", borderRadius: 99,
          background: `linear-gradient(135deg, ${ORANGE}, ${PINK})`,
          color: "#06060f", fontWeight: 700, fontSize: 12.5,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <Plus size={14} /> Post a job order
        </Link>
      </div>

      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: "clamp(24px, 2.8vw, 32px)", fontWeight: 900, letterSpacing: "-0.03em" }}>
            Welcome back, {summary.org.name.split(" ")[0]}.
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
            {summary.org.organization ? `${summary.org.organization} · ` : ""}
            Live overview of your postings, mentor pipeline, and cohorts.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <KPI icon={Briefcase} label="Open postings" value={summary.kpi.openOpportunities} sub={`${summary.kpi.totalOpportunities} all-time`} color={ORANGE} />
          <KPI icon={Users} label="Applicants" value={summary.kpi.totalApplicants} sub="across all postings" color={SKY} />
          <KPI icon={ShieldCheck} label="Mentors to verify" value={summary.kpi.pendingMentors}
            sub={summary.kpi.pendingMentors > 0 ? "needs review" : "all clear"}
            color={summary.kpi.pendingMentors > 0 ? "#f59e0b" : GREEN} />
          <KPI icon={Layers} label="Cohorts in view" value={summary.kpi.cohortCount} sub="program groups" color="#a855f7" />
        </div>

        <section>
          <SectionHeader title="Your job orders" sub="Posts you own — newest first." href="/learnhub/work/manage" cta="Manage all →" />
          {summary.opportunities.length === 0 ? (
            <EmptyState emoji="💼" title="No postings yet"
              body="Use the &ldquo;Post a job order&rdquo; button up top to publish your first opportunity. Students whose certificates match will see it surfaced first." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {summary.opportunities.slice(0, 6).map((o) => (
                <div key={o.id as unknown as string} style={{
                  display: "grid", gridTemplateColumns: "minmax(220px, 2fr) 110px 100px 110px 130px",
                  alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{o.workType} · {o.payType}</div>
                  </div>
                  <div>
                    <span style={{
                      padding: "4px 10px", borderRadius: 99, fontSize: 10.5,
                      fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1.2, textTransform: "uppercase",
                      color: o.status === "open" ? GREEN : "rgba(255,255,255,0.45)",
                      background: o.status === "open" ? `${GREEN}1c` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${o.status === "open" ? `${GREEN}55` : "rgba(255,255,255,0.1)"}`,
                    }}>{o.status}</span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#fff" }}>{o.filledSlots ?? 0} / {o.slots}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: SKY, fontWeight: 700 }}>{o.applicantCount} applied</div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Link href={`/learnhub/work/manage?id=${o.id}`} style={{
                      padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 11.5, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>Manage <ExternalLink size={12} /></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Mentors pending verification" sub="Approve to unlock mentor-only features for them." href="/learnhub/org/mentors" cta={summary.pendingMentors.length > 0 ? "Review all →" : undefined} />
          {summary.pendingMentors.length === 0 ? (
            <EmptyState emoji="✅" title="No mentors waiting"
              body="When a new mentor submits verification, they'll show up here for you to approve." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {summary.pendingMentors.slice(0, 4).map((p) => (
                <MentorRow key={p.verificationId as unknown as string} pending={p} actorId={summary.org.id} />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Cohorts" sub="Active groups (batches + programs) you can target." href="/learnhub/org/cohorts" cta={summary.cohorts.length > 0 ? "See all →" : undefined} />
          {summary.cohorts.length === 0 ? (
            <EmptyState emoji="🧭" title="No cohorts visible yet"
              body="Cohorts appear here once batches and program groups are created. Tag a job order with a cohort to broadcast it." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {summary.cohorts.slice(0, 6).map((c) => (
                <div key={c.id as unknown as string} style={{
                  padding: "14px 16px", borderRadius: 14,
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SKY,
                    letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
                    {c.type} {c.programType ? `· ${c.programType}` : ""}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>{c.name}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.45,
                    display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
                    {c.description}
                  </div>
                  <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                    👥 {c.memberCount} members
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ title, sub, href, cta }: { title: string; sub: string; href?: string; cta?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>{title}</h2>
        <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>{sub}</p>
      </div>
      {href && cta && (
        <Link href={href} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: ORANGE,
          letterSpacing: 1.2, textTransform: "uppercase", textDecoration: "none" }}>{cta}</Link>
      )}
    </div>
  );
}

function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div style={{ padding: 28, textAlign: "center", borderRadius: 14,
      background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</div>
      <p style={{ margin: 0, fontWeight: 700, color: "#fff", fontSize: 14 }}>{title}</p>
      <p style={{ margin: "6px auto 0", maxWidth: 420, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

function MentorRow({ pending, actorId }: {
  pending: {
    verificationId: Id<"learnhub_mentor_verifications">;
    mentor: { id: Id<"learnhub_users">; name: string; avatarUrl: string;
      designation: string | null; regionalOffice: string | null; expertiseTags: string[]; } | null;
    submittedAt: number; designation: string | null;
  };
  actorId: Id<"learnhub_users">;
}) {
  const approve = useMutation(api.learnhub_org.verifyMentorApprove);
  const reject = useMutation(api.learnhub_org.verifyMentorReject);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const handleApprove = async () => {
    setBusy("approve");
    try { await approve({ actorId, verificationId: pending.verificationId }); setDone("approved"); }
    finally { setBusy(null); }
  };
  const handleReject = async () => {
    setBusy("reject");
    try { await reject({ actorId, verificationId: pending.verificationId, reason: "Not eligible." }); setDone("rejected"); }
    finally { setBusy(null); }
  };

  if (!pending.mentor) {
    return (
      <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
        Submission #{(pending.verificationId as unknown as string).slice(0, 8)} (account deleted)
      </div>
    );
  }

  const mentor = pending.mentor;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12,
      background: done === "approved" ? `${GREEN}10` : done === "rejected" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)",
      border: done === "approved" ? `1px solid ${GREEN}55` : done === "rejected" ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,255,255,0.06)",
      opacity: done ? 0.85 : 1,
    }}>
      <img src={mentor.avatarUrl || initialsAvatar(mentor.name)} alt="" style={{
        width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.1)",
      }} onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = initialsAvatar(mentor.name);
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mentor.name}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
          {pending.designation ?? mentor.designation ?? "Mentor"}
          {mentor.regionalOffice ? ` · ${mentor.regionalOffice}` : ""}
        </div>
        {mentor.expertiseTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {mentor.expertiseTags.slice(0, 4).map((tag) => (
              <span key={tag} style={{ padding: "2px 8px", borderRadius: 99,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 10.5, color: "rgba(255,255,255,0.6)" }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      {done ? (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
          color: done === "approved" ? GREEN : "#ef4444", letterSpacing: 1.2, textTransform: "uppercase" }}>
          {done === "approved" ? "✓ Approved" : "✕ Rejected"}
        </span>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={handleApprove} disabled={busy !== null} style={{
            padding: "8px 12px", borderRadius: 10,
            background: `linear-gradient(135deg, ${GREEN}, #06b6d4)`, color: "#06060f",
            fontSize: 12, fontWeight: 700, border: 0,
            display: "inline-flex", alignItems: "center", gap: 6,
            cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
          }}><CheckCircle2 size={14} /> {busy === "approve" ? "…" : "Approve"}</button>
          <button type="button" onClick={handleReject} disabled={busy !== null} style={{
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(239,68,68,0.12)", color: "#ff5f6d",
            fontSize: 12, fontWeight: 700, border: "1px solid rgba(239,68,68,0.4)",
            display: "inline-flex", alignItems: "center", gap: 6,
            cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
          }}><XCircle size={14} /> {busy === "reject" ? "…" : "Reject"}</button>
        </div>
      )}
    </div>
  );
}
