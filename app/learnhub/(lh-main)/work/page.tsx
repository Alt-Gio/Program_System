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
const SEED_OPPORTUNITIES = [
  { _id: "w1", orgName: "TechCorp Philippines", title: "Remote IT Support Specialist", description: "Join our helpdesk team providing technical support to corporate clients across Luzon.", workType: "remote" as const, payType: "paid" as const, payAmount: "₱18,000/mo", slots: 3, deadline: Date.now() + 7 * 86400000, duration: "6 months", requiredCertTypes: ["Tech4ED", "SPARK"], status: "open" as const },
  { _id: "w2", orgName: "DILG Bicol Region", title: "Digital Records Management Assistant", description: "Help digitize and manage government records as part of the eGov initiative.", workType: "hybrid" as const, payType: "stipend" as const, payAmount: "₱8,000/mo", slots: 5, deadline: Date.now() + 14 * 86400000, duration: "3 months", requiredCertTypes: ["DWIA"], status: "open" as const },
  { _id: "w3", orgName: "DICT Region V", title: "Training Assistant — Tech4ED", description: "Assist in delivering Tech4ED training sessions to communities in Camarines Sur.", workType: "onsite" as const, payType: "volunteer" as const, payAmount: undefined, slots: 2, deadline: Date.now() + 21 * 86400000, duration: "Per session", requiredCertTypes: ["Tech4ED"], status: "open" as const },
  { _id: "w4", orgName: "Bicol E-Commerce Hub", title: "Social Media Content Creator", description: "Create digital content promoting local businesses and their products online.", workType: "remote" as const, payType: "paid" as const, payAmount: "₱15,000/mo", slots: 1, deadline: Date.now() + 5 * 86400000, duration: "4 months", requiredCertTypes: ["SPARK", "DWIA"], status: "open" as const },
];

const WORK_TYPE = { remote: { label: "Remote", color: "#22d3a0" }, hybrid: { label: "Hybrid", color: "#ff8c42" }, onsite: { label: "On-site", color: "#5b6cff" } };
const PAY_TYPE = { volunteer: { label: "Volunteer", color: "#9ba3cc" }, stipend: { label: "Stipend", color: "#ff8c42" }, paid: { label: "Paid", color: "#22d3a0" } };

type FilterType = "all" | "remote" | "hybrid" | "onsite";
type PayFilter = "all" | "paid" | "stipend" | "volunteer";

type Opportunity = (typeof SEED_OPPORTUNITIES)[0];

function WorkPageInner() {
  const [workFilter, setWorkFilter] = useState<FilterType>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null);
  const { userId, role } = useLearnhubSession();
  const canPost = role === "org_partner" || role === "admin";
  const applyMutation = useMutation(api.learnhub_work.applyForOpportunity);

  const liveOpps = useQuery(api.learnhub_work.listOpenOpportunities, {});
  const source: Opportunity[] = (liveOpps && liveOpps.length > 0 ? liveOpps : SEED_OPPORTUNITIES) as Opportunity[];

  const filtered = source.filter((o: Opportunity) => {
    if (workFilter !== "all" && o.workType !== workFilter) return false;
    if (payFilter !== "all" && o.payType !== payFilter) return false;
    return true;
  });

  const apply = async (id: string) => {
    if (applied.has(id) || applying === id) return;
    setApplying(id);
    setApplied((s) => new Set(Array.from(s).concat(id)));
    try {
      if (userId) {
        await applyMutation({
          opportunityId: id as Id<"learnhub_work_opportunities">,
          studentId: userId as Id<"learnhub_users">,
          actorId: userId as Id<"learnhub_users">,
        });
      }
    } catch {
      setApplied((s) => { const n = new Set(s); n.delete(id); return n; });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Work Opportunities</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>Paid and volunteer positions for ILCDB graduates</p>
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
          const hasApplied = applied.has(opp._id);

          return (
            <div key={opp._id} className="rounded-2xl overflow-hidden" style={{ background: "#131626", border: "1px solid rgba(255,140,66,0.2)" }}>
              <div className="px-5 py-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-base font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{opp.title}</p>
                    <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>{opp.orgName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: pt.color + "20", color: pt.color }}>{pt.label}{opp.payAmount ? ` · ${opp.payAmount}` : ""}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: wt.color + "20", color: wt.color }}>{wt.label}</span>
                  </div>
                </div>

                <p className="text-sm mb-3 leading-relaxed" style={{ color: "#c8caf0" }}>{opp.description}</p>

                {/* Meta row */}
                <div className="flex flex-wrap gap-3 text-xs mb-3" style={{ color: "#9ba3cc" }}>
                  <span>📅 {opp.duration}</span>
                  <span>👥 {opp.slots} slot{opp.slots !== 1 ? "s" : ""} open</span>
                  <span style={{ color: isExpired ? "#ff5f6d" : "#9ba3cc" }}>⏰ {isExpired ? "Closed" : `Apply by ${format(opp.deadline, "MMM d")}`}</span>
                </div>

                {/* Required certs */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {opp.requiredCertTypes.map((c: string) => (
                    <span key={c} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(91,108,255,0.1)", color: "#7c8bff" }}>{c}</span>
                  ))}
                </div>

                <button onClick={() => apply(opp._id)} disabled={isExpired || hasApplied || applying === opp._id} className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50" style={{ background: hasApplied ? "#22d3a0" : isExpired ? "rgba(255,255,255,0.06)" : "#ff8c42", color: isExpired ? "#9ba3cc" : "#fff", fontFamily: "var(--font-sora)", cursor: isExpired || hasApplied ? "not-allowed" : "pointer" }}>
                  {applying === opp._id ? "Applying…" : hasApplied ? "✓ Applied" : isExpired ? "Applications Closed" : "Apply Now →"}
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
