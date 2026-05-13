"use client";
import { Suspense } from "react";

import { format } from "date-fns";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

// Seed opportunities shown when Convex has no records yet
const SEED_OPPORTUNITIES: Opportunity[] = [
  { _id: "w1", orgName: "TechCorp Philippines", title: "Remote IT Support Specialist", description: "Join our helpdesk team providing technical support to corporate clients across Luzon.", workType: "remote", payType: "paid", payAmount: "₱18,000/mo", slots: 3, deadline: Date.now() + 7 * 86400000, duration: "6 months", requiredCertTypes: ["Tech4ED", "SPARK"], requiredSkills: ["IT support", "Troubleshooting"], minXp: 500, eligibilityMode: "guided", status: "open", isSeed: true },
  { _id: "w2", orgName: "DILG Bicol Region", title: "Digital Records Management Assistant", description: "Help digitize and manage government records as part of the eGov initiative.", workType: "hybrid", payType: "stipend", payAmount: "₱8,000/mo", slots: 5, deadline: Date.now() + 14 * 86400000, duration: "3 months", requiredCertTypes: ["DWIA"], requiredSkills: ["Records", "Data entry"], minXp: 300, eligibilityMode: "guided", status: "open", isSeed: true },
  { _id: "w3", orgName: "DICT Region V", title: "Training Assistant — Tech4ED", description: "Assist in delivering Tech4ED training sessions to communities in Camarines Sur.", workType: "onsite", payType: "volunteer", payAmount: undefined, slots: 2, deadline: Date.now() + 21 * 86400000, duration: "Per session", requiredCertTypes: ["Tech4ED"], preferredSkills: ["Facilitation"], minXp: 200, eligibilityMode: "open", status: "open", isSeed: true },
  { _id: "w4", orgName: "Bicol E-Commerce Hub", title: "Social Media Content Creator", description: "Create digital content promoting local businesses and their products online.", workType: "remote", payType: "paid", payAmount: "₱15,000/mo", slots: 1, deadline: Date.now() + 5 * 86400000, duration: "4 months", requiredCertTypes: ["SPARK", "DWIA"], requiredSkills: ["Content creation"], preferredSkills: ["Canva", "Copywriting"], minXp: 800, eligibilityMode: "guided", status: "open", isSeed: true },
];

const WORK_TYPE = { remote: { label: "Remote", color: "#22d3a0" }, hybrid: { label: "Hybrid", color: "#ff8c42" }, onsite: { label: "On-site", color: "#5b6cff" } };
const PAY_TYPE = { volunteer: { label: "Volunteer", color: "#9ba3cc" }, stipend: { label: "Stipend", color: "#ff8c42" }, paid: { label: "Paid", color: "#22d3a0" } };
const MATCH_COLOR = { eligible: "#22d3a0", borderline: "#ff8c42", not_eligible: "#ff5f6d" };

const REVIEW_LABEL: Record<EligibilityStatus, string> = {
  eligible: "Strong match",
  borderline: "Review queue",
  not_eligible: "Needs endorsement",
};

type FilterType = "all" | "remote" | "hybrid" | "onsite";
type PayFilter = "all" | "paid" | "stipend" | "volunteer";
type EligibilityStatus = "eligible" | "borderline" | "not_eligible";

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
    eligibilityStatus: EligibilityStatus;
    matchScore: number;
    missingRequirements: string[];
  } | null;
  myApplication?: { status: string } | null;
  pendingReferral?: { _id: string; note?: string } | null;
  isSeed?: boolean;
};

function WorkPageInner() {
  const [workFilter, setWorkFilter] = useState<FilterType>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null);
  const [reviewOpp, setReviewOpp] = useState<Opportunity | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState("");
  const { userId, role, isMentor } = useLearnhubSession();
  const canPost = role === "org_partner" || role === "admin" || isMentor;
  const applyMutation = useMutation(api.learnhub_work.applyForOpportunity);
  const acceptReferral = useMutation(api.learnhub_work.acceptOpportunityReferral);

  const liveOpps = useQuery(
    api.learnhub_work.listOpenOpportunities,
    userId && role === "student" ? { studentId: userId as Id<"learnhub_users"> } : {}
  );
  const source: Opportunity[] = (liveOpps && liveOpps.length > 0 ? liveOpps : SEED_OPPORTUNITIES) as Opportunity[];

  const filtered = source.filter((o: Opportunity) => {
    if (workFilter !== "all" && o.workType !== workFilter) return false;
    if (payFilter !== "all" && o.payType !== payFilter) return false;
    return true;
  });

  const apply = async (opp: Opportunity, note?: string) => {
    if (applied.has(opp._id) || applying === opp._id) return;
    if (!userId) { setError("Please sign in as a student to apply."); return; }
    setError("");
    setApplying(opp._id);
    setApplied((s) => new Set(Array.from(s).concat(opp._id)));
    try {
      if (opp.pendingReferral?._id) {
        await acceptReferral({
          referralId: opp.pendingReferral._id as Id<"learnhub_work_referrals">,
          actorId: userId as Id<"learnhub_users">,
          reasoningNote: note?.trim() || undefined,
        });
      } else {
        await applyMutation({
          opportunityId: opp._id as Id<"learnhub_work_opportunities">,
          studentId: userId as Id<"learnhub_users">,
          actorId: userId as Id<"learnhub_users">,
          note: note?.trim() || undefined,
          reasoningNote: note?.trim() || undefined,
        });
      }
      setReviewOpp(null);
      setReasoning("");
    } catch (err) {
      setApplied((s) => { const n = new Set(s); n.delete(opp._id); return n; });
      setError(err instanceof Error ? err.message : "Unable to apply right now.");
    } finally {
      setApplying(null);
    }
  };

  const startApply = (opp: Opportunity) => {
    if (opp.match && opp.match.eligibilityStatus !== "eligible" && !opp.pendingReferral) {
      setReviewOpp(opp);
      setReasoning("");
      setError("");
      return;
    }
    void apply(opp);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 lh-work-page">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Work Opportunities</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>Matched projects, referrals, and work pathways for ILCDB learners</p>
        </div>
        {canPost && (
          <div className="flex gap-2 shrink-0">
            <Link
              href="/learnhub/work/post"
              className="text-xs px-3 py-2 rounded-lg font-semibold"
              style={{ background: "#ff8c42", color: "#fff", fontFamily: "var(--font-sora)" }}
            >
              + Post Opportunity
            </Link>
            <Link
              href="/learnhub/work/manage"
              className="text-xs px-3 py-2 rounded-lg font-semibold"
              style={{ background: "rgba(91,108,255,0.15)", color: "#7c8bff", border: "1px solid rgba(91,108,255,0.35)", fontFamily: "var(--font-sora)" }}
            >
              Manage
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["all", "remote", "hybrid", "onsite"] as FilterType[]).map((f) => (
            <button key={f} onClick={() => setWorkFilter(f)} className="text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition-all" style={{ background: workFilter === f ? "#5b6cff" : "transparent", color: workFilter === f ? "#fff" : "#9ba3cc" }}>{f}</button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["all", "paid", "stipend", "volunteer"] as PayFilter[]).map((f) => (
            <button key={f} onClick={() => setPayFilter(f)} className="text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition-all" style={{ background: payFilter === f ? "#5b6cff" : "transparent", color: payFilter === f ? "#fff" : "#9ba3cc" }}>{f}</button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm mb-3 rounded-xl px-3 py-2" style={{ color: "#ff5f6d", background: "rgba(255,95,109,0.08)", border: "1px solid rgba(255,95,109,0.2)" }}>{error}</p>}

      {liveOpps === undefined && (
        <div className="flex flex-col gap-4 mb-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "#131626" }} />)}
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-4">
        {filtered.map((opp: Opportunity) => {
          const wt = WORK_TYPE[opp.workType];
          const pt = PAY_TYPE[opp.payType];
          const isExpired = opp.deadline < Date.now();
          const hasApplied = applied.has(opp._id) || Boolean(opp.myApplication);
          const match = opp.match;
          const matchColor = match ? MATCH_COLOR[match.eligibilityStatus] : "#7c8bff";
          const isSeedPreview = Boolean(opp.isSeed);
          const disabled = isSeedPreview || isExpired || hasApplied || applying === opp._id || !userId || role !== "student";

          return (
            <div key={opp._id} className="rounded-2xl overflow-hidden" style={{ background: "#131626", border: `1px solid ${matchColor}33` }}>
              <div className="px-5 py-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-base font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{opp.title}</p>
                    <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>{opp.orgName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {match && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: matchColor + "20", color: matchColor }}>{REVIEW_LABEL[match.eligibilityStatus]} · {match.matchScore}%</span>}
                    {opp.pendingReferral && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,211,160,0.14)", color: "#22d3a0" }}>Referred to you</span>}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: pt.color + "20", color: pt.color }}>{pt.label}{opp.payAmount ? ` · ${opp.payAmount}` : ""}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: wt.color + "20", color: wt.color }}>{wt.label}</span>
                  </div>
                </div>

                <p className="text-sm mb-3 leading-relaxed" style={{ color: "#c8caf0" }}>{opp.description}</p>

                {/* Meta row */}
                <div className="flex flex-wrap gap-3 text-xs mb-3" style={{ color: "#9ba3cc" }}>
                  <span>📅 {opp.duration}</span>
                  <span>👥 {(opp.slots - (opp.filledSlots ?? 0))} / {opp.slots} slots open</span>
                  {opp.minXp ? <span>⚡ {opp.minXp.toLocaleString()} XP min</span> : null}
                  <span style={{ color: isExpired ? "#ff5f6d" : "#9ba3cc" }}>⏰ {isExpired ? "Closed" : `Apply by ${format(opp.deadline, "MMM d")}`}</span>
                </div>

                {/* Required certs */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {opp.requiredCertTypes.map((c: string) => (
                    <span key={c} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(91,108,255,0.1)", color: "#7c8bff" }}>{c}</span>
                  ))}
                  {(opp.requiredSkills ?? []).map((skill) => (
                    <span key={skill} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(255,140,66,0.1)", color: "#ff8c42" }}>{skill}</span>
                  ))}
                </div>

                {match?.missingRequirements && match.missingRequirements.length > 0 && (
                  <div className="mb-4 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: "#9ba3cc", letterSpacing: "0.08em" }}>Review notes</p>
                    <p className="text-xs" style={{ color: "#c8caf0" }}>{match.missingRequirements.join(" · ")}</p>
                  </div>
                )}

                <button onClick={() => startApply(opp)} disabled={disabled} className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50" style={{ background: hasApplied ? "#22d3a0" : isExpired ? "rgba(255,255,255,0.06)" : opp.pendingReferral ? "#22d3a0" : "#ff8c42", color: isExpired ? "#9ba3cc" : "#fff", fontFamily: "var(--font-sora)", cursor: disabled ? "not-allowed" : "pointer" }}>
                  {applying === opp._id ? "Submitting…" : hasApplied ? `✓ ${opp.myApplication?.status?.replace("_", " ") ?? "Applied"}` : isSeedPreview ? "Preview Only" : isExpired ? "Applications Closed" : opp.pendingReferral ? "Accept Referral →" : match?.eligibilityStatus === "borderline" ? "Apply with Reasoning →" : match?.eligibilityStatus === "not_eligible" ? "Request Review →" : "Apply Now →"}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>No opportunities match your filters</p>
            <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>Try adjusting the filters above.</p>
          </div>
        )}
      </div>

      {reviewOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.72)" }}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: "#131626", border: "1px solid rgba(255,140,66,0.25)" }}>
            <h2 className="text-base font-bold mb-1" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Send to review queue</h2>
            <p className="text-sm mb-3" style={{ color: "#9ba3cc" }}>You do not fully match every requirement yet. Explain your related experience, motivation, or why the creator should still consider you.</p>
            <textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} rows={5} placeholder="Example: I have handled similar work in our school org and completed related modules..." style={{ width: "100%", background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8eaff", padding: "10px 12px", outline: "none", resize: "vertical" }} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReviewOpp(null)} className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ color: "#9ba3cc" }}>Cancel</button>
              <button type="button" onClick={() => apply(reviewOpp, reasoning)} disabled={reasoning.trim().length < 8 || applying === reviewOpp._id} className="text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50" style={{ background: "#ff8c42", color: "#fff" }}>Submit for Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <WorkPageInner />
    </Suspense>
  )
}