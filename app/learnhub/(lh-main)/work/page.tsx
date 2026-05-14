"use client";

import { Suspense, useState, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

// ── Design tokens ────────────────────────────────────────────
const BG = "#090b18";
const CARD = "#111323";
const CARD2 = "#161929";
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT = "#e8eaf4";
const MUTED = "rgba(185,190,230,0.6)";
const DIM = "rgba(100,110,165,0.5)";
const ORANGE = "#f97316";
const GREEN = "#22c55e";
const SKY = "#38bdf8";
const INDIGO = "#6366f1";

const ACCENT_CYCLE = [GREEN, INDIGO, ORANGE, "#a855f7", SKY, "#ec4899", "#fbbf24"] as const;

// ── Types ─────────────────────────────────────────────────────
type Opportunity = {
  _id: string;
  orgName: string;
  title: string;
  description: string;
  workType: "remote" | "hybrid" | "onsite";
  payType: "volunteer" | "stipend" | "paid";
  payAmount?: string;
  slots: number;
  filledSlots?: number;
  deadline: number;
  duration: string;
  requiredCertTypes: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  minXp?: number;
  eligibilityMode?: "open" | "guided" | "strict";
  status: "open" | "closed";
  match?: {
    eligibilityStatus: "eligible" | "borderline" | "not_eligible";
    matchScore: number;
    missingRequirements: string[];
  } | null;
  myApplication?: { status: string } | null;
  pendingReferral?: { _id: string; note?: string } | null;
  isSeed?: boolean;
};

// ── Seed fallback ─────────────────────────────────────────────
const SEED_OPPORTUNITIES: Opportunity[] = [
  {
    _id: "w1", orgName: "TechCorp Philippines", title: "Remote IT Support Specialist",
    description: "Join our helpdesk team providing technical support to corporate clients across Luzon.",
    workType: "remote", payType: "paid", payAmount: "₱18,000/mo", slots: 3,
    deadline: Date.now() + 7 * 86400000, duration: "6 months",
    requiredCertTypes: ["Tech4ED", "SPARK"], requiredSkills: ["IT support", "Troubleshooting"],
    minXp: 500, eligibilityMode: "guided", status: "open", isSeed: true,
  },
  {
    _id: "w2", orgName: "DILG Bicol Region", title: "Digital Records Management Assistant",
    description: "Help digitize and manage government records as part of the eGov initiative.",
    workType: "hybrid", payType: "stipend", payAmount: "₱8,000/mo", slots: 5,
    deadline: Date.now() + 14 * 86400000, duration: "3 months",
    requiredCertTypes: ["DWIA"], requiredSkills: ["Records", "Data entry"],
    minXp: 300, eligibilityMode: "guided", status: "open", isSeed: true,
  },
  {
    _id: "w3", orgName: "DICT Region V", title: "Training Assistant — Tech4ED",
    description: "Assist in delivering Tech4ED training sessions to communities in Camarines Sur.",
    workType: "onsite", payType: "volunteer", slots: 2,
    deadline: Date.now() + 21 * 86400000, duration: "Per session",
    requiredCertTypes: ["Tech4ED"], preferredSkills: ["Facilitation"],
    minXp: 200, eligibilityMode: "open", status: "open", isSeed: true,
  },
  {
    _id: "w4", orgName: "Bicol E-Commerce Hub", title: "Social Media Content Creator",
    description: "Create digital content promoting local businesses and their products online.",
    workType: "remote", payType: "paid", payAmount: "₱15,000/mo", slots: 1,
    deadline: Date.now() + 5 * 86400000, duration: "4 months",
    requiredCertTypes: ["SPARK", "DWIA"], requiredSkills: ["Content creation"],
    preferredSkills: ["Canva", "Copywriting"], minXp: 800, eligibilityMode: "guided",
    status: "open", isSeed: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────
function orgInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
function ac(i: number) { return ACCENT_CYCLE[i % ACCENT_CYCLE.length]; }
function oc(i: number) { return ACCENT_CYCLE[(i + 2) % ACCENT_CYCLE.length]; }
function matchColor(score: number): string {
  if (score >= 80) return GREEN;
  if (score >= 55) return "#fbbf24";
  if (score >= 30) return SKY;
  return DIM;
}
const WORK_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const PAY_LABEL: Record<string, string> = { volunteer: "Volunteer", stipend: "Stipend", paid: "Paid" };
function salaryStr(opp: Opportunity): string {
  return opp.payAmount ? `${PAY_LABEL[opp.payType]} · ${opp.payAmount}` : PAY_LABEL[opp.payType];
}

// ── Progress Bar ──────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}

// ── Band ─────────────────────────────────────────────────────
function Band({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{title}</div>
        <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 13 }}>
        {children}
      </div>
    </div>
  );
}

// ── Opportunity Card ──────────────────────────────────────────
function OppCard({ opp, idx, applied, onClick }: { opp: Opportunity; idx: number; applied: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const accent = ac(idx);
  const orgCol = oc(idx);
  const ini = orgInitials(opp.orgName);
  const score = opp.match?.matchScore ?? 0;
  const mc = matchColor(score);
  const isExpired = opp.deadline < Date.now();
  const eligible = opp.match?.eligibilityStatus === "eligible";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: CARD, borderRadius: 14,
        border: `1px solid ${hov ? accent + "55" : BORDER}`,
        padding: "16px 17px", cursor: "pointer",
        transition: "transform 0.22s, border-color 0.18s, box-shadow 0.2s",
        transform: hov ? "translateY(-3px)" : "none",
        boxShadow: hov ? `0 14px 38px rgba(0,0,0,0.45), 0 0 0 1px ${accent}22` : "0 2px 8px rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column", gap: 11, position: "relative", overflow: "hidden",
      }}
    >
      {/* Accent stripe */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg,${accent},${accent}33)` }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${orgCol}22`, border: `1px solid ${orgCol}44`, display: "flex", alignItems: "center", justifyContent: "center", color: orgCol, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
          {ini}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT, lineHeight: 1.35, marginBottom: 3 }}>{opp.title}</div>
          <div style={{ fontSize: 11.5, color: MUTED }}>{opp.orgName}</div>
        </div>
        {opp.match && (
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div style={{ fontSize: 9, color: DIM, letterSpacing: 0.7, fontWeight: 600, marginBottom: 2 }}>MATCH</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: mc, lineHeight: 1 }}>{score}%</div>
          </div>
        )}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}>
          {WORK_LABEL[opp.workType]}
        </span>
        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.04)", color: MUTED, border: `1px solid ${BORDER}` }}>
          {opp.duration}
        </span>
        {opp.requiredCertTypes.slice(0, 2).map((c) => (
          <span key={c} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: `${INDIGO}14`, color: INDIGO, border: `1px solid ${INDIGO}33` }}>
            {c}
          </span>
        ))}
      </div>

      {/* Description */}
      <div style={{ fontSize: 12.2, color: MUTED, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
        {opp.description}
      </div>

      {/* Match bar */}
      {opp.match && (
        <div>
          <ProgressBar pct={score} color={mc} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10.5, color: DIM }}>
            <span>{eligible ? "✓ Requirements met" : "⚠ Missing required certificate"}</span>
            <span>{salaryStr(opp)}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, color: MUTED }}>
          <span style={{ color: isExpired ? "#fb7185" : MUTED }}>
            {isExpired ? "⏰ Closed" : `⏰ Apply by ${format(opp.deadline, "MMM d")}`}
          </span>
          <span style={{ color: DIM }}> · </span>
          <span>{opp.slots - (opp.filledSlots ?? 0)}/{opp.slots} slots</span>
        </div>
        <div style={{ padding: "5px 12px", borderRadius: 14, fontSize: 11, fontWeight: 700, background: applied ? `${GREEN}1c` : `${accent}1c`, color: applied ? GREEN : accent, border: `1px solid ${applied ? GREEN : accent}44` }}>
          {applied ? "✓ Applied" : "View →"}
        </div>
      </div>
    </div>
  );
}

// ── Job Detail Modal ──────────────────────────────────────────
function JobDetailModal({
  opp, idx, applied, isMine, isStudent,
  onClose, onApply, onApplyWithNote, onClosePosting,
}: {
  opp: Opportunity | null; idx: number; applied: boolean; isMine: boolean; isStudent: boolean;
  onClose: () => void; onApply: () => void; onApplyWithNote: (note: string) => void;
  onClosePosting: () => void;
}) {
  const [note, setNote] = useState("");
  if (!opp) return null;

  const score = opp.match?.matchScore ?? 0;
  const mc = matchColor(score);
  const eligible = opp.match?.eligibilityStatus === "eligible";
  const needsNote = isStudent && !!opp.match && !eligible && !opp.pendingReferral;
  const isExpired = opp.deadline < Date.now();
  const accent = ac(idx);
  const orgCol = oc(idx);
  const ini = orgInitials(opp.orgName);
  const canApply = isStudent && !applied && !isExpired && !opp.isSeed;
  const applyDisabled = !canApply || (!!needsNote && note.trim().length < 8);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,7,18,0.78)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, maxHeight: "88vh", background: CARD, borderRadius: 18, border: `1px solid ${BORDER2}`, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>

        {/* Banner */}
        <div style={{ position: "relative", padding: "22px 26px 18px", background: `linear-gradient(135deg,${accent}26,${orgCol}1a 55%,${CARD} 100%)`, borderBottom: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,0.4)", color: TEXT, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 54, height: 54, borderRadius: 12, background: `${orgCol}22`, border: `1px solid ${orgCol}55`, display: "flex", alignItems: "center", justifyContent: "center", color: orgCol, fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{ini}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, lineHeight: 1.25 }}>{opp.title}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}><span style={{ fontWeight: 600, color: TEXT }}>{opp.orgName}</span></div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${accent}1c`, color: accent, border: `1px solid ${accent}44` }}>{WORK_LABEL[opp.workType]}</span>
                <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.05)", color: MUTED, border: `1px solid ${BORDER}` }}>{opp.duration}</span>
                <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.05)", color: MUTED, border: `1px solid ${BORDER}` }}>💰 {salaryStr(opp)}</span>
                <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.05)", color: isExpired ? "#fb7185" : MUTED, border: `1px solid ${BORDER}` }}>
                  📅 {isExpired ? "Closed" : `Apply by ${format(opp.deadline, "MMM d, yyyy")}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 26px 8px", scrollbarWidth: "thin" }}>
          {/* Match panel */}
          {isStudent && opp.match && (
            <div style={{ background: `${mc}0e`, border: `1px solid ${mc}33`, borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: opp.match.missingRequirements.length > 0 ? 9 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: mc, lineHeight: 1 }}>{score}%</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{score >= 80 ? "Strong match for you" : score >= 55 ? "Good potential match" : "Stretch opportunity"}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>Based on your certificates, courses & interests</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: eligible ? GREEN : "#fb7185", padding: "4px 9px", borderRadius: 8, background: eligible ? `${GREEN}18` : "rgba(251,113,133,0.12)", border: `1px solid ${eligible ? GREEN + "44" : "rgba(251,113,133,0.3)"}` }}>
                  {eligible ? "Eligible to apply" : "Missing requirements"}
                </div>
              </div>
              {opp.match.missingRequirements.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {opp.match.missingRequirements.map((r, i) => (
                    <span key={i} style={{ padding: "4px 10px", borderRadius: 14, fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(251,113,133,0.08)", color: "#fb7185", border: "1px solid rgba(251,113,133,0.25)" }}>
                      ○ {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* About */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: DIM, letterSpacing: 1, marginBottom: 7 }}>ABOUT THE ROLE</div>
            <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.65 }}>{opp.description}</div>
          </div>

          {/* Certs & Skills */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: DIM, letterSpacing: 1, marginBottom: 9 }}>REQUIRED CERTIFICATES</div>
              {opp.requiredCertTypes.length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>None required</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {opp.requiredCertTypes.map((c) => (
                    <div key={c} style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 7 }}>
                      ○ {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: DIM, letterSpacing: 1, marginBottom: 9 }}>KEY SKILLS</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {(opp.requiredSkills ?? []).map((s) => (
                  <span key={s} style={{ padding: "4px 9px", borderRadius: 14, fontSize: 11, background: "rgba(255,255,255,0.05)", color: MUTED, border: `1px solid ${BORDER}` }}>{s}</span>
                ))}
                {(opp.preferredSkills ?? []).map((s) => (
                  <span key={s} style={{ padding: "4px 9px", borderRadius: 14, fontSize: 11, background: "rgba(255,255,255,0.03)", color: DIM, border: `1px solid ${BORDER}` }}>{s} (preferred)</span>
                ))}
                {!(opp.requiredSkills?.length) && !(opp.preferredSkills?.length) && (
                  <span style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>None specified</span>
                )}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div style={{ background: CARD2, borderRadius: 11, padding: "13px 14px", marginBottom: 6, display: "flex", gap: 24, flexWrap: "wrap", border: `1px solid ${BORDER}` }}>
            <div>
              <div style={{ fontSize: 9.5, color: DIM, letterSpacing: 0.6, fontWeight: 600, marginBottom: 2 }}>SLOTS OPEN</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{opp.slots - (opp.filledSlots ?? 0)} / {opp.slots}</div>
            </div>
            {opp.minXp && (
              <div>
                <div style={{ fontSize: 9.5, color: DIM, letterSpacing: 0.6, fontWeight: 600, marginBottom: 2 }}>MIN XP</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>⚡ {opp.minXp.toLocaleString()}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 9.5, color: DIM, letterSpacing: 0.6, fontWeight: 600, marginBottom: 2 }}>DEADLINE</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isExpired ? "#fb7185" : TEXT }}>
                {isExpired ? "Closed" : format(opp.deadline, "MMM d, yyyy")}
              </div>
            </div>
          </div>

          {/* Note for non-eligible */}
          {needsNote && !applied && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DIM, letterSpacing: 1, marginBottom: 7 }}>WHY YOU&apos;RE A FIT</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Explain your related experience, motivation, or why the poster should still consider you…"
                style={{ width: "100%", background: CARD2, border: `1px solid ${BORDER2}`, borderRadius: 10, color: TEXT, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit" }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "rgba(0,0,0,0.25)", display: "flex", gap: 10 }}>
          {isMine ? (
            <>
              <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${BORDER2}`, background: "transparent", color: MUTED, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
              <button onClick={() => { onClosePosting(); onClose(); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #fb7185aa", background: "rgba(251,113,133,0.1)", color: "#fb7185", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🗑 Close this posting</button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${BORDER2}`, background: "transparent", color: TEXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>💬 Message</button>
              <button
                onClick={() => { if (canApply) { needsNote ? onApplyWithNote(note) : onApply(); } }}
                disabled={applyDisabled}
                style={{
                  flex: 1, padding: 10, borderRadius: 10, border: "none",
                  background: applied ? `${GREEN}22` : !canApply ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg,${accent},${accent}cc)`,
                  color: applied ? GREEN : !canApply ? DIM : "white",
                  fontSize: 13, fontWeight: 700,
                  cursor: applyDisabled ? "not-allowed" : "pointer",
                  boxShadow: !applyDisabled ? `0 6px 18px ${accent}55` : "none",
                  opacity: applyDisabled && !applied ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {applied ? "✓ Application submitted" : opp.isSeed ? "Preview only" : isExpired ? "Applications closed" : !isStudent ? "Log in as student to apply" : needsNote ? "Submit for Review →" : "Apply now →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState({ tab, onBrowse }: { tab: string; onBrowse: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "72px 0", color: DIM }}>
      <div style={{ fontSize: 38, marginBottom: 10 }}>{tab === "applied" ? "📨" : tab === "mine" ? "📌" : "🔍"}</div>
      <div style={{ fontSize: 14, color: MUTED, fontWeight: 600 }}>
        {tab === "applied" ? "You haven't applied to anything yet" : tab === "mine" ? "You haven't posted any opportunities yet" : "No matching opportunities"}
      </div>
      <div style={{ fontSize: 12, color: DIM, marginTop: 6 }}>
        {tab === "applied" ? `Browse "For You" to find roles that fit your profile.` : tab === "mine" ? `Click "Post a job order" to publish your first opportunity.` : "Try a different keyword or filter."}
      </div>
      {tab === "applied" && (
        <button onClick={onBrowse} style={{ marginTop: 16, padding: "9px 18px", borderRadius: 20, border: "none", background: ORANGE, color: "white", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>✨ See For You</button>
      )}
      {tab === "mine" && (
        <Link href="/learnhub/work/post" style={{ display: "inline-block", marginTop: 16, padding: "9px 18px", borderRadius: 20, background: `linear-gradient(135deg,${ORANGE},#ea580c)`, color: "white", fontWeight: 700, fontSize: 12.5, textDecoration: "none", boxShadow: `0 4px 14px ${ORANGE}55` }}>
          + Post a job order
        </Link>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
function WorkPageInner() {
  const [tab, setTab] = useState<"foryou" | "all" | "applied" | "mine">("foryou");
  const [query, setQuery] = useState("");
  const [openOpp, setOpenOpp] = useState<{ opp: Opportunity; idx: number } | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const { userId, role, isMentor } = useLearnhubSession();
  const isStudent = role === "student";
  const canPost = role === "org_partner" || role === "admin" || isMentor;

  const applyMutation = useMutation(api.learnhub_work.applyForOpportunity);
  const acceptReferral = useMutation(api.learnhub_work.acceptOpportunityReferral);

  const liveOpps = useQuery(
    api.learnhub_work.listOpenOpportunities,
    userId && role === "student" ? { studentId: userId as Id<"learnhub_users"> } : {}
  );

  const source: Opportunity[] = (liveOpps && liveOpps.length > 0 ? liveOpps : SEED_OPPORTUNITIES) as Opportunity[];

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return source;
    return source.filter((o) => [o.title, o.orgName, o.description, ...(o.requiredSkills ?? [])].join(" ").toLowerCase().includes(q));
  }, [source, query]);

  const scored = useMemo(
    () => [...filtered].sort((a, b) => (b.match?.matchScore ?? 0) - (a.match?.matchScore ?? 0)),
    [filtered]
  );

  const strong    = scored.filter((o) => (o.match?.matchScore ?? 0) >= 80);
  const exploring = scored.filter((o) => { const s = o.match?.matchScore ?? 0; return s >= 55 && s < 80; });
  const stretch   = scored.filter((o) => (o.match?.matchScore ?? 0) < 55);
  const myApps    = scored.filter((o) => applied.has(o._id) || Boolean(o.myApplication));

  const showBands = tab === "foryou" && isStudent;
  const listItems = tab === "applied" ? myApps : tab === "mine" ? [] : scored;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const doApply = async (opp: Opportunity, note?: string) => {
    if (!userId) { setError("Please sign in as a student to apply."); return; }
    setError("");
    setApplying(opp._id);
    setApplied((s) => new Set(Array.from(s).concat(opp._id)));
    try {
      if (opp.pendingReferral?._id) {
        await acceptReferral({ referralId: opp.pendingReferral._id as Id<"learnhub_work_referrals">, actorId: userId as Id<"learnhub_users">, reasoningNote: note?.trim() || undefined });
      } else {
        await applyMutation({ opportunityId: opp._id as Id<"learnhub_work_opportunities">, studentId: userId as Id<"learnhub_users">, actorId: userId as Id<"learnhub_users">, note: note?.trim() || undefined, reasoningNote: note?.trim() || undefined });
      }
      showToast(`Application submitted to ${opp.orgName} ✓`);
      setOpenOpp(null);
    } catch (err) {
      setApplied((s) => { const n = new Set(s); n.delete(opp._id); return n; });
      setError(err instanceof Error ? err.message : "Unable to apply right now.");
    } finally {
      setApplying(null);
    }
  };

  type TabId = "foryou" | "all" | "applied" | "mine";
  const TABS: { id: TabId; label: string; count: number | null }[] = [
    { id: "foryou",  label: "✨ For You",     count: isStudent ? scored.length : null },
    { id: "all",     label: "📋 All",          count: source.length },
    ...(isStudent ? [{ id: "applied" as TabId, label: "📨 Applied",     count: myApps.length }] : []),
    ...(canPost    ? [{ id: "mine"    as TabId, label: "📌 My Postings", count: 0 }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: BG }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: 1.4, marginBottom: 4, fontFamily: "var(--font-dm-sans, sans-serif)" }}>
              WORK BOARD · DICT REGION V
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: TEXT, lineHeight: 1.2, fontFamily: "var(--font-dm-serif, serif)", margin: 0 }}>
              Opportunities matched to your{" "}
              <em style={{ color: ORANGE }}>learning</em>
            </h1>
            <p style={{ fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
              Real job orders posted by mentors and DICT officers — personalized to your certificates, courses and interests.
            </p>
          </div>
          {canPost && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center", paddingTop: 4 }}>
              <Link href="/learnhub/work/manage" style={{ padding: "9px 14px", borderRadius: 11, border: `1px solid ${BORDER2}`, background: "transparent", color: MUTED, fontSize: 12, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                📋 Manage
              </Link>
              <Link href="/learnhub/work/post" style={{ padding: "9px 16px", borderRadius: 11, background: `linear-gradient(135deg,${ORANGE},#ea580c)`, color: "white", fontSize: 12.5, fontWeight: 700, boxShadow: `0 6px 18px ${ORANGE}55`, display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>+</span> Post a job order
              </Link>
            </div>
          )}
        </div>

        {/* Personalized banner */}
        {isStudent && tab === "foryou" && strong.length > 0 && (
          <div style={{ marginBottom: 14, padding: "12px 15px", borderRadius: 12, background: `linear-gradient(120deg,${GREEN}1c,${INDIGO}10 70%,transparent)`, border: `1px solid ${GREEN}33`, display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ fontSize: 22 }}>✨</div>
            <div style={{ flex: 1, fontSize: 12.5, color: TEXT, lineHeight: 1.45 }}>
              <strong>{strong.length} strong match{strong.length !== 1 ? "es" : ""}</strong> found based on your profile. Eligible roles are ready to apply now.
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, marginBottom: 12 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === t.id ? CARD2 : "transparent", color: tab === t.id ? TEXT : DIM, transition: "all 0.18s", boxShadow: tab === t.id ? "0 2px 8px rgba(0,0,0,0.3)" : "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {t.label}
              {t.count !== null && (
                <span style={{ padding: "1px 7px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: tab === t.id ? `${ORANGE}26` : "rgba(255,255,255,0.05)", color: tab === t.id ? ORANGE : DIM }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 14, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: DIM, pointerEvents: "none" }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by role, skill or organization…"
            style={{ width: "100%", padding: "10px 13px 10px 36px", borderRadius: 10, background: CARD2, border: `1px solid ${BORDER2}`, color: TEXT, fontSize: 13, outline: "none", fontFamily: "inherit" }}
          />
        </div>

        {error && (
          <div style={{ marginBottom: 12, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fb7185", background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)" }}>{error}</div>
        )}
      </div>

      {/* Skeleton */}
      {liveOpps === undefined && (
        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 160, borderRadius: 14, background: CARD, opacity: 0.6 }} className="animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Card list ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 28px", scrollbarWidth: "thin" }}>
        {showBands ? (
          <>
            {strong.length > 0 && (
              <Band title="✨ Strong matches" subtitle={`${strong.length} role${strong.length !== 1 ? "s" : ""} match your profile`}>
                {strong.map((o, i) => <OppCard key={o._id} opp={o} idx={i} applied={applied.has(o._id) || Boolean(o.myApplication)} onClick={() => setOpenOpp({ opp: o, idx: i })} />)}
              </Band>
            )}
            {exploring.length > 0 && (
              <Band title="🎯 Worth exploring" subtitle="Partial fit — close some skill gaps to improve match">
                {exploring.map((o, i) => <OppCard key={o._id} opp={o} idx={strong.length + i} applied={applied.has(o._id) || Boolean(o.myApplication)} onClick={() => setOpenOpp({ opp: o, idx: strong.length + i })} />)}
              </Band>
            )}
            {stretch.length > 0 && (
              <Band title="🚀 Stretch goals" subtitle="Aim here once you complete the required certificates">
                {stretch.map((o, i) => <OppCard key={o._id} opp={o} idx={strong.length + exploring.length + i} applied={applied.has(o._id) || Boolean(o.myApplication)} onClick={() => setOpenOpp({ opp: o, idx: strong.length + exploring.length + i })} />)}
              </Band>
            )}
            {scored.length === 0 && <EmptyState tab={tab} onBrowse={() => setTab("all")} />}
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 13 }}>
              {listItems.map((o, i) => <OppCard key={o._id} opp={o} idx={i} applied={applied.has(o._id) || Boolean(o.myApplication)} onClick={() => setOpenOpp({ opp: o, idx: i })} />)}
            </div>
            {listItems.length === 0 && <EmptyState tab={tab} onBrowse={() => setTab("foryou")} />}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {openOpp && (
        <JobDetailModal
          opp={openOpp.opp} idx={openOpp.idx}
          applied={applied.has(openOpp.opp._id) || Boolean(openOpp.opp.myApplication)}
          isMine={false} isStudent={isStudent}
          onClose={() => setOpenOpp(null)}
          onApply={() => void doApply(openOpp.opp)}
          onApplyWithNote={(note) => void doApply(openOpp.opp, note)}
          onClosePosting={() => {}}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: CARD2, border: `1px solid ${GREEN}44`, borderRadius: 12, padding: "12px 20px", fontSize: 13, fontWeight: 600, color: GREEN, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 200, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* suppress unused var warning */}
      {applying && null}
    </div>
  );
}

export default function WorkPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} /></div>}>
      <WorkPageInner />
    </Suspense>
  );
}
