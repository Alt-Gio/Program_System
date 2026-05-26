"use client";

/**
 * /learnhub/today — the cohesion headline.
 *
 * One screen that pulls from every subsystem (habits, flashcards, journal,
 * learning paths, mentors, feed) so the learner experiences LearnHub as
 * one product. Powered by a single Convex query (`learnhub_today.getDashboard`)
 * so initial paint is one round-trip.
 */

import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { Flame, ArrowRight, BookOpen, Sparkles, GraduationCap } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const ORANGE = "#f97316";
const INDIGO = "#5b6cff";
const GREEN = "#22d3a0";
const AMBER = "#fbbf24";
const SKY = "#38bdf8";

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const { userId, loading } = useLearnhubSession();
  const uid = userId ? (userId as Id<"learnhub_users">) : null;
  const dashboard = useQuery(
    api.learnhub_today.getDashboard,
    uid ? { userId: uid } : "skip",
  );
  const logHabit = useMutation(api.learnhub_habits.logHabit);
  const dismissCalendarPrompt = useMutation(api.learnhub_today.dismissCalendarPrompt);

  if (loading) {
    return <div className="px-4 py-10" style={{ color: "#9ba3cc" }}>Loading…</div>;
  }
  if (!uid) {
    return (
      <div className="px-4 py-10 max-w-md mx-auto text-center" style={{ color: "#e8eaff" }}>
        <p className="text-4xl mb-3">👋</p>
        <p className="text-lg font-bold">Sign in to see your day</p>
        <Link href="/learnhub/login" className="text-sm font-semibold mt-3 inline-block" style={{ color: "#7c8bff" }}>
          Sign in →
        </Link>
      </div>
    );
  }
  if (dashboard === undefined) {
    return <div className="px-4 py-10" style={{ color: "#9ba3cc" }}>Pulling your day together…</div>;
  }
  if (dashboard === null) {
    return <div className="px-4 py-10" style={{ color: "#9ba3cc" }}>Couldn't load your dashboard.</div>;
  }

  const firstName = dashboard.user.name.split(" ")[0];

  // Phase 9.C — show calendar banner if not connected AND not dismissed in last 14 days.
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const calendarDismissed =
    dashboard.calendarPromptDismissedAt &&
    Date.now() - dashboard.calendarPromptDismissedAt < FOURTEEN_DAYS_MS;
  const showCalendarBanner = !dashboard.calendarConnected && !calendarDismissed;

  return (
    <div
      className="px-4 py-6 max-w-3xl mx-auto"
      style={{ color: "#e8eaff", fontFamily: "var(--font-dm-sans, 'Inter', sans-serif)" }}
    >
      {/* Phase 9.C — Calendar connect banner */}
      {showCalendarBanner && (
        <div
          className="mb-4 rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(91,108,255,0.15), rgba(34,211,160,0.08))",
            border: "1px solid rgba(91,108,255,0.3)",
          }}
        >
          <span style={{ fontSize: 22 }}>📅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#e8eaff" }}>
              Connect Google Calendar
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>
              See and create real Calendar events with Meet links from inside LearnHub.
            </p>
          </div>
          <a
            href="/api/learnhub/calendar/connect?returnTo=/learnhub/today"
            className="rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap"
            style={{ background: "#5b6cff", color: "#fff", textDecoration: "none" }}
          >
            Connect
          </a>
          <button
            onClick={() => dismissCalendarPrompt({ userId: uid })}
            className="text-xs opacity-50 hover:opacity-100"
            style={{ background: "transparent", border: "none", color: "#9ba3cc", cursor: "pointer" }}
            title="Dismiss for 14 days"
          >
            ✕
          </button>
        </div>
      )}

      {/* Greeting */}
      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}
          >
            Today
          </p>
          <h1
            className="text-2xl font-bold mt-0.5"
            style={{ color: "#e8eaff", fontFamily: "var(--font-sora)", letterSpacing: "-0.02em" }}
          >
            {greeting()}, {firstName} <span aria-hidden>👋</span>
          </h1>
        </div>
        {dashboard.streak.current > 0 && (
          <span
            title="Daily learning streak"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999,
              background: `${ORANGE}1c`, border: `1px solid ${ORANGE}55`, color: ORANGE,
              fontSize: 12, fontWeight: 700,
            }}
          >
            <Flame size={14} /> {dashboard.streak.current}-day streak
          </span>
        )}
      </header>

      {/* Habits today */}
      <Section title="Habits today">
        {dashboard.habitsToday.length === 0 ? (
          <EmptyRow href="/learnhub/calendar" cta="Set up daily habits →">
            No habits yet. Add a few to start a streak.
          </EmptyRow>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dashboard.habitsToday.map((h) => (
              <button
                key={h.id}
                onClick={() =>
                  logHabit({
                    userId: uid,
                    habitId: h.id as Id<"learnhub_habits">,
                    date: dashboard.today,
                    delta: 1,
                  })
                }
                className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors"
                style={{
                  background: h.countToday > 0 ? "rgba(34,211,160,0.14)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${h.countToday > 0 ? GREEN + "55" : "rgba(255,255,255,0.08)"}`,
                  color: h.countToday > 0 ? GREEN : "#e8eaff",
                  cursor: "pointer",
                }}
              >
                <span>{h.emoji}</span>
                <span>{h.label}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(0,0,0,0.3)", color: "#9ba3cc" }}
                >
                  {h.countToday}/{h.targetPerWeek}
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Due flashcards */}
      <Section title="Due flashcards">
        {dashboard.flashcardsDue.count === 0 ? (
          <p className="text-xs" style={{ color: GREEN }}>
            ✓ All caught up. New cards become due as you space them out.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: "#e8eaff" }}>
              <strong>{dashboard.flashcardsDue.count}</strong> due — keep your spaced-repetition streak alive.
            </p>
            <div className="flex flex-col gap-1.5">
              {dashboard.flashcardsDue.previews.map((p) => (
                <div
                  key={p.id}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(13,15,26,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {p.front}
                </div>
              ))}
            </div>
            {dashboard.flashcardsDue.firstDueSessionId && (
              <Link
                href={`/learnhub/video-flow?session=${encodeURIComponent(dashboard.flashcardsDue.firstDueSessionId)}&tab=flashcards`}
                className="self-start mt-1 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: `linear-gradient(135deg, ${ORANGE}, #ef4444)`, color: "#fff" }}
              >
                Review now →
              </Link>
            )}
          </div>
        )}
      </Section>

      {/* Today's prompt */}
      {dashboard.prompt && (
        <Section title="Today's reflection prompt">
          <p className="text-sm italic" style={{ color: "#e8eaff", lineHeight: 1.5 }}>
            "{dashboard.prompt.text}"
          </p>
          <Link
            href={`/learnhub/journal?prompt=${encodeURIComponent(dashboard.prompt.slug)}`}
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold px-3 py-1.5 rounded-full self-start"
            style={{ background: `${INDIGO}22`, border: `1px solid ${INDIGO}55`, color: "#7c8bff" }}
          >
            <BookOpen size={12} /> Open journal
          </Link>
        </Section>
      )}

      {/* Continue learning */}
      <Section title="Continue learning">
        {dashboard.continueLearning ? (
          <Link
            href={`/learnhub/learning-path`}
            className="block rounded-xl px-4 py-3"
            style={{ background: "rgba(91,108,255,0.06)", border: "1px solid rgba(91,108,255,0.25)", textDecoration: "none" }}
          >
            <div className="flex items-center gap-3">
              <GraduationCap size={18} color={INDIGO} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "#e8eaff" }}>
                  {dashboard.continueLearning.pathTitle}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>
                  {dashboard.continueLearning.completedModules}/{dashboard.continueLearning.totalModules} modules complete
                </p>
              </div>
              <ArrowRight size={16} color="#9ba3cc" />
            </div>
          </Link>
        ) : (
          <EmptyRow href="/learnhub/learning-path" cta="Browse paths →">
            Not enrolled in any path yet.
          </EmptyRow>
        )}
      </Section>

      {/* Recommended mentors */}
      {dashboard.recommendedMentors.length > 0 && (
        <Section title="Recommended mentors">
          <div className="flex flex-col gap-2">
            {dashboard.recommendedMentors.map((m) => (
              <Link
                key={m.id}
                href="/learnhub/mentors"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  textDecoration: "none",
                }}
              >
                <img
                  src={m.avatarUrl}
                  alt={m.name}
                  width={36}
                  height={36}
                  className="rounded-full object-cover"
                  style={{ background: "#1a1d30" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "#e8eaff" }}>
                    {m.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "#9ba3cc" }}>
                    {m.designation ?? "Mentor"} · {m.overlap} matching interest{m.overlap === 1 ? "" : "s"}
                  </p>
                </div>
                <Sparkles size={14} color={AMBER} />
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Fresh in feed */}
      <Section title="Fresh in your feed">
        {dashboard.freshPosts.length === 0 ? (
          <EmptyRow href="/learnhub/feed" cta="Open feed →">
            Nothing new yet. The community will surface here as posts come in.
          </EmptyRow>
        ) : (
          <div className="flex flex-col gap-2">
            {dashboard.freshPosts.map((p) => (
              <Link
                key={p.id}
                href="/learnhub/feed"
                className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  textDecoration: "none",
                }}
              >
                <img
                  src={p.authorAvatar}
                  alt={p.authorName}
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                  style={{ background: "#1a1d30" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.authorName)}`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: "#e8eaff" }}>
                    {p.authorName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9ba3cc", lineHeight: 1.4 }}>
                    {p.content}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2
        className="text-[11px] uppercase tracking-widest mb-2"
        style={{ color: "#7c8bff", fontFamily: "var(--font-sora)" }}
      >
        {title}
      </h2>
      <div
        className="p-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyRow({
  children,
  href,
  cta,
}: {
  children: React.ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-xs" style={{ color: "#9ba3cc" }}>
        {children}
      </span>
      <Link href={href} className="text-xs font-semibold" style={{ color: "#7c8bff" }}>
        {cta}
      </Link>
    </div>
  );
}
