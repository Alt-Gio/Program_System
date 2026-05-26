"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { ORG_CONFIG } from "@/lib/learnhub/org-config";
import { INTEREST_TAXONOMY } from "@/lib/learnhub/interests";
import type { Id } from "@/convex/_generated/dataModel";

const PROGRAMS = ORG_CONFIG.programs;
// Expertise suggestions drawn from the same broad taxonomy used in
// onboarding/settings so admin invites stay aligned with what learners
// actually pick. Trimmed to a manageable list â€” admins can still type
// custom tags via the free-text input below.
const EXPERTISE_OPTIONS = INTEREST_TAXONOMY.slice(0, 16);

// â”€â”€ Invite Form Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InviteModal({ onClose, adminId }: { onClose: () => void; adminId: Id<"learnhub_users"> }) {
  const createInvite = useMutation(api.learnhub_mentors.createInvite);
  const [form, setForm] = useState({
    invitedName: "",
    invitedEmail: "",
    dictDesignation: "",
    regionalOffice: ORG_CONFIG.orgName,
    programs: [] as string[],
    expertiseTags: [] as string[],
    maxMentees: 5,
    personalMessage: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invitedName || !form.invitedEmail) return;
    setLoading(true);
    try {
      const token = crypto.randomUUID();
      await createInvite({
        token,
        ...form,
        invitedBy: adminId,
      });
      // Fire Gmail send via API route
      await fetch("/api/learnhub/admin/invite-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  const FIELD_STYLE: React.CSSProperties = {
    width: "100%",
    background: "var(--lh-card-3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "var(--lh-text)",
    padding: "10px 14px",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "32px 24px" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>âœ‰ï¸</div>
        <h3 style={{ color: "var(--lh-text)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Invite Sent!</h3>
        <p style={{ color: "var(--lh-text-2)", fontSize: 14, marginBottom: 24 }}>
          An invitation has been sent to <strong style={{ color: "var(--lh-text)" }}>{form.invitedEmail}</strong>.
          They have 7 days to accept.
        </p>
        <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 12, background: "#5b6cff", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)", fontSize: 18, fontWeight: 800, margin: 0 }}>
        Invite New Mentor
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 5 }}>Full Name *</label>
          <input required style={FIELD_STYLE} value={form.invitedName} onChange={(e) => setForm((f) => ({ ...f, invitedName: e.target.value }))} placeholder="Juan Dela Cruz" />
        </div>
        <div>
          <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 5 }}>Email Address *</label>
          <input required type="email" style={FIELD_STYLE} value={form.invitedEmail} onChange={(e) => setForm((f) => ({ ...f, invitedEmail: e.target.value }))} placeholder="juan@dict.gov.ph" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 5 }}>DICT Designation *</label>
          <input required style={FIELD_STYLE} value={form.dictDesignation} onChange={(e) => setForm((f) => ({ ...f, dictDesignation: e.target.value }))} placeholder="Project Development Officer II" />
        </div>
        <div>
          <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 5 }}>Regional Office</label>
          <input style={FIELD_STYLE} value={form.regionalOffice} onChange={(e) => setForm((f) => ({ ...f, regionalOffice: e.target.value }))} />
        </div>
      </div>

      <div>
        <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 8 }}>Programs Handling</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PROGRAMS.map((p) => {
            const selected = form.programs.includes(p);
            return (
              <button
                key={p} type="button"
                onClick={() => setForm((f) => ({ ...f, programs: toggle(f.programs, p) }))}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: selected ? "rgba(91,108,255,0.2)" : "var(--lh-card-3)",
                  color: selected ? "#a0acff" : "var(--lh-text-2)",
                  border: `1px solid ${selected ? "#5b6cff" : "var(--lh-border-strong)"}`,
                }}
              >{p}</button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 8 }}>Expertise Areas</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EXPERTISE_OPTIONS.map((ex) => {
            const selected = form.expertiseTags.includes(ex);
            return (
              <button
                key={ex} type="button"
                onClick={() => setForm((f) => ({ ...f, expertiseTags: toggle(f.expertiseTags, ex) }))}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: selected ? "rgba(34,211,160,0.15)" : "var(--lh-card-3)",
                  color: selected ? "#22d3a0" : "var(--lh-text-2)",
                  border: `1px solid ${selected ? "#22d3a0" : "var(--lh-border-strong)"}`,
                }}
              >{ex}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 5 }}>Max Mentees</label>
          <input type="number" min={1} max={50} style={FIELD_STYLE} value={form.maxMentees} onChange={(e) => setForm((f) => ({ ...f, maxMentees: Number(e.target.value) }))} />
        </div>
        <div>
          <label style={{ display: "block", color: "var(--lh-text-2)", fontSize: 12, marginBottom: 5 }}>Personal Message (optional)</label>
          <input style={FIELD_STYLE} value={form.personalMessage} onChange={(e) => setForm((f) => ({ ...f, personalMessage: e.target.value }))} placeholder="Looking forward to having you on board!" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ padding: "10px 20px", borderRadius: 12, background: "var(--lh-border)", color: "var(--lh-text-2)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontWeight: 600 }}>
          Cancel
        </button>
        <button type="submit" disabled={loading} style={{ padding: "10px 20px", borderRadius: 12, background: "#5b6cff", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {loading ? "Sending..." : "Send Invite â†’"}
        </button>
      </div>
    </form>
  );
}

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function AdminMentorsPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const cancelInvite = useMutation(api.learnhub_mentors.cancelInvite);

  const invites = useQuery(api.learnhub_mentors.listInvites, {});
  const activeMentors = useQuery(api.learnhub_mentors.listActiveMentors, {});
  const pendingVerifications = useQuery(api.learnhub_mentors.listPendingVerifications, {});

  const pendingInvites = (invites ?? []).filter((i) => i.status === "pending");

  const { userId } = useLearnhubSession();
  const adminId = userId;

  const TAG_STYLE = (color: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
    background: `${color}20`, color,
  });

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)", fontSize: 20, fontWeight: 800, margin: 0 }}>
            Mentor Management
          </h1>
          <p style={{ color: "var(--lh-text-2)", fontSize: 13, marginTop: 4 }}>
            Invite, verify, and manage {ORG_CONFIG.productName} mentors
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          style={{
            padding: "10px 20px", borderRadius: 12, fontWeight: 700, fontSize: 14,
            background: "#5b6cff", color: "#fff", border: "none", cursor: "pointer",
          }}
        >+ Invite New Mentor</button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
        }}>
          <div style={{
            background: "#0d1025", borderRadius: 20, padding: 28, maxWidth: 620, width: "100%",
            border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh", overflowY: "auto",
          }}>
            {adminId && <InviteModal onClose={() => setShowInviteModal(false)} adminId={adminId} />}
          </div>
        </div>
      )}

      {/* Pending Invites */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: "var(--lh-text-2)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Pending Invites ({pendingInvites.length})
        </h2>
        {pendingInvites.length === 0 && (
          <div style={{ background: "var(--lh-card)", borderRadius: 14, padding: "20px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
            <p style={{ color: "var(--lh-text-2)", fontSize: 14 }}>No pending invites</p>
          </div>
        )}
        {pendingInvites.map((inv) => {
          const daysLeft = Math.max(0, Math.floor((inv.expiresAt - Date.now()) / 86400000));
          return (
            <div key={inv._id} style={{
              background: "var(--lh-card)", borderRadius: 14, padding: "16px 20px", marginBottom: 8,
              border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: "rgba(91,108,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#7c8bff", fontWeight: 800, fontSize: 16, flexShrink: 0,
              }}>
                {inv.invitedName.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "var(--lh-text)", fontWeight: 700, fontSize: 14, margin: 0 }}>{inv.invitedName}</p>
                <p style={{ color: "var(--lh-text-2)", fontSize: 12, margin: "2px 0" }}>{inv.invitedEmail}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {inv.programs.map((p) => (
                    <span key={p} style={TAG_STYLE("#7c8bff")}>{p}</span>
                  ))}
                  <span style={TAG_STYLE(daysLeft <= 2 ? "#ff5f6d" : "var(--lh-text-2)")}>
                    {daysLeft}d left
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--lh-border)", color: "var(--lh-text-2)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                  Resend
                </button>
                <button
                  onClick={() => cancelInvite({ inviteId: inv._id })}
                  style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(255,95,109,0.1)", color: "#ff5f6d", border: "1px solid rgba(255,95,109,0.2)", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Active Mentors */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: "var(--lh-text-2)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Active Mentors ({(activeMentors ?? []).length})
        </h2>
        {(activeMentors ?? []).length === 0 && (
          <div style={{ background: "var(--lh-card)", borderRadius: 14, padding: "20px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
            <p style={{ color: "var(--lh-text-2)", fontSize: 14 }}>No active mentors yet</p>
          </div>
        )}
        {(activeMentors ?? []).map((mentor) => (
          <div key={mentor._id} style={{
            background: "var(--lh-card)", borderRadius: 14, padding: "16px 20px", marginBottom: 8,
            border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 14,
          }}>
            <img
              src={mentor.avatarUrl}
              alt={mentor.name}
              width={40} height={40}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <p style={{ color: "var(--lh-text)", fontWeight: 700, fontSize: 14, margin: 0 }}>{mentor.name}</p>
                {mentor.mentorStatus === "verified" && (
                  <span style={TAG_STYLE("#22d3a0")}>âœ“ Verified</span>
                )}
                {mentor.mentorStatus === "pending_verification" && (
                  <span style={TAG_STYLE("#ff8c42")}>â³ Pending</span>
                )}
              </div>
              <p style={{ color: "var(--lh-text-2)", fontSize: 12, margin: "2px 0" }}>
                {mentor.designation ?? "DICT Trainer"} Â· {(mentor.currentMenteeCount ?? 0)} students
              </p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                {(mentor.expertiseTags ?? []).slice(0, 3).map((t) => (
                  <span key={t} style={TAG_STYLE("#7c8bff")}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(91,108,255,0.1)", color: "#7c8bff", border: "1px solid rgba(91,108,255,0.2)", cursor: "pointer" }}>
                Dashboard
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Pending Verification */}
      {(pendingVerifications ?? []).length > 0 && (
        <section>
          <h2 style={{ color: "var(--lh-text-2)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Pending Verification ({(pendingVerifications ?? []).length})
          </h2>
          {(pendingVerifications ?? []).map((ver) => (
            <div key={ver._id} style={{
              background: "var(--lh-card)", borderRadius: 14, padding: "16px 20px", marginBottom: 8,
              border: "1px solid rgba(255,140,66,0.2)", display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: "var(--lh-text)", fontWeight: 700, fontSize: 14, margin: 0 }}>Mentor ID: {ver.mentorId}</p>
                <p style={{ color: "var(--lh-text-2)", fontSize: 12, margin: "2px 0" }}>
                  Submitted {new Date(ver.submittedAt).toLocaleDateString()}
                  {ver.dictEmployeeId && ` Â· Employee ID: ${ver.dictEmployeeId}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(34,211,160,0.1)", color: "#22d3a0", border: "1px solid rgba(34,211,160,0.2)", cursor: "pointer" }}>
                  Approve
                </button>
                <button style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(255,95,109,0.1)", color: "#ff5f6d", border: "1px solid rgba(255,95,109,0.2)", cursor: "pointer" }}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
