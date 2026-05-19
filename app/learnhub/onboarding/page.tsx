"use client";
import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INTEREST_TAXONOMY as SHARED_TAXONOMY,
  INTEREST_CATEGORIES,
  normalizeInterest,
} from "@/lib/learnhub/interests";
import { ORG_CONFIG } from "@/lib/learnhub/org-config";

type Role = "student" | "mentor" | "org_partner";
type SkillLevel = "beginner" | "intermediate" | "advanced";
type Goal = "find_work" | "learn" | "build_portfolio" | "mentor" | "network";
type Hours = "<5" | "5-10" | "10-20" | "20+";

interface PendingProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
  intendedRole?: Role;
}

const ROLES: Array<{ value: Role; label: string; desc: string; emoji: string }> = [
  {
    value: "student",
    label: "Learner",
    desc: "I'm here to learn — any field, any level. I want courses, mentors, and opportunities tuned to me.",
    emoji: "🎓",
  },
  {
    value: "mentor",
    label: "Mentor",
    desc: "I can teach or coach others. I'll be discoverable on the marketplace after a quick verification.",
    emoji: "🏫",
  },
  {
    value: "org_partner",
    label: "Org Partner",
    desc: "My organization posts opportunities, curates content, and supports learners on this hub.",
    emoji: "🏢",
  },
];

// Onboarding taxonomy is the shared one from lib/learnhub/interests so the
// same vocabulary drives onboarding picks, feed ranking, and the composer's
// hashtag suggestions. The const re-export keeps existing call-sites (and any
// imports from this file) working unchanged.
export const INTEREST_TAXONOMY = SHARED_TAXONOMY;

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 5;

// Per-role framing for the interests step. Without this map, the previous
// version threw ReferenceError once a role was selected — that was the
// "application error" new users hit.
const INTEREST_COPY: Record<Role, { title: string; helper: string }> = {
  student: {
    title: "What do you want to learn?",
    helper: "Pick the topics you're most curious about. We'll bubble matching posts, courses, and opportunities to the top of your feed.",
  },
  mentor: {
    title: "What can you teach or coach on?",
    helper: "Your picks help us surface you to learners in those topics — and personalize the questions you'll see in your feed.",
  },
  org_partner: {
    title: "What skills do your future hires need?",
    helper: "We'll personalize your feed around these topics so you see the talent and conversations most relevant to your team.",
  },
};

const GOALS: Array<{ value: Goal; label: string; emoji: string }> = [
  { value: "find_work", label: "Find work", emoji: "💼" },
  { value: "learn", label: "Learn new skills", emoji: "📚" },
  { value: "build_portfolio", label: "Build a portfolio", emoji: "🛠️" },
  { value: "mentor", label: "Mentor others", emoji: "🤝" },
  { value: "network", label: "Network", emoji: "🌐" },
];

const HOURS_OPTIONS: Array<{ value: Hours; label: string }> = [
  { value: "<5", label: "Under 5 hrs/week" },
  { value: "5-10", label: "5–10 hrs/week" },
  { value: "10-20", label: "10–20 hrs/week" },
  { value: "20+", label: "20+ hrs/week" },
];

const SKILL_LEVELS: Array<{ value: SkillLevel; short: string }> = [
  { value: "beginner", short: "Beginner" },
  { value: "intermediate", short: "Intermediate" },
  { value: "advanced", short: "Advanced" },
];

const TOTAL_STEPS = 4;

function OnboardingPageInner() {
  const router = useRouter();
  const [profile, setProfile] = useState<PendingProfile | null>(null);
  const [step, setStep] = useState(1);

  // Step 1 — identity
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Step 2 — location
  const [extra, setExtra] = useState(""); // school OR organization
  const [region, setRegion] = useState("Region V");
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");

  // Step 3 — interests + skill level (curated tags + user-supplied custom tags)
  const [interests, setInterests] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<Record<string, SkillLevel>>({});
  const [customDraft, setCustomDraft] = useState("");

  // Step 4 — goals + hours + calendar
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState<Hours | "">("");
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
        } else router.replace("/learnhub/login");
      })
      .catch(() => router.replace("/learnhub/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const copy = selectedRole ? INTEREST_COPY[selectedRole] : null;

  const toggleInterest = (tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) {
        setSkillLevels((sl) => {
          const next = { ...sl };
          delete next[tag];
          return next;
        });
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= MAX_INTERESTS) return prev;
      setSkillLevels((sl) => ({ ...sl, [tag]: "beginner" }));
      return [...prev, tag];
    });
  };

  const setLevelFor = (tag: string, level: SkillLevel) => {
    setSkillLevels((sl) => ({ ...sl, [tag]: level }));
  };

  // Custom user-supplied interests sit alongside the curated taxonomy.
  // The feed scorer matches by normalised string, so a "Veterinary Medicine"
  // entry here will boost matching #veterinarymedicine posts just like a
  // curated pick would.
  const addCustomInterest = () => {
    const raw = customDraft.trim();
    if (!raw) return;
    if (raw.length > 48) return;
    // Reject if it normalises to the same value as something already picked
    // (case- and punctuation-insensitive dedupe).
    const norm = normalizeInterest(raw);
    if (!norm) return;
    if (interests.some((t) => normalizeInterest(t) === norm)) {
      setCustomDraft("");
      return;
    }
    if (interests.length >= MAX_INTERESTS) return;
    setInterests((prev) => [...prev, raw]);
    setSkillLevels((sl) => ({ ...sl, [raw]: "beginner" }));
    setCustomDraft("");
  };

  const toggleGoal = (g: Goal) => {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const step1Valid = displayName.trim().length >= 2 && !!selectedRole;
  const step3Valid =
    interests.length >= MIN_INTERESTS &&
    interests.length <= MAX_INTERESTS &&
    interests.every((t) => Boolean(skillLevels[t]));
  const step4Valid = goals.length >= 1;

  const canContinue = useMemo(() => {
    if (step === 1) return step1Valid;
    if (step === 2) return true;
    if (step === 3) return step3Valid;
    if (step === 4) return step4Valid;
    return false;
  }, [step, step1Valid, step3Valid, step4Valid]);

  const goNext = () => {
    setError("");
    if (step === 1 && !step1Valid) {
      if (!displayName.trim()) setError("Please tell us what to call you.");
      else if (displayName.trim().length < 2) setError("Name is too short.");
      else if (!selectedRole) setError("Please select a role to continue.");
      return;
    }
    if (step === 3 && !step3Valid) {
      setError(`Pick ${MIN_INTERESTS}–${MAX_INTERESTS} interests so we can personalize your feed.`);
      return;
    }
    if (step === 4 && !step4Valid) {
      setError("Pick at least one goal so we know what to surface.");
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!step1Valid || !step3Valid || !step4Valid || !selectedRole) {
      setError("Please complete every required step before finishing.");
      return;
    }
    setSubmitting(true);
    setError("");

    const trimmedName = displayName.trim();
    const body: Record<string, unknown> = {
      role: selectedRole,
      name: trimmedName,
      interests,
      skillLevels,
      goals,
    };
    if (selectedRole === "student") body.school = extra;
    else body.organization = extra;
    if (hoursPerWeek) body.hoursPerWeek = hoursPerWeek;
    if (region.trim()) body.region = region.trim();
    if (province.trim()) body.province = province.trim();
    if (municipality.trim()) body.municipality = municipality.trim();

    const res = await fetch("/api/learnhub/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      fetch("/api/learnhub/auth/firebase-token", { method: "POST" }).catch(() => {});
      // Hard-navigate so the new session cookie is picked up server-side and
      // the LearnHub layout (which gates on the session) loads with a fresh
      // request. router.push uses the SPA cache and can land on a page that
      // hasn't seen the cookie yet, producing a confusing "no pending profile"
      // bounce.
      const dest = "/learnhub/today?welcome=1";
      if (connectCalendar) {
        window.location.href = `/api/learnhub/calendar/connect?returnTo=${encodeURIComponent(dest)}`;
        return;
      }
      window.location.assign(dest);
      return;
    }

    // Pending cookie expired or otherwise missing → re-auth instead of
    // dead-ending on the error toast. Saves the user's role intent so they
    // come back to the same portal after sign-in.
    if (res.status === 401) {
      const portalForRole: Record<typeof selectedRole & string, string> = {
        student: "/learnhub/login",
        mentor: "/learnhub/login/mentor",
        org_partner: "/learnhub/login",
      };
      const target = portalForRole[selectedRole] ?? "/learnhub/login";
      setError("Your sign-up session expired. Redirecting you to sign in again…");
      setTimeout(() => {
        window.location.href = `${target}?expired=1`;
      }, 1400);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Something went wrong. Please try again.");
    setSubmitting(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#0d0f1a" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#5b6cff", borderTopColor: "transparent" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 sm:py-12" style={{ background: "#0d0f1a" }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(91,108,255,0.1) 0%, transparent 70%)" }} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl p-6 sm:p-8 flex flex-col gap-6" style={{ background: "#131626", border: "1px solid rgba(91,108,255,0.2)" }}>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: n <= step ? "#5b6cff" : "rgba(255,255,255,0.08)" }}
            />
          ))}
          <span className="text-xs ml-2 tabular-nums" style={{ color: "#9ba3cc", fontFamily: "var(--font-sora)" }}>
            {step}/{TOTAL_STEPS}
          </span>
        </div>

        <div>
          <p className="text-xs font-medium tracking-widest uppercase mb-1" style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}>
            Welcome to {ORG_CONFIG.productName}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
            {step === 1 && "Tell us about yourself"}
            {step === 2 && "Where are you based?"}
            {step === 3 && (copy?.title ?? "Pick your interests")}
            {step === 4 && "What are you here for?"}
          </h1>
          {profile && step === 1 && (
            <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>
              Signed in as <span style={{ color: "#e8eaff" }}>{profile.email}</span>
            </p>
          )}
          {step === 2 && (
            <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>
              We'll prioritize opportunities and events near you. Skip any field you don't want to share.
            </p>
          )}
          {step === 3 && copy && (
            <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>{copy.helper}</p>
          )}
          {step === 4 && (
            <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>
              These signals shape what shows up first in your feed.
            </p>
          )}
        </div>

        {step === 1 && (
          <>
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
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  className="flex items-start gap-4 rounded-xl p-4 text-left transition-all duration-150"
                  style={{
                    background: selectedRole === role.value ? "rgba(91,108,255,0.12)" : "#1a1d30",
                    border: selectedRole === role.value ? "1.5px solid #5b6cff" : "1.5px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <span className="text-2xl mt-0.5">{role.emoji}</span>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: selectedRole === role.value ? "#7c8bff" : "#e8eaff", fontFamily: "var(--font-sora)" }}>
                      {role.label}
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>{role.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>
                {selectedRole === "student" ? "School / University" : "Organization name"} <span style={{ color: "#5c6490" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={selectedRole === "student" ? "e.g. Bicol University" : "Your organization"}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaff" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>Region</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Region V"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaff" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>Province</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="e.g. Albay"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaff" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>Municipality / City</label>
              <input
                type="text"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="e.g. Legazpi City"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaff" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <p className="text-xs mb-2" style={{ color: "#5c6490" }}>
                Pick {MIN_INTERESTS}–{MAX_INTERESTS} across any field. Selected: {interests.length}
              </p>
              <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
                {Object.entries(INTEREST_CATEGORIES).map(([cat, tags]) => (
                  <div key={cat}>
                    <p
                      className="text-[10px] uppercase tracking-widest mb-1.5"
                      style={{ color: "#5c6490", fontFamily: "var(--font-sora)" }}
                    >
                      {cat}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
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
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomInterest();
                    }
                  }}
                  placeholder="Don't see your field? Add your own (e.g. Veterinary Medicine)"
                  maxLength={48}
                  className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                  style={{
                    background: "#0d0f1a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e8eaff",
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomInterest}
                  disabled={!customDraft.trim() || interests.length >= MAX_INTERESTS}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40"
                  style={{
                    background: "rgba(91,108,255,0.18)",
                    border: "1px solid rgba(91,108,255,0.5)",
                    color: "#7c8bff",
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {interests.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium" style={{ color: "#9ba3cc" }}>
                  How would you rate yourself in each?
                </p>
                {interests.map((tag) => (
                  <div key={tag} className="rounded-xl p-3" style={{ background: "#1a1d30", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-sm mb-2" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{tag}</p>
                    <div className="flex gap-2">
                      {SKILL_LEVELS.map((lvl) => {
                        const on = skillLevels[tag] === lvl.value;
                        return (
                          <button
                            key={lvl.value}
                            type="button"
                            onClick={() => setLevelFor(tag, lvl.value)}
                            className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all"
                            style={{
                              background: on ? "rgba(91,108,255,0.18)" : "#0d0f1a",
                              border: on ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                              color: on ? "#7c8bff" : "#9ba3cc",
                            }}
                          >
                            {lvl.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>
                What do you want from LearnHub? <span style={{ color: "#5c6490" }}>(pick any)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => {
                  const on = goals.includes(g.value);
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGoal(g.value)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5"
                      style={{
                        background: on ? "rgba(91,108,255,0.18)" : "#1a1d30",
                        border: on ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                        color: on ? "#7c8bff" : "#e8eaff",
                      }}
                    >
                      <span>{g.emoji}</span> {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2" style={{ color: "#9ba3cc" }}>
                How much time can you spend each week? <span style={{ color: "#5c6490" }}>(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {HOURS_OPTIONS.map((h) => {
                  const on = hoursPerWeek === h.value;
                  return (
                    <button
                      key={h.value}
                      type="button"
                      onClick={() => setHoursPerWeek(on ? "" : h.value)}
                      className="rounded-lg px-3 py-2 text-xs font-medium transition-all text-left"
                      style={{
                        background: on ? "rgba(91,108,255,0.18)" : "#1a1d30",
                        border: on ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                        color: on ? "#7c8bff" : "#e8eaff",
                      }}
                    >
                      {h.label}
                    </button>
                  );
                })}
              </div>
            </div>

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
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>📅 Connect my Google Calendar</span>
                <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#9ba3cc" }}>
                  See and create real Calendar events with Meet links right inside LearnHub. You can skip this and connect later from Settings.
                </span>
              </span>
            </label>
          </>
        )}

        {error && (
          <p className="text-sm" style={{ color: "#ff5f6d" }}>{error}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="rounded-xl px-4 py-3 text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: "#1a1d30", color: "#e8eaff", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              ← Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue}
              className="flex-1 rounded-xl py-3 font-semibold text-sm transition-all disabled:opacity-40"
              style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canContinue}
              className="flex-1 rounded-xl py-3 font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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
          )}
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <OnboardingPageInner />
    </Suspense>
  );
}
