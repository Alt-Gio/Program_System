"use client";

/**
 * Phase 9.A.6 — Browse published learning paths.
 *
 * Surfaces every path with visibility=public + published=true. Filter by
 * program (from ORG_CONFIG.programs) and estimated-weeks bucket. Cards
 * link to /learnhub/learning-path/[pathId].
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ORG_CONFIG, programColor } from "@/lib/learnhub/org-config";

const BG = "var(--lh-bg)";
const CARD = "var(--lh-card)";
const BORDER = "var(--lh-border)";
const BORDER2 = "var(--lh-border-strong)";
const TEXT = "var(--lh-text)";
const MUTED = "var(--lh-text-2)";
const INDIGO = "#5b6cff";
const GREEN = "#22d3a0";

type WeeksBucket = "short" | "medium" | "long" | "";

function PathsBrowseInner() {
  const [program, setProgram] = useState<string>("");
  const [bucket, setBucket] = useState<WeeksBucket>("");

  const paths = useQuery(api.learnhub_learning_paths.listPublishedPaths, {
    programType: program || undefined,
    weeksBucket: bucket || undefined,
  });

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", padding: "24px 32px" }}>
      <header style={{ marginBottom: 24, display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Browse paths</h1>
          <p style={{ color: MUTED, marginTop: 6, fontSize: 14 }}>
            Structured learning journeys built by mentors and coordinators. Enroll to commit, or build your own.
          </p>
        </div>
        <Link
          href="/learnhub/learning-path/create"
          style={{ padding: "10px 16px", borderRadius: 99, background: INDIGO, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
        >
          + Create path
        </Link>
      </header>

      {/* Filters */}
      <section style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <select
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          style={selectStyle}
        >
          <option value="">All programs</option>
          {ORG_CONFIG.programs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={bucket}
          onChange={(e) => setBucket(e.target.value as WeeksBucket)}
          style={selectStyle}
        >
          <option value="">Any length</option>
          <option value="short">≤4 weeks</option>
          <option value="medium">5–8 weeks</option>
          <option value="long">9+ weeks</option>
        </select>
      </section>

      {/* Grid */}
      {paths === undefined ? (
        <p style={{ color: MUTED }}>Loading…</p>
      ) : paths.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: "center" }}>
          <p style={{ color: MUTED, margin: 0 }}>No paths published yet.</p>
          <p style={{ color: MUTED, marginTop: 8, fontSize: 12 }}>
            Be the first — <Link href="/learnhub/learning-path/create" style={{ color: INDIGO }}>create a path</Link>.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {paths.map((p) => {
            const color = p.coverColor ?? programColor(p.programType);
            return (
              <Link
                key={p._id}
                href={`/learnhub/learning-path/${p._id}`}
                style={{
                  display: "block",
                  background: `linear-gradient(135deg, ${color}20, ${CARD})`,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: 16,
                  textDecoration: "none",
                  color: TEXT,
                }}
              >
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{p.coverEmoji ?? "📚"}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 6px", borderRadius: 4, background: `${color}1c`, color, border: `1px solid ${color}33` }}>
                    {p.programType.toUpperCase()}
                  </span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{p.title}</h3>
                <p style={{ fontSize: 12, color: MUTED, margin: "0 0 8px", lineHeight: 1.4, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
                  {p.description}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: MUTED }}>
                  <span>{p.moduleCount} modules · ~{p.estimatedWeeks}w</span>
                  <span>{p.enrollmentCount} enrolled</span>
                </div>
                {p.author && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                    <img src={p.author.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: 99 }} />
                    <span style={{ fontSize: 11, color: MUTED }}>
                      by {p.author.name}
                      {p.author.role === "mentor" && p.author.mentorStatus === "verified" && (
                        <span style={{ marginLeft: 4, color: GREEN }}>✓</span>
                      )}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 99,
  fontSize: 12,
  background: CARD,
  color: TEXT,
  border: `1px solid ${BORDER2}`,
  cursor: "pointer",
};

export default function PathsBrowsePage() {
  return (
    <Suspense fallback={null}>
      <PathsBrowseInner />
    </Suspense>
  );
}
