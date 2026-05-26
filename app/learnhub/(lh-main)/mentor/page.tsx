"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDistanceToNow, format } from "date-fns";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { ORG_CONFIG } from "@/lib/learnhub/org-config";
import type { Id } from "@/convex/_generated/dataModel";

type ConvexUserId = Id<"learnhub_users">;

interface SessionInfo { sub: string; email: string; name: string; role: string; }

const PROGRAMS = ORG_CONFIG.programs;

function IssueCertModal({ mentorId, mentorName, onClose, onSuccess }: {
  mentorId: string; mentorName: string; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({ studentEmail: "", studentName: "", courseTitle: "", programType: PROGRAMS[0] ?? "", certType: "learning" as "learning" | "work_completion", sendEmail: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.studentEmail || !form.studentName || !form.courseTitle) { setError("Fill all required fields."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/learnhub/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to issue certificate."); return; }
      onSuccess();
      onClose();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#131626", border: "1px solid rgba(91,108,255,0.25)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Issue Certificate</h2>
          <button onClick={onClose} style={{ color: "#9ba3cc" }}>✕</button>
        </div>
        {[
          { label: "Student Email *", key: "studentEmail", type: "email", placeholder: "student@email.com" },
          { label: "Student Full Name *", key: "studentName", type: "text", placeholder: "Juan dela Cruz" },
          { label: "Course/Module Title *", key: "courseTitle", type: "text", placeholder: "Digital Literacy Fundamentals" },
        ].map((f) => (
          <div key={f.key}>
            <label className="text-xs mb-1.5 block" style={{ color: "#9ba3cc" }}>{f.label}</label>
            <input type={f.type} placeholder={f.placeholder} value={(form as unknown as Record<string, string>)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")} onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "#9ba3cc" }}>Program</label>
            <select value={form.programType} onChange={(e) => setForm((p) => ({ ...p, programType: e.target.value }))} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}>
              {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "#9ba3cc" }}>Type</label>
            <select value={form.certType} onChange={(e) => setForm((p) => ({ ...p, certType: e.target.value as "learning" | "work_completion" }))} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}>
              <option value="learning">Learning</option>
              <option value="work_completion">Work Completion</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm((p) => ({ ...p, sendEmail: e.target.checked }))} className="rounded" />
          <span className="text-sm" style={{ color: "#9ba3cc" }}>Send certificate via email</span>
        </label>
        {error && <p className="text-xs" style={{ color: "#ff5f6d" }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40" style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}>
          {loading ? "Generating Certificate…" : "Issue Certificate 🎓"}
        </button>
        <p className="text-xs text-center" style={{ color: "#5c6490" }}>A PDF will be generated using your Google Slides template and sent to the student&apos;s email.</p>
      </div>
    </div>
  );
}

export default function MentorDashboard() {
  const { userId, session } = useLearnhubSession();
  const [showModal, setShowModal] = useState(false);
  const [issuedCount, setIssuedCount] = useState(0);

  const myPosts = useQuery(api.learnhub_posts.getPostsByAuthor, userId ? { authorId: userId as ConvexUserId, limit: 5 } : "skip");
  const leaderboard = useQuery(api.learnhub_bookmarks.getLeaderboard, { limit: 5 });

  const isMentor = session?.role === "mentor";

  if (!session) {
    return <div className="p-8 text-center" style={{ color: "#9ba3cc" }}>Loading…</div>;
  }

  if (!isMentor) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-lg font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Mentor Access Only</p>
        <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>This dashboard is only accessible to verified {ORG_CONFIG.orgName} mentors and facilitators.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {showModal && <IssueCertModal mentorId={userId!} mentorName={session.name} onClose={() => setShowModal(false)} onSuccess={() => setIssuedCount((c) => c + 1)} />}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wider uppercase mb-1" style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}>Mentor Dashboard</p>
          <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Welcome, {session.name.split(" ")[0]}</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>{ORG_CONFIG.orgName} · {ORG_CONFIG.productName}</p>
          <a href="/learnhub/mentor/profile" className="text-xs font-semibold mt-1 inline-block" style={{ color: "#7c8bff" }}>
            Edit profile →
          </a>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shrink-0" style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}>
          <span>🎓</span> Issue Certificate
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Posts Created", value: myPosts?.length ?? "…", icon: "📝" },
          { label: "Certs Issued Today", value: issuedCount, icon: "🏅" },
          { label: "Top Students", value: leaderboard?.filter((u) => u.role === "student").length ?? "…", icon: "🌟" },
          { label: "Active Learners", value: leaderboard?.length ?? "…", icon: "🔥" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl p-4 flex flex-col gap-1" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xl">{stat.icon}</span>
            <p className="text-2xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{stat.value}</p>
            <p className="text-xs" style={{ color: "#9ba3cc" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <MentorshipInbox mentorId={userId as ConvexUserId} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top learners */}
        <div className="rounded-2xl p-5" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-semibold mb-4" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>🌟 Top Learners</p>
          {leaderboard === undefined && <div className="h-32 rounded-xl animate-pulse" style={{ background: "#1a1d30" }} />}
          <div className="flex flex-col gap-2">
            {leaderboard?.filter((u) => u.role === "student").slice(0, 5).map((u, i) => (
              <div key={u._id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "#1a1d30" }}>
                <span className="text-sm w-5 text-center font-bold" style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : "#cd7f32", fontFamily: "var(--font-sora)" }}>#{i + 1}</span>
                <img src={u.avatarUrl} alt={u.name} width={28} height={28} className="rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`; }} />
                <p className="text-sm flex-1 truncate" style={{ color: "#e8eaff" }}>{u.name}</p>
                <span className="text-xs font-bold" style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}>{u.xpPoints.toLocaleString()} XP</span>
              </div>
            ))}
            {leaderboard?.length === 0 && <p className="text-xs text-center py-4" style={{ color: "#5c6490" }}>No students yet</p>}
          </div>
        </div>

        {/* My recent posts */}
        <div className="rounded-2xl p-5" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>📝 My Recent Posts</p>
            <a href="/learnhub/feed" className="text-xs" style={{ color: "#5b6cff" }}>View feed →</a>
          </div>
          {myPosts === undefined && <div className="h-32 rounded-xl animate-pulse" style={{ background: "#1a1d30" }} />}
          <div className="flex flex-col gap-2">
            {myPosts?.map((post) => (
              <div key={post._id} className="rounded-xl px-3 py-2.5" style={{ background: "#1a1d30" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(91,108,255,0.1)", color: "#7c8bff" }}>{post.type}</span>
                  <span className="text-[10px]" style={{ color: "#5c6490" }}>{formatDistanceToNow(post.createdAt, { addSuffix: true })}</span>
                </div>
                <p className="text-sm line-clamp-1" style={{ color: "#c8caf0" }}>{post.content}</p>
                <p className="text-xs mt-1" style={{ color: "#5c6490" }}>❤ {post.likeCount} · 💬 {post.commentCount}</p>
              </div>
            ))}
            {myPosts?.length === 0 && <p className="text-xs text-center py-4" style={{ color: "#5c6490" }}>No posts yet — go to Feed to create your first post.</p>}
          </div>
        </div>

        {/* Certificate pipeline info */}
        <div className="md:col-span-2 rounded-2xl p-5" style={{ background: "#131626", border: "1px solid rgba(34,211,160,0.2)" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>🔗 Google Forms Auto-Issue Webhook</p>
          <p className="text-sm mb-3" style={{ color: "#9ba3cc" }}>Connect a Google Form&apos;s Apps Script to automatically issue certificates when students complete a program assessment.</p>
          <div className="rounded-xl px-4 py-3 font-mono text-xs overflow-auto" style={{ background: "#0d0f1a", color: "#22d3a0" }}>
            POST {typeof window !== "undefined" ? window.location.origin : "[your-domain]"}/api/learnhub/forms-webhook
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {[
              ["secret", "LH_FORMS_WEBHOOK_SECRET value"],
              ["email", "Student email from form"],
              ["name", "Student name from form"],
              ["courseTitle", "Course/module title"],
              ["programType", "SPARK / DWIA / etc."],
              ["mentorEmail", "Your email (optional)"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <code style={{ color: "#7c8bff" }}>{k}</code>
                <span style={{ color: "#5c6490" }}>— {v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MentorshipInbox({ mentorId }: { mentorId: ConvexUserId }) {
  const requests = useQuery(api.learnhub_mentors.listIncomingRequests, { mentorId });
  const respond = useMutation(api.learnhub_mentors.respondToMentorshipRequest);
  const complete = useMutation(api.learnhub_mentors.completeMentorship);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = (requests ?? []).filter((r) => r.status === "requested");
  const active = (requests ?? []).filter((r) => r.status === "active");

  const handleRespond = async (relId: Id<"learnhub_mentoring_relationships">, decision: "accept" | "decline") => {
    setBusyId(relId);
    setError(null);
    try {
      await respond({ relationshipId: relId, mentorId, decision });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^[A-Z_]+:\s*/, ""));
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (relId: Id<"learnhub_mentoring_relationships">) => {
    setBusyId(relId);
    setError(null);
    try {
      await complete({ relationshipId: relId, callerId: mentorId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^[A-Z_]+:\s*/, ""));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
          🤝 Mentorship Requests
          {pending.length > 0 && (
            <span
              className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: "rgba(249,115,22,0.18)", color: "#f97316" }}
            >
              {pending.length} new
            </span>
          )}
        </p>
        <a href="/learnhub/mentors" className="text-xs" style={{ color: "#5b6cff" }}>View marketplace →</a>
      </div>

      {error && (
        <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {requests === undefined && (
        <div className="h-20 rounded-xl animate-pulse" style={{ background: "#1a1d30" }} />
      )}

      {requests && pending.length === 0 && active.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: "#5c6490" }}>
          No pending requests. Once learners send a request, it'll show up here.
        </p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {pending.map((r) => (
            <div key={r._id} className="rounded-xl p-3" style={{ background: "#1a1d30", border: "1px solid rgba(249,115,22,0.18)" }}>
              <div className="flex items-start gap-3">
                {r.mentee?.avatarUrl && (
                  <img
                    src={r.mentee.avatarUrl}
                    alt={r.mentee.name}
                    width={36}
                    height={36}
                    className="rounded-full object-cover shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.mentee?.name ?? "U")}`;
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
                      {r.mentee?.name ?? "Unknown"}
                    </p>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.18)", color: "#f97316" }}>
                      Pending
                    </span>
                  </div>
                  {r.mentee?.school && (
                    <p className="text-xs mt-0.5" style={{ color: "#5c6490" }}>{r.mentee.school}</p>
                  )}
                  <p className="text-sm mt-2" style={{ color: "#c8caf0", lineHeight: 1.5 }}>{r.requestNote}</p>
                  {r.goals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.goals.map((g) => (
                        <span key={g} className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#6366f1" }}>
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleRespond(r._id, "accept")}
                  disabled={busyId === r._id}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e" }}
                >
                  {busyId === r._id ? "…" : "Accept"}
                </button>
                <button
                  onClick={() => handleRespond(r._id, "decline")}
                  disabled={busyId === r._id}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}
                >
                  {busyId === r._id ? "…" : "Decline"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "#9ba3cc" }}>Active mentees</p>
          <div className="flex flex-col gap-2">
            {active.map((r) => (
              <div key={r._id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#1a1d30", border: "1px solid rgba(34,197,94,0.18)" }}>
                {r.mentee?.avatarUrl && (
                  <img
                    src={r.mentee.avatarUrl}
                    alt={r.mentee.name}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.mentee?.name ?? "U")}`;
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#e8eaff" }}>{r.mentee?.name ?? "Unknown"}</p>
                  <p className="text-[11px]" style={{ color: "#5c6490" }}>
                    Active since {format(r.updatedAt, "MMM d, yyyy")}
                  </p>
                </div>
                <button
                  onClick={() => handleComplete(r._id)}
                  disabled={busyId === r._id}
                  className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ba3cc" }}
                >
                  {busyId === r._id ? "…" : "Mark complete"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
