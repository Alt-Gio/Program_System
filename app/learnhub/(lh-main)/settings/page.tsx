"use client";
import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { clearLearnhubSessionCache, useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";
import {
  INTEREST_CATEGORIES,
  normalizeInterest,
} from "@/lib/learnhub/interests";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCALES, type Locale } from "@/lib/i18n/translations";
import InstallAppButton from "@/components/InstallAppButton";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/learnhub/theme";

const FEED_COLUMN_OPTIONS: Array<{ value: number; label: string; sub: string }> = [
  { value: 1, label: "1 column", sub: "Single, full-width cards" },
  { value: 2, label: "2 columns", sub: "Default â€” masonry pair" },
  { value: 3, label: "3 columns", sub: "Denser, more above the fold" },
  { value: 4, label: "4 columns", sub: "Compact â€” best on wide screens" },
];

type ConvexUserId = Parameters<ReturnType<typeof useMutation<typeof api.learnhub_users.updateNotifPrefs>>>[0]["userId"];
type EmailDigest = "daily" | "weekly" | "never";
type SkillLevel = "beginner" | "intermediate" | "advanced";
type Goal = "find_work" | "learn" | "build_portfolio" | "mentor" | "network";
type Hours = "<5" | "5-10" | "10-20" | "20+";

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 5;
const GOALS: Array<{ value: Goal; label: string; emoji: string }> = [
  { value: "find_work", label: "Find work", emoji: "ðŸ’¼" },
  { value: "learn", label: "Learn new skills", emoji: "ðŸ“š" },
  { value: "build_portfolio", label: "Build a portfolio", emoji: "ðŸ› ï¸" },
  { value: "mentor", label: "Mentor others", emoji: "ðŸ¤" },
  { value: "network", label: "Network", emoji: "ðŸŒ" },
];
const HOURS_OPTIONS: Array<{ value: Hours; label: string }> = [
  { value: "<5", label: "Under 5 hrs/week" },
  { value: "5-10", label: "5â€“10 hrs/week" },
  { value: "10-20", label: "10â€“20 hrs/week" },
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
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const [theme, setThemeState] = useState<Theme>("dark");
  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);
  const pickTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  };
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
  const updateFeedColumns = useMutation(api.learnhub_users.updateFeedColumns);

  // Feed-layout preference (number of columns the masonry uses)
  const [feedColumns, setFeedColumns] = useState<number>(2);
  const [feedColsSavedAt, setFeedColsSavedAt] = useState(0);

  // Delete-account flow
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const me = useQuery(
    api.learnhub_users.getUser,
    userId ? { id: userId as Id<"learnhub_users"> } : "skip"
  );

  // Preferences state (hydrated from `me` once it loads)
  const [interests, setInterests] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<Record<string, SkillLevel>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [customDraft, setCustomDraft] = useState("");
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
    const fc = (me as { feedColumns?: number }).feedColumns;
    if (typeof fc === "number" && fc >= 1 && fc <= 4) setFeedColumns(fc);
    setPrefsHydrated(true);
  }, [me, prefsHydrated]);

  const handlePickFeedColumns = async (n: number) => {
    setFeedColumns(n);
    if (!userId) return;
    try {
      await updateFeedColumns({
        userId: userId as Id<"learnhub_users">,
        feedColumns: n,
      });
      setFeedColsSavedAt(Date.now());
    } catch {
      // Non-fatal â€” the feed simply falls back to the default column count.
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/learnhub/auth/delete-account", {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to delete account");
      }
      clearLearnhubSessionCache();
      // Send the user to the login screen â€” their next sign-in will run
      // through onboarding again as a fresh account.
      router.replace("/learnhub/login?deleted=1");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

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
  const addCustomInterest = () => {
    const raw = customDraft.trim();
    if (!raw || raw.length > 48) return;
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
    if (status === "connected") setCalToast("Google Calendar connected âœ“");
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
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--lh-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>{title}</p>
      {children}
    </div>
  );

  const Toggle = ({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm" style={{ color: "var(--lh-text)" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--lh-text-2)" }}>{sub}</p>}
      </div>
      <button onClick={() => onChange(!checked)} className="w-11 h-6 rounded-full relative transition-colors shrink-0" style={{ background: checked ? "#5b6cff" : "var(--lh-border-strong)" }}>
        <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full" style={{ background: "#fff", left: checked ? "calc(100% - 1.375rem)" : "0.125rem" }} />
      </button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>{t("settings.title")}</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--lh-text-2)" }}>{t("settings.subtitle")}</p>
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
        {userId && <StreakCard userId={userId as Id<"learnhub_users">} />}

        <Section title="Your Preferences">
          <p className="text-xs" style={{ color: "var(--lh-text-2)" }}>
            These shape what surfaces first in your feed. Update them anytime.
          </p>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--lh-text-2)" }}>
              Interests <span style={{ color: "var(--lh-text-3)" }}>({MIN_INTERESTS}â€“{MAX_INTERESTS} Â· {interests.length} selected)</span>
            </p>
            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
              {Object.entries(INTEREST_CATEGORIES).map(([cat, tags]) => (
                <div key={cat}>
                  <p
                    className="text-[10px] uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--lh-text-3)" }}
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
                            background: active ? "rgba(91,108,255,0.18)" : "var(--lh-card-3)",
                            border: active ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                            color: active ? "#7c8bff" : "var(--lh-text)",
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
                placeholder="Add a custom interest (e.g. Veterinary Medicine)"
                maxLength={48}
                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--lh-text)",
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
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--lh-text-2)" }}>Skill level</p>
              {interests.map((tag) => (
                <div key={tag} className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs mb-1.5" style={{ color: "var(--lh-text)" }}>{tag}</p>
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
                            color: on ? "#7c8bff" : "var(--lh-text-2)",
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
            <p className="text-xs font-medium mb-2" style={{ color: "var(--lh-text-2)" }}>Goals</p>
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
                      background: on ? "rgba(91,108,255,0.18)" : "var(--lh-card-3)",
                      border: on ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                      color: on ? "#7c8bff" : "var(--lh-text)",
                    }}
                  >
                    <span>{g.emoji}</span> {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--lh-text-2)" }}>Weekly availability</p>
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
                      background: on ? "rgba(91,108,255,0.18)" : "var(--lh-card-3)",
                      border: on ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                      color: on ? "#7c8bff" : "var(--lh-text)",
                    }}
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--lh-text-2)" }}>Location</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Region"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--lh-input-bg)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--lh-text)" }}
              />
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Province"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--lh-input-bg)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--lh-text)" }}
              />
              <input
                type="text"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="Municipality / City"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--lh-input-bg)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--lh-text)" }}
              />
            </div>
          </div>

          <button
            onClick={handleSavePrefs}
            disabled={prefsSaving || !userId || !prefsValid}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
            style={{ background: prefsSaved ? "#22d3a0" : "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
          >
            {prefsSaving ? "Saving…" : prefsSaved ? "Saved âœ“" : "Save Preferences"}
          </button>
          {!prefsValid && interests.length > 0 && (
            <p className="text-xs" style={{ color: "#ff8c42" }}>
              Pick {MIN_INTERESTS}â€“{MAX_INTERESTS} interests with a skill level on each to save.
            </p>
          )}
        </Section>

        <Section title="Integrations">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm" style={{ color: "var(--lh-text)" }}>Google Calendar &amp; Meet</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--lh-text-2)" }}>
                {calCreds === undefined
                  ? "Loading…"
                  : calCreds === null
                  ? "Connect to auto-generate Meet links and see your real calendar."
                  : `Connected Â· ${calCreds.scopes.filter((s) => s.includes("calendar")).length} calendar scopes`}
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
          <p className="text-sm" style={{ color: "var(--lh-text-2)" }}>
            How often would you like a summary email? Daily lands ~7pm PHT; weekly lands Sunday ~5pm PHT.
          </p>
          <div className="flex gap-2 flex-wrap">
            {(["daily", "weekly", "never"] as EmailDigest[]).map((opt) => (
              <button key={opt} onClick={() => setEmailDigest(opt)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize" style={{ background: emailDigest === opt ? "rgba(91,108,255,0.15)" : "var(--lh-card-3)", color: emailDigest === opt ? "#7c8bff" : "var(--lh-text-2)", border: emailDigest === opt ? "1px solid rgba(91,108,255,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                {opt}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Quiet Hours">
          <p className="text-xs" style={{ color: "var(--lh-text-2)" }}>No push notifications will be sent during this window.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "var(--lh-text-3)" }}>From</label>
              <input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "var(--lh-input-bg)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--lh-text)" }} />
            </div>
            <span className="text-sm" style={{ color: "var(--lh-text-3)", marginTop: 16 }}>â†’</span>
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "var(--lh-text-3)" }}>To</label>
              <input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "var(--lh-input-bg)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--lh-text)" }} />
            </div>
          </div>
        </Section>

        <Section title={t("settings.theme.title")}>
          <p className="text-xs" style={{ color: "var(--lh-text-2)" }}>
            {t("settings.theme.sub")}
          </p>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { value: "light", label: t("settings.theme.light"), emoji: "â˜€ï¸" },
                { value: "dark",  label: t("settings.theme.dark"),  emoji: "ðŸŒ™" },
                { value: "system",label: t("settings.theme.system"),emoji: "ðŸ–¥ï¸" },
              ] as Array<{ value: Theme; label: string; emoji: string }>
            ).map((opt) => {
              const on = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pickTheme(opt.value)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2"
                  style={{
                    background: on ? "var(--lh-tint-indigo)" : "var(--lh-card-2)",
                    color: on ? "var(--lh-accent-2)" : "var(--lh-text-2)",
                    border: on ? "1px solid var(--lh-accent-2)" : "1px solid var(--lh-border)",
                  }}
                  aria-pressed={on}
                >
                  <span aria-hidden>{opt.emoji}</span> {opt.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t("settings.language.title")}>
          <p className="text-xs" style={{ color: "var(--lh-text-2)" }}>
            {t("settings.language.sub")}
          </p>
          <div className="flex gap-2 flex-wrap">
            {LOCALES.map((opt) => {
              const on = locale === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLocale(opt.code as Locale)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: on ? "rgba(91,108,255,0.15)" : "var(--lh-card-3)",
                    color: on ? "#7c8bff" : "var(--lh-text-2)",
                    border: on ? "1px solid rgba(91,108,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {opt.native}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t("settings.install.title")}>
          <p className="text-xs" style={{ color: "var(--lh-text-2)" }}>
            {t("settings.install.sub")}
          </p>
          <div>
            <InstallAppButton label={t("btn.install")} variant="primary" />
          </div>
        </Section>

        <Section title="Feed Layout">
          <p className="text-xs" style={{ color: "var(--lh-text-2)" }}>
            How many columns should the For-you feed pack into? Saves
            instantly and applies the next time the feed renders.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FEED_COLUMN_OPTIONS.map((opt) => {
              const on = feedColumns === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePickFeedColumns(opt.value)}
                  className="rounded-xl px-3 py-2.5 text-left transition-all"
                  style={{
                    background: on ? "rgba(91,108,255,0.18)" : "var(--lh-card-3)",
                    border: on ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                    color: on ? "#7c8bff" : "var(--lh-text)",
                  }}
                  aria-pressed={on}
                >
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: on ? "#9ba9ff" : "var(--lh-text-2)" }}>
                    {opt.sub}
                  </p>
                </button>
              );
            })}
          </div>
          {/* Mini preview â€” pure CSS so it shows the actual column behaviour */}
          <div
            style={{
              columnCount: feedColumns,
              columnGap: 8,
              padding: 10,
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
            aria-hidden
          >
            {[60, 90, 70, 110, 80, 100, 75, 95].map((h, i) => (
              <div
                key={i}
                style={{
                  display: "inline-block",
                  width: "100%",
                  height: h,
                  marginBottom: 8,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, rgba(91,108,255,0.25), rgba(91,108,255,0.05))",
                  breakInside: "avoid",
                }}
              />
            ))}
          </div>
          {feedColsSavedAt > 0 && Date.now() - feedColsSavedAt < 2500 && (
            <p className="text-xs" style={{ color: "#22d3a0" }}>Saved âœ“</p>
          )}
        </Section>

        <button onClick={handleSave} disabled={saving || !userId} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40" style={{ background: saved ? "#22d3a0" : "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}>
          {saving ? "Saving…" : saved ? "Saved âœ“" : "Save Changes"}
        </button>

        {/* Admin tools â€” only visible to admin/coordinator roles */}
        {me && (me.role === "admin" || me.role === "coordinator") && (
          <AdminToolsSection actorId={me._id} />
        )}

        {/* Danger zone â€” kept visually distinct so it can't be hit by accident */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-3 mt-2"
          style={{ background: "#1a0f12", border: "1px solid rgba(255,95,109,0.25)" }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "#ff8a93", fontFamily: "var(--font-sora)" }}
          >
            Delete Account
          </p>
          <p className="text-xs" style={{ color: "#d9a0a6" }}>
            Removes your profile, bookmarks, journal, video sessions and
            connected Google credentials. <strong>Posts and comments you
            authored stay on LearnHub</strong> but will appear as
            &ldquo;Unknown User&rdquo;. You can sign up again with the same
            Google account afterwards.
          </p>
          {!confirmDeleteOpen ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={!userId}
              className="self-start text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
              style={{
                background: "rgba(255,95,109,0.12)",
                color: "#ff5f6d",
                border: "1px solid rgba(255,95,109,0.35)",
              }}
            >
              Delete my account…
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: "#d9a0a6" }}>
                Type <code style={{ color: "#ff8a93" }}>DELETE</code> to confirm. This cannot be undone.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--lh-input-bg)",
                  border: "1px solid rgba(255,95,109,0.35)",
                  color: "#fff",
                  fontFamily: "var(--font-sora)",
                  letterSpacing: 1,
                }}
              />
              {deleteError && (
                <p className="text-xs" style={{ color: "#ff5f6d" }}>{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteOpen(false);
                    setConfirmText("");
                    setDeleteError(null);
                  }}
                  className="text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--lh-border)",
                    color: "var(--lh-text)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleting}
                  className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
                  style={{
                    background: "#ff5f6d",
                    color: "#fff",
                    border: "1px solid #ff5f6d",
                  }}
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminToolsSection({ actorId }: { actorId: Id<"learnhub_users"> }) {
  const seedPaths = useMutation(api.learnhub_seed_paths.seedStarterPaths);
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setResult(null);
    try {
      const r = await seedPaths({ actorId });
      setResult(`Created ${r.created} starter paths (${r.skipped} already existed).`);
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 mt-2"
      style={{ background: "rgba(91,108,255,0.06)", border: "1px solid rgba(91,108,255,0.2)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "#7c8bff", fontFamily: "var(--font-sora)" }}>
        Admin tools
      </p>
      <p className="text-xs" style={{ color: "var(--lh-text-2)" }}>
        One-click setup for fresh deployments. Each action is idempotent â€” safe to re-run.
      </p>
      <button
        type="button"
        onClick={handleSeed}
        disabled={seeding}
        className="rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-40"
        style={{ background: "#5b6cff", color: "#fff", alignSelf: "flex-start" }}
      >
        {seeding ? "Seeding…" : "Seed starter learning paths"}
      </button>
      {result && (
        <p className="text-xs" style={{ color: result.startsWith("Error") ? "#fca5a5" : "#22c55e" }}>
          {result}
        </p>
      )}
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

function StreakCard({ userId }: { userId: Id<"learnhub_users"> }) {
  const streak = useQuery(api.learnhub_streaks.getStreak, { userId });
  const buyFreeze = useMutation(api.learnhub_streaks.buyStreakFreeze);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleBuy = async () => {
    setError(null);
    setSuccess(null);
    setBuying(true);
    try {
      const res = await buyFreeze({ userId });
      setSuccess(`Freeze added. You now have ${res.freezesLeft} stashed.`);
      setTimeout(() => setSuccess(null), 3500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^[A-Z_]+:\s*/, ""));
    } finally {
      setBuying(false);
    }
  };

  if (streak === undefined) {
    return (
      <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--lh-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>ðŸ”¥ Streak</p>
        <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--lh-card-2)" }} />
      </div>
    );
  }
  if (streak === null) return null;

  const canBuy = streak.streakFreezesAvailable < streak.maxFreezes && streak.xpPoints >= streak.freezeCostXp;
  const atMax = streak.streakFreezesAvailable >= streak.maxFreezes;
  const notEnoughXp = streak.xpPoints < streak.freezeCostXp;

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--lh-card)", border: "1px solid rgba(249,115,22,0.18)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>ðŸ”¥ Streak</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--lh-text-2)" }}>
            Visit LearnHub daily to keep your streak going. Missed days burn through your freezes first.
          </p>
        </div>
        {streak.activeToday && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
            CHECKED IN TODAY
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ background: "var(--lh-card-2)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--lh-text-2)" }}>Current</p>
          <p className="mt-0.5 text-2xl font-bold" style={{ color: "#f97316", fontFamily: "var(--font-sora)" }}>
            {streak.currentStreak}
            <span className="text-xs ml-1" style={{ color: "var(--lh-text-2)" }}>day{streak.currentStreak === 1 ? "" : "s"}</span>
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--lh-card-2)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--lh-text-2)" }}>Longest</p>
          <p className="mt-0.5 text-2xl font-bold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>
            {streak.longestStreak}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--lh-card-2)", border: "1px solid rgba(56,189,248,0.18)" }}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--lh-text-2)" }}>Freezes ðŸ§Š</p>
          <p className="mt-0.5 text-2xl font-bold" style={{ color: "#38bdf8", fontFamily: "var(--font-sora)" }}>
            {streak.streakFreezesAvailable}
            <span className="text-xs ml-1" style={{ color: "var(--lh-text-2)" }}>/ {streak.maxFreezes}</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: "var(--lh-card-2)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--lh-text)" }}>Streak Freeze</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--lh-text-2)" }}>
            Spend {streak.freezeCostXp} XP to protect one missed day. You have {streak.xpPoints} XP.
          </p>
        </div>
        <button
          onClick={handleBuy}
          disabled={buying || !canBuy}
          className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 shrink-0"
          style={{ background: canBuy && !buying ? "linear-gradient(135deg, #38bdf8, #6366f1)" : "var(--lh-card-3)", color: canBuy && !buying ? "#fff" : "var(--lh-text-2)", border: "none" }}
        >
          {buying ? "Buying…" : atMax ? "Max stashed" : notEnoughXp ? `Need ${streak.freezeCostXp - streak.xpPoints} more XP` : `Buy for ${streak.freezeCostXp} XP`}
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: "#ff5f6d" }}>{error}</p>}
      {success && <p className="text-xs" style={{ color: "#22c55e" }}>{success}</p>}
    </div>
  );
}
