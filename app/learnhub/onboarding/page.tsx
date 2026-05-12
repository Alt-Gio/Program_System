"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "student" | "mentor" | "org_partner";

interface PendingProfile { googleId: string; email: string; name: string; avatarUrl: string; intendedRole?: Role; }

const ROLES: Array<{ value: Role; label: string; desc: string; emoji: string }> = [
  { value: "student", label: "Student", desc: "I'm enrolled in an ILCDB program (SPARK, DWIA, Project CLICK, Tech4ED)", emoji: "🎓" },
  { value: "mentor", label: "Mentor", desc: "I'm a DICT trainer or facilitator managing a cohort", emoji: "🏫" },
  { value: "org_partner", label: "Org Partner", desc: "My organization posts online work opportunities for ILCDB graduates", emoji: "🏢" },
];

// Initial taxonomy. Stored as plain strings so posts can be tagged with the
// same vocabulary (see learnhub_posts.tags + listFeed* re-rank).
export const INTEREST_TAXONOMY = [
  "Digital Literacy",
  "Python",
  "Data Analysis",
  "Web Dev",
  "Cybersecurity",
  "Project Management",
  "Communication",
  "Career Pivot",
  "AI & ML",
  "UI/UX Design",
  "Public Speaking",
  "Entrepreneurship",
] as const;

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 5;

// Per-role copy for the interest picker. Mentors and partners still pick
// interests so the feed has signal to seed against when their account is new.
const INTEREST_COPY: Record<Role, { title: string; helper: string }> = {
  student: {
    title: "What do you want to learn?",
    helper: "We'll use these to surface the most relevant posts in your feed.",
  },
  mentor: {
    title: "What do you teach or coach on?",
    helper: "We'll match you with mentees and content that fit these topics.",
  },
  org_partner: {
    title: "What roles or skills do you hire for?",
    helper: "We'll surface graduates and posts that match your hiring focus.",
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PendingProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [extra, setExtra] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [connectCalendar, setConnectCalendar] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/learnhub/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.type === "session") router.replace("/learnhub/feed");
        else if (data.type === "pending") {
          setProfile(data.profile);
          setDisplayName(data.profile?.name ?? "");
          if (data.profile?.intendedRole) setSelectedRole(data.profile.intendedRole);
        }
        else router.replace("/learnhub/login");
      })
      .catch(() => router.replace("/learnhub/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, tag];
    });
  };

  const handleSubmit = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) { setError("Please tell us what to call you."); return; }
    if (trimmedName.length < 2) { setError("Name is too short."); return; }
    if (!selectedRole) { setError("Please select a role to continue."); return; }
    if (interests.length < MIN_INTERESTS) {
      setError(`Pick at least ${MIN_INTERESTS} interests so we can personalize your feed.`);
      return;
    }
    setSubmitting(true); setError("");
    const body: Record<string, unknown> = {
      role: selectedRole,
      name: trimmedName,
      interests,
    };
    if (selectedRole === "student") body.school = extra;
    else body.organization = extra;

    const res = await fetch("/api/learnhub/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      fetch("/api/learnhub/auth/firebase-token", { method: "POST" }).catch(() => {});
      // If the user opted in to Calendar, hop into the consent flow before
      // landing on the feed. The OAuth callback redirects back to `returnTo`.
      if (connectCalendar) {
        const returnTo = "/learnhub/feed?welcome=1";
        window.location.href = `/api/learnhub/calendar/connect?returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }
      router.push("/learnhub/feed?welcome=1");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#0d0f1a" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#5b6cff", borderTopColor: "transparent" }} />
    </main>
  );

  const interestsValid = interests.length >= MIN_INTERESTS;
  const copy = selectedRole ? INTEREST_COPY[selectedRole] : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#0d0f1a" }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(91,108,255,0.1) 0%, transparent 70%)" }} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl p-8 flex flex-col gap-6" style={{ background: "#131626", border: "1px solid rgba(91,108,255,0.2)" }}>
        <div>
          <p className="text-xs font-medium tracking-widest uppercase mb-1" style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}>Welcome to ILCDB LearnHub</p>
          <h1 className="text-2xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Tell us about yourself</h1>
          {profile && <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>Signed in as <span style={{ color: "#e8eaff" }}>{profile.email}</span></p>}
        </div>

        <div>
          <label htmlFor="lh-onboarding-name" className="block text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>
            What should we call you?
          </label>
          <input
            id="lh-onboarding-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            maxLength={80}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaff" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
          <p className="text-xs mt-2" style={{ color: "#5c6490" }}>
            We pre-filled this from Google — edit it if you'd rather go by a nickname.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {ROLES.map((role) => (
            <button key={role.value} onClick={() => setSelectedRole(role.value)} className="flex items-start gap-4 rounded-xl p-4 text-left transition-all duration-150" style={{ background: selectedRole === role.value ? "rgba(91,108,255,0.12)" : "#1a1d30", border: selectedRole === role.value ? "1.5px solid #5b6cff" : "1.5px solid rgba(255,255,255,0.07)" }}>
              <span className="text-2xl mt-0.5">{role.emoji}</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: selectedRole === role.value ? "#7c8bff" : "#e8eaff", fontFamily: "var(--font-sora)" }}>{role.label}</p>
                <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>{role.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {selectedRole && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>{selectedRole === "student" ? "School / University" : "Organization name"} <span style={{ color: "#5c6490" }}>(optional)</span></label>
            <input type="text" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={selectedRole === "student" ? "e.g. Bicol University" : "e.g. TechCorp Philippines"} className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaff" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")} onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")} />
          </div>
        )}

        {selectedRole && copy && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>
              {copy.title} <span style={{ color: "#5c6490" }}>(pick {MIN_INTERESTS}–{MAX_INTERESTS})</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_TAXONOMY.map((tag) => {
                const active = interests.includes(tag);
                const atCap = !active && interests.length >= MAX_INTERESTS;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    disabled={atCap}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
                    style={{
                      background: active ? "rgba(91,108,255,0.18)" : "#1a1d30",
                      border: active ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#7c8bff" : "#e8eaff",
                      cursor: atCap ? "not-allowed" : "pointer",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: "#5c6490" }}>
              {copy.helper}
            </p>
          </div>
        )}

        {selectedRole && (
          <label
            className="flex items-start gap-3 rounded-xl p-3 cursor-pointer transition-colors"
            style={{
              background: connectCalendar ? "rgba(91,108,255,0.08)" : "#1a1d30",
              border: connectCalendar ? "1px solid rgba(91,108,255,0.45)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <input
              type="checkbox"
              checked={connectCalendar}
              onChange={(e) => setConnectCalendar(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: "#5b6cff" }}
            />
            <span className="text-sm" style={{ color: "#e8eaff", lineHeight: 1.45 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                📅 Connect my Google Calendar
              </span>
              <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#9ba3cc" }}>
                See and create real Calendar events with Meet links right inside LearnHub.
                You can skip this and connect later from Settings.
              </span>
            </span>
          </label>
        )}

        {error && <p className="text-sm" style={{ color: "#ff5f6d" }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!selectedRole || submitting || !interestsValid || !displayName.trim()}
          className="w-full rounded-xl py-3 font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
        >
          {submitting ? (
            <>
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.45)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block",
                }}
              />
              {connectCalendar ? "Setting up & opening Google…" : "Setting up your account…"}
            </>
          ) : connectCalendar ? (
            "Finish & connect Calendar →"
          ) : (
            "Join LearnHub →"
          )}
        </button>
      </div>
    </main>
  );
}
