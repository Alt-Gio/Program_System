import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── LearnHub Streaks ─────────────────────────────────────────────────────────
//
// Daily-activity streak with a Duolingo-style "Streak Freeze" buffer. A freeze
// is consumed automatically when the user misses a day, preserving the streak.
//
// Design notes:
//   - Date boundaries use Asia/Manila (UTC+8). DICT Region V is in the
//     Philippines; using server-UTC would roll the day at 8am local, which
//     would feel wrong to users.
//   - `recordActivity` is idempotent within a single Manila-day, so it's safe
//     to call on every app load.
//   - XP reward only fires when the streak actually advances — not on resets
//     and not on repeat same-day calls.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const FREEZE_COST_XP = 50;
const MAX_FREEZES = 3;
const STREAK_XP_REWARD = 5;

function todayManila(): string {
  const shifted = new Date(Date.now() + MANILA_OFFSET_MS);
  // ISO yyyy-mm-dd portion from the UTC representation of the shifted moment
  return shifted.toISOString().split("T")[0];
}

// Whole-day delta between two YYYY-MM-DD strings (b - a). Negative if b < a.
function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

export const getStreak = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const u = await ctx.db.get(args.userId);
    if (!u) return null;
    return {
      currentStreak: u.currentStreak ?? 0,
      longestStreak: u.longestStreak ?? 0,
      lastActiveDate: u.lastActiveDate ?? null,
      streakFreezesAvailable: u.streakFreezesAvailable ?? 0,
      xpPoints: u.xpPoints,
      freezeCostXp: FREEZE_COST_XP,
      maxFreezes: MAX_FREEZES,
      todayManila: todayManila(),
      activeToday: u.lastActiveDate === todayManila(),
    };
  },
});

// Idempotent daily check-in. Returns a small report so the client can show
// a toast when something interesting happened (streak up, freeze used, reset).
export const recordActivity = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const u = await ctx.db.get(args.userId);
    if (!u) throw new Error("User not found");

    const today = todayManila();
    if (u.lastActiveDate === today) {
      return {
        changed: false,
        outcome: "already_active" as const,
        currentStreak: u.currentStreak,
        freezesLeft: u.streakFreezesAvailable ?? 0,
        message: "Already checked in today.",
      };
    }

    const freezesAvail = u.streakFreezesAvailable ?? 0;
    let newStreak: number;
    let freezesUsed = 0;
    let freezesLeft = freezesAvail;
    let outcome: "started" | "advanced" | "frozen" | "reset";
    let message: string;

    if (!u.lastActiveDate) {
      newStreak = 1;
      outcome = "started";
      message = "Streak started — welcome!";
    } else {
      const gap = daysBetween(u.lastActiveDate, today);
      if (gap <= 0) {
        // Clock skew or stored date is in the future — treat as same-day no-op
        return {
          changed: false,
          outcome: "already_active" as const,
          currentStreak: u.currentStreak,
          freezesLeft,
          message: "No change.",
        };
      }
      if (gap === 1) {
        newStreak = u.currentStreak + 1;
        outcome = "advanced";
        message = `Day ${newStreak}!`;
      } else {
        const daysMissed = gap - 1;
        if (freezesAvail >= daysMissed) {
          freezesUsed = daysMissed;
          freezesLeft = freezesAvail - daysMissed;
          newStreak = u.currentStreak + 1;
          outcome = "frozen";
          message = `Streak saved — ${freezesUsed} freeze${freezesUsed === 1 ? "" : "s"} used.`;
        } else {
          newStreak = 1;
          outcome = "reset";
          message = `${daysMissed} day${daysMissed === 1 ? "" : "s"} missed — streak reset.`;
        }
      }
    }

    const longest = Math.max(u.longestStreak, newStreak);
    const xpDelta = newStreak > u.currentStreak ? STREAK_XP_REWARD : 0;

    await ctx.db.patch(args.userId, {
      lastActiveDate: today,
      currentStreak: newStreak,
      longestStreak: longest,
      streakFreezesAvailable: freezesLeft,
      xpPoints: u.xpPoints + xpDelta,
    });

    return {
      changed: true,
      outcome,
      currentStreak: newStreak,
      longestStreak: longest,
      freezesUsed,
      freezesLeft,
      xpAwarded: xpDelta,
      message,
    };
  },
});

// Spend XP for a freeze, up to MAX_FREEZES stashed. Errors are thrown with a
// code prefix so the UI can show them without leaking implementation detail.
export const buyStreakFreeze = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const u = await ctx.db.get(args.userId);
    if (!u) throw new Error("User not found");

    const freezesAvail = u.streakFreezesAvailable ?? 0;
    if (freezesAvail >= MAX_FREEZES) {
      throw new Error(
        `AT_MAX: you already have ${MAX_FREEZES} freezes (the limit).`,
      );
    }
    if (u.xpPoints < FREEZE_COST_XP) {
      throw new Error(
        `INSUFFICIENT_XP: you need ${FREEZE_COST_XP} XP, you have ${u.xpPoints}.`,
      );
    }

    await ctx.db.patch(args.userId, {
      xpPoints: u.xpPoints - FREEZE_COST_XP,
      streakFreezesAvailable: freezesAvail + 1,
    });

    return {
      ok: true,
      freezesLeft: freezesAvail + 1,
      xpLeft: u.xpPoints - FREEZE_COST_XP,
    };
  },
});
