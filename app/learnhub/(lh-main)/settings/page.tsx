"use client";
import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";
import { INTEREST_TAXONOMY } from "@/app/learnhub/onboarding/page";

type ConvexUserId = Parameters<ReturnType<typeof useMutation<typeof api.learnhub_users.updateNotifPrefs>>>[0]["userId"];
type EmailDigest = "daily" | "weekly" | "never";
type SkillLevel = "beginner" | "intermediate" | "advanced";
type Goal = "find_work" | "learn" | "build_portfolio" | "mentor" | "network";
type Hours = "<5" | "5-10" | "10-20" | "20+";

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 5;
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

function SettingsPageInner() {
  const { userId } = useLearnhubSession();
  const sp = useSearchParams();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailDigest, setEmailDigest] = useState<EmailDigest>("weekly");
  const [quietFrom, setQuietFrom] = useState("");
  const [quietTo, setQuietTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [calToast, setCalToast] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const updatePrefs = useMutation(api.learnhub_users.updateNotifPrefs);
  const updateProfile = useMutation(api.learnhub_users.updateProfile);

  const me = useQuery(
    api.learnhub_users.getUser,
    userId ? { id: userId as Id<"learnhub_users"> } : "skip"
  );

  // Preferences state (hydrated from `me` once it loads)
  const [interests, setInterests] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<Record<string, SkillLevel>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState<Hours | "">("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    if (!me || prefsHydrated) return;
    setInterests(Array.isArray(me.interests) ? me.interests : []);
    setSkillLevels(((me.skillLevels ?? {}) as Record<string, SkillLevel>));
    setGoals(Array.isArray(me.goals) ? (me.goals as Goal[]) : []);
    setHoursPerWeek(((me.hoursPerWeek as Hours | undefined) ?? "") as Hours | "");
    setRegion(me.region ?? "");
    setProvince(me.province ?? "");
    setMunicipality(me.municipality ?? "");
    setPrefsHydrated(true);
  }, [me, prefsHydrated]);

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
  const toggleGoal = (g: Goal) => {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };
  const prefsValid = useMemo(
    () =>
      interests.length >= MIN_INTERESTS &&
      interests.length <= MAX_INTERESTS &&
      interests.every((t) => Boolean(skillLevels[t])),
    [interests, skillLevels],
  );

  const handleSavePrefs = async () => {
    if (!userId || !prefsValid) return;
    setPrefsSaving(true);
    try {
      // Strip skillLevels entries for tags no longer selected (UI already
      // does this on toggle, but be defensive on save).
      const cleanLevels: Record<string, SkillLevel> = {};
      for (const tag of interests) {
        const lvl = skillLevels[tag];
        if (lvl === "beginner" || lvl === "intermediate" || lvl === "advanced") {
          cleanLevels[tag] = lvl;
        }
      }
      await updateProfile({
        id: userId as Id<"learnhub_users">,
        interests,
        skillLevels: cleanLevels,
        goals,
        hoursPerWeek: hoursPerWeek || undefined,
        region: region.trim() || undefined,
        province: province.trim() || undefined,
        municipality: municipality.trim() || undefined,
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } finally {
      setPrefsSaving(false);
    }
  };

  const calCreds = useQuery(
    api.learnhub_google_credentials.getForUser,
    userId ? { userId: userId as Id<"learnhub_users"> } : "skip"
  );

  // Toast on round-trip from /api/learnhub/calendar/connect/callback
  useEffect(() => {
    const status = sp.get("calendar");
    if (status === "connected") setCalToast("Google Calendar connected ✓");
    else if (status === "error") setCalToast(`Connect failed: ${sp.get("reason") ?? "unknown"}`);
    if (status) {
      const t = setTimeout(() => setCalToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [sp]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/learnhub/calendar/disconnect", { method: "POST" });
      setCalToast("Google Calendar disconnected");
      setTimeout(() => setCalToast(null), 4000);
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    setPushSupported("Notification" in window && "serviceWorker" in navigator);
  }, []);

  const requestPushPermission = async () => {
    if (!pushSupported) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setPushEnabled(true);
      fetch("/api/learnhub/auth/firebase-token", { method: "POST" }).catch(() => {});
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await updatePrefs({
        userId: userId as ConvexUserId,
        pushEnabled,
        emailDigest,
        quietHoursFrom: quietFrom || undefined,
        quietHoursTo: quietTo || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{title}</p>
      {children}
    </div>
  );

  const Toggle = ({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm" style={{ color: "#e8eaff" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>{sub}</p>}
      </div>
      <button onClick={() => onChange(!checked)} className="w-11 h-6 rounded-full relative transition-colors shrink-0" style={{ background: checked ? "#5b6cff" : "rgba(255,255,255,0.12)" }}>
        <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full" style={{ background: "#fff", left: checked ? "calc(100% - 1.375rem)" : "0.125rem" }} />
      </button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>Manage your LearnHub preferences</p>
      </div>

      {calToast && (
        <div
          className="rounded-xl px-4 py-2 mb-4 text-sm"
          style={{
            background: calToast.startsWith("Connect failed") ? "rgba(255,95,109,0.1)" : "rgba(34,211,160,0.1)",
            color: calToast.startsWith("Connect failed") ? "#ff5f6d" : "#22d3a0",
            border: `1px solid ${calToast.startsWith("Connect failed") ? "rgba(255,95,109,0.3)" : "rgba(34,211,160,0.3)"}`,
          }}
        >
          {calToast}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Section title="Your Preferences">
          <p className="text-xs" style={{ color: "#9ba3cc" }}>
            These shape what surfaces first in your feed. Update them anytime.
          </p>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "#9ba3cc" }}>
              Interests <span style={{ color: "#5c6490" }}>({MIN_INTERESTS}–{MAX_INTERESTS} · {interests.length} selected)</span>
            </p>
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
                      background: active ? "rgba(91,108,255,0.18)" : "rgba(255,255,255,0.04)",
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

          {interests.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium" style={{ color: "#9ba3cc" }}>Skill level</p>
              {interests.map((tag) => (
                <div key={tag} className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs mb-1.5" style={{ color: "#e8eaff" }}>{tag}</p>
                  <div className="flex gap-1.5">
                    {SKILL_LEVELS.map((lvl) => {
                      const on = skillLevels[tag] === lvl.value;
                      return (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => setSkillLevels((sl) => ({ ...sl, [tag]: lvl.value }))}
                          className="flex-1 rounded-md px-2 py-1 text-xs transition-all"
                          style={{
                            background: on ? "rgba(91,108,255,0.18)" : "rgba(0,0,0,0.25)",
                            border: on ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.06)",
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

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "#9ba3cc" }}>Goals</p>
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
                      background: on ? "rgba(91,108,255,0.18)" : "rgba(255,255,255,0.04)",
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
            <p className="text-xs font-medium mb-2" style={{ color: "#9ba3cc" }}>Weekly availability</p>
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
                      background: on ? "rgba(91,108,255,0.18)" : "rgba(255,255,255,0.04)",
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

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "#9ba3cc" }}>Location</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Region"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}
              />
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Province"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}
              />
              <input
                type="text"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="Municipality / City"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}
              />
            </div>
          </div>

          <button
            onClick={handleSavePrefs}
            disabled={prefsSaving || !userId || !prefsValid}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
            style={{ background: prefsSaved ? "#22d3a0" : "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
          >
            {prefsSaving ? "Saving…" : prefsSaved ? "Saved ✓" : "Save Preferences"}
          </button>
          {!prefsValid && interests.length > 0 && (
            <p className="text-xs" style={{ color: "#ff8c42" }}>
              Pick {MIN_INTERESTS}–{MAX_INTERESTS} interests with a skill level on each to save.
            </p>
          )}
        </Section>

        <Section title="Integrations">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm" style={{ color: "#e8eaff" }}>Google Calendar &amp; Meet</p>
              <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>
                {calCreds === undefined
                  ? "Loading…"
                  : calCreds === null
                  ? "Connect to auto-generate Meet links and see your real calendar."
                  : `Connected · ${calCreds.scopes.filter((s) => s.includes("calendar")).length} calendar scopes`}
              </p>
            </div>
            {calCreds === null ? (
              <a
                href="/api/learnhub/calendar/connect"
                className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
                style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
              >
                Connect
              </a>
            ) : calCreds ? (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0 disabled:opacity-50"
                style={{ background: "rgba(255,95,109,0.1)", color: "#ff5f6d", border: "1px solid rgba(255,95,109,0.3)" }}
              >
                {disconnecting ? "…" : "Disconnect"}
              </button>
            ) : null}
          </div>
        </Section>

        <Section title="Push Notifications">
          <Toggle checked={pushEnabled} onChange={(v) => { if (v) requestPushPermission(); else setPushEnabled(false); }} label="Enable push notifications" sub="Receive alerts for new posts, mentions, and opportunities" />
          {!pushSupported && <p className="text-xs" style={{ color: "#ff8c42" }}>Push notifications are not supported in your browser.</p>}
        </Section>

        <Section title="Email Digest">
          <p className="text-sm" style={{ color: "#9ba3cc" }}>How often would you like a summary email?</p>
          <div className="flex gap-2 flex-wrap">
            {(["daily", "weekly", "never"] as EmailDigest[]).map((opt) => (
              <button key={opt} onClick={() => setEmailDigest(opt)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize" style={{ background: emailDigest === opt ? "rgba(91,108,255,0.15)" : "rgba(255,255,255,0.04)", color: emailDigest === opt ? "#7c8bff" : "#9ba3cc", border: emailDigest === opt ? "1px solid rgba(91,108,255,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                {opt}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Quiet Hours">
          <p className="text-xs" style={{ color: "#9ba3cc" }}>No push notifications will be sent during this window.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "#5c6490" }}>From</label>
              <input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }} />
            </div>
            <span className="text-sm" style={{ color: "#5c6490", marginTop: 16 }}>→</span>
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "#5c6490" }}>To</label>
              <input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }} />
            </div>
          </div>
        </Section>

        <button onClick={handleSave} disabled={saving || !userId} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40" style={{ background: saved ? "#22d3a0" : "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <SettingsPageInner />
    </Suspense>
  )
}
