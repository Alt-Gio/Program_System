"use client";

/**
 * Org Partner / Coordinator — full mentor-verification queue.
 * Deep-linked from the dashboard's "Review all" link.
 */

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { initialsAvatar } from "@/lib/learnhub/avatar";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

const GREEN = "#10b981";

export default function OrgMentorsPage() {
  const { userId, role, loading } = useLearnhubSession();
  const summary = useQuery(
    api.learnhub_org.getOrgSummary,
    userId ? { orgId: userId as Id<"learnhub_users"> } : "skip",
  );
  const approve = useMutation(api.learnhub_org.verifyMentorApprove);
  const reject = useMutation(api.learnhub_org.verifyMentorReject);
  const [busy, setBusy] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Record<string, "approved" | "rejected">>({});

  if (loading || summary === undefined) {
    return <div style={{ padding: 24, color: "#fff" }}>Loading mentor queue…</div>;
  }
  if (!userId || (role !== "org_partner" && role !== "coordinator" && role !== "admin")) {
    return (
      <div style={{ padding: 24, color: "#fff" }}>
        Mentor verification is restricted to Org Partners, Coordinators, and Admins.{" "}
        <Link href="/learnhub/feed" style={{ color: "#5b6cff", marginLeft: 8 }}>← Back</Link>
      </div>
    );
  }
  if (summary.forbidden) return null;

  const items = summary.pendingMentors;
  return (
    <div style={{ color: "#fff", background: "#06060f", minHeight: "100%", padding: "24px 20px", fontFamily: "'Inter', sans-serif" }}>
      <Link href="/learnhub/org" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: "rgba(255,255,255,0.6)", letterSpacing: 1.2, textTransform: "uppercase",
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
      }}><ArrowLeft size={14} /> Back to Org Console</Link>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Mentor verification queue</h1>
      <p style={{ margin: "4px 0 18px", color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
        {items.length === 0 ? "No mentors are pending verification right now." : `${items.length} mentor${items.length === 1 ? "" : "s"} awaiting your review.`}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((p) => {
          if (!p.mentor) return null;
          const mentor = p.mentor;
          const status = doneIds[p.verificationId as unknown as string];
          return (
            <div key={p.verificationId as unknown as string} style={{
              display: "flex", gap: 14, padding: "16px 18px", borderRadius: 14,
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
              opacity: status ? 0.7 : 1,
            }}>
              <img src={mentor.avatarUrl || initialsAvatar(mentor.name)} alt="" style={{
                width: 50, height: 50, borderRadius: "50%", objectFit: "cover",
                border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0,
              }} onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = initialsAvatar(mentor.name);
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{mentor.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                  {(p.designation ?? mentor.designation) || "Mentor"}
                  {mentor.regionalOffice ? ` · ${mentor.regionalOffice}` : ""}
                </div>
                {mentor.expertiseTags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {mentor.expertiseTags.map((tag) => (
                      <span key={tag} style={{ padding: "2px 8px", borderRadius: 99,
                        background: "rgba(91,108,255,0.12)", border: "1px solid rgba(91,108,255,0.3)",
                        color: "#9ba9ff", fontSize: 10.5 }}>{tag}</span>
                    ))}
                  </div>
                )}
                {p.verificationDocUrl && (
                  <a href={p.verificationDocUrl} target="_blank" rel="noopener" style={{
                    display: "inline-block", marginTop: 8, fontSize: 11.5, color: "#0ea5e9", textDecoration: "underline",
                  }}>View verification document →</a>
                )}
              </div>
              {status ? (
                <span style={{ alignSelf: "center", color: status === "approved" ? GREEN : "#ef4444", fontWeight: 700, fontSize: 13 }}>
                  {status === "approved" ? "Approved ✓" : "Rejected ✕"}
                </span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignSelf: "center" }}>
                  <button type="button" disabled={!!busy} onClick={async () => {
                    setBusy(p.verificationId as unknown as string);
                    try {
                      await approve({ actorId: userId as Id<"learnhub_users">, verificationId: p.verificationId });
                      setDoneIds((d) => ({ ...d, [p.verificationId as unknown as string]: "approved" }));
                    } finally { setBusy(null); }
                  }} style={{
                    padding: "8px 14px", borderRadius: 10,
                    background: `linear-gradient(135deg, ${GREEN}, #06b6d4)`, color: "#06060f", border: 0,
                    fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center", cursor: busy ? "wait" : "pointer",
                  }}><CheckCircle2 size={14} /> Approve</button>
                  <button type="button" disabled={!!busy} onClick={async () => {
                    setBusy(p.verificationId as unknown as string);
                    try {
                      await reject({ actorId: userId as Id<"learnhub_users">, verificationId: p.verificationId, reason: "Not eligible at this time." });
                      setDoneIds((d) => ({ ...d, [p.verificationId as unknown as string]: "rejected" }));
                    } finally { setBusy(null); }
                  }} style={{
                    padding: "8px 14px", borderRadius: 10,
                    background: "rgba(239,68,68,0.12)", color: "#ff5f6d", border: "1px solid rgba(239,68,68,0.4)",
                    fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center", cursor: busy ? "wait" : "pointer",
                  }}><XCircle size={14} /> Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
