"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { ArrowLeft, Plus } from "lucide-react";

const ORANGE = "#f97316";
const GREEN = "#10b981";
const SKY = "#0ea5e9";
const PINK = "#ec4899";

export default function OrgOpportunitiesPage() {
  const { userId, role, loading } = useLearnhubSession();
  const summary = useQuery(
    api.learnhub_org.getOrgSummary,
    userId ? { orgId: userId as Id<"learnhub_users"> } : "skip",
  );

  if (loading || summary === undefined) return <div style={{ padding: 24, color: "#fff" }}>Loading job ordersâ€¦</div>;
  if (!userId || (role !== "org_partner" && role !== "coordinator" && role !== "admin")) {
    return (
      <div style={{ padding: 24, color: "#fff" }}>
        Posting management is restricted to Org Partners, Coordinators, and Admins.{" "}
        <Link href="/learnhub/feed" style={{ color: "#5b6cff" }}>â† Back</Link>
      </div>
    );
  }
  if (summary.forbidden) return null;

  return (
    <div style={{ color: "#fff", background: "var(--lh-bg)", minHeight: "100%", padding: "24px 20px", fontFamily: "'Inter', sans-serif" }}>
      <Link href="/learnhub/org" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.6)",
        letterSpacing: 1.2, textTransform: "uppercase",
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
      }}><ArrowLeft size={14} /> Back to Org Console</Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>All job orders</h1>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
            {summary.kpi.openOpportunities} open Â· {summary.kpi.totalApplicants} applicants total
          </p>
        </div>
        <Link href="/learnhub/work/post" style={{
          padding: "8px 14px", borderRadius: 99,
          background: `linear-gradient(135deg, ${ORANGE}, ${PINK})`,
          color: "var(--lh-bg)", fontWeight: 700, fontSize: 12.5,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}><Plus size={14} /> Post a job order</Link>
      </div>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        {summary.opportunities.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            No postings yet. Use the button above to publish your first.
          </div>
        ) : (
          summary.opportunities.map((o) => (
            <div key={o.id as unknown as string} style={{
              display: "grid", gridTemplateColumns: "minmax(220px, 2fr) 110px 100px 110px 130px",
              alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                  {o.workType} Â· {o.payType}
                </div>
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: 99,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase",
                color: o.status === "open" ? GREEN : "rgba(255,255,255,0.5)",
                background: o.status === "open" ? `${GREEN}1c` : "var(--lh-card-3)",
                border: `1px solid ${o.status === "open" ? `${GREEN}55` : "var(--lh-border-strong)"}`,
                width: "fit-content",
              }}>{o.status}</span>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{o.filledSlots ?? 0} / {o.slots}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: SKY, fontWeight: 700 }}>
                {o.applicantCount} applied
              </div>
              <Link href={`/learnhub/work/manage?id=${o.id}`} style={{
                justifySelf: "end", padding: "6px 12px", borderRadius: 8,
                background: "var(--lh-card-3)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 11.5, fontWeight: 600,
              }}>Manage â†’</Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
