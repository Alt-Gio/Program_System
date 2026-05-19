"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { ArrowLeft } from "lucide-react";

export default function OrgCohortsPage() {
  const { userId, role, loading } = useLearnhubSession();
  const summary = useQuery(
    api.learnhub_org.getOrgSummary,
    userId ? { orgId: userId as Id<"learnhub_users"> } : "skip",
  );

  if (loading || summary === undefined) return <div style={{ padding: 24, color: "#fff" }}>Loading cohorts…</div>;
  if (!userId || (role !== "org_partner" && role !== "coordinator" && role !== "admin")) {
    return (
      <div style={{ padding: 24, color: "#fff" }}>
        Cohort view is restricted to Org Partners, Coordinators, and Admins.{" "}
        <Link href="/learnhub/feed" style={{ color: "#5b6cff" }}>← Back</Link>
      </div>
    );
  }
  if (summary.forbidden) return null;

  return (
    <div style={{ color: "#fff", background: "#06060f", minHeight: "100%", padding: "24px 20px", fontFamily: "'Inter', sans-serif" }}>
      <Link href="/learnhub/org" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.6)",
        letterSpacing: 1.2, textTransform: "uppercase",
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
      }}><ArrowLeft size={14} /> Back to Org Console</Link>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Cohorts in your view</h1>
      <p style={{ margin: "4px 0 18px", color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
        Active groups (batches + program cohorts) you can target with job orders.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {summary.cohorts.map((c) => (
          <div key={c.id as unknown as string} style={{
            padding: "16px 18px", borderRadius: 16,
            background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              letterSpacing: 1.4, textTransform: "uppercase", color: "#0ea5e9", marginBottom: 6 }}>
              {c.type}{c.programType ? ` · ${c.programType}` : ""}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
              display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>
              {c.description}
            </p>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              <span>👥 {c.memberCount} members</span>
              <span>Created {new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
