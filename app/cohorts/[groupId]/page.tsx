"use client";

/**
 * Rec #4 — public cohort page.
 *
 * Unauthenticated, shareable to FB/Viber. Surfaces only aggregate data:
 * name, region, mentor display name, member count, path summary, lifecycle
 * status, and completion stats. Never exposes member names, ids, or chat.
 *
 * The "Join LearnHub" CTA deep-links to onboarding with ?suggestedCohort=
 * so the new user lands pre-aware of which cohort drew them in.
 */

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const BG = "#090b18";
const CARD = "#111323";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT = "#e8eaf4";
const MUTED = "rgba(185,190,230,0.6)";
const INDIGO = "#5b6cff";
const GREEN = "#22d3a0";
const SKY = "#38bdf8";

function statusChip(status: "draft" | "upcoming" | "active" | "completed" | "archived") {
  switch (status) {
    case "upcoming": return { label: "Starting soon", bg: "rgba(56,189,248,0.14)", fg: SKY };
    case "active":   return { label: "Live cohort", bg: "rgba(34,197,94,0.14)", fg: GREEN };
    case "completed":return { label: "Completed", bg: "rgba(168,85,247,0.14)", fg: "#a855f7" };
    default:         return { label: "Hidden", bg: "rgba(185,190,230,0.14)", fg: MUTED };
  }
}

function PublicCohortInner() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId as Id<"learnhub_groups">;
  const summary = useQuery(api.learnhub_groups.getCohortPublicSummary, { groupId });

  if (summary === undefined) {
    return <FullPage><p style={{ color: MUTED }}>Loading…</p></FullPage>;
  }
  if (summary === null) {
    return (
      <FullPage>
        <p style={{ color: MUTED, marginBottom: 16 }}>
          This cohort is private or doesn't exist publicly.
        </p>
        <a href="/learnhub" style={{ color: SKY, textDecoration: "none" }}>
          Open ILCDB LearnHub →
        </a>
      </FullPage>
    );
  }

  const chip = statusChip(summary.status);
  const accent = summary.coverColor ?? INDIGO;
  const joinHref = `/learnhub/onboarding?suggestedCohort=${groupId}`;

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", padding: "32px 20px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Hero */}
        <div
          style={{
            background: `linear-gradient(135deg, ${accent}30, ${CARD})`,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: 32,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8 }}>{summary.coverEmoji}</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "8px 0 4px", letterSpacing: "-0.01em" }}>
            {summary.name}
          </h1>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: chip.bg, color: chip.fg, fontWeight: 700 }}>
              {chip.label}
            </span>
            {summary.regionScope && (
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: MUTED, fontWeight: 600 }}>
                {summary.regionScope}
              </span>
            )}
          </div>
          {summary.description && (
            <p style={{ color: MUTED, marginTop: 14, fontSize: 14, lineHeight: 1.55, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
              {summary.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          <Stat label="Members" value={summary.memberCount} suffix={summary.capacity ? `/ ${summary.capacity}` : null} />
          <Stat label="Modules done" value={summary.totalModulesCompleted} />
          {summary.status === "completed" && (
            <Stat label="Graduates" value={summary.graduatedCount} accent={GREEN} />
          )}
          {summary.path && (
            <Stat label="Path length" value={`${summary.path.estimatedWeeks}w`} />
          )}
        </div>

        {/* Path summary */}
        {summary.path && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 6px", fontWeight: 700 }}>
              Following the path
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{summary.path.title}</h2>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              {summary.path.moduleCount} modules · {summary.path.programType}
            </p>
          </div>
        )}

        {/* Lead */}
        {summary.lead && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <img src={summary.lead.avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: 99 }} />
            <div>
              <p style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, margin: 0, fontWeight: 700 }}>
                Led by
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: "2px 0 0" }}>
                {summary.lead.name}
                {summary.lead.isVerifiedMentor && (
                  <span style={{ marginLeft: 6, color: GREEN, fontSize: 12 }}>✓ Verified mentor</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>
            Want to join a cohort like this?
          </p>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px", lineHeight: 1.5 }}>
            ILCDB LearnHub helps Filipinos learn together — pick a path, join a cohort, finish strong.
          </p>
          <a
            href={joinHref}
            style={{
              display: "inline-block",
              padding: "12px 28px",
              borderRadius: 99,
              background: `linear-gradient(135deg, ${INDIGO}, ${accent})`,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Join LearnHub →
          </a>
          <p style={{ fontSize: 11, color: MUTED, margin: "12px 0 0" }}>
            Free for Region V learners
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: MUTED }}>
          ILCDB LearnHub · DICT Region V
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, accent }: { label: string; value: number | string; suffix?: string | null; accent?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
      <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: accent ?? TEXT, lineHeight: 1.1 }}>
        {value}{suffix ? <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}> {suffix}</span> : null}
      </p>
      <p style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "4px 0 0", fontWeight: 600 }}>
        {label}
      </p>
    </div>
  );
}

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", padding: 32, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "120px auto", textAlign: "center" }}>
        {children}
      </div>
    </div>
  );
}

export default function PublicCohortPage() {
  return (
    <Suspense fallback={null}>
      <PublicCohortInner />
    </Suspense>
  );
}
