/**
 * /learnhub/calendar Habit Tracker backend.
 *
 * Each user owns a small set of habit definitions (`learnhub_habits`) and
 * a stream of daily logs (`learnhub_habit_logs`). Logs are idempotent per
 * (userId, habitId, date) — relogging the same day increments `count`
 * instead of inserting duplicates. Date strings are Manila-local
 * (YYYY-MM-DD) to match the streak module's convention.
 *
 * Default habits are auto-seeded on first call to listHabits so a brand
 * new user sees something useful without an empty state.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_HABITS_PER_USER = 8;

function manilaDay(): string {
  const shifted = new Date(Date.now() + MANILA_OFFSET_MS);
  return shifted.toISOString().split("T")[0];
}

const DEFAULT_HABITS: Array<Omit<Doc<"learnhub_habits">, "_id" | "_creationTime" | "userId" | "createdAt" | "archivedAt">> = [
  { slug: "watch_video",   label: "Watch a learning video",   emoji: "▶️", targetPerWeek: 5 },
  { slug: "journal",       label: "Write in journal",         emoji: "📓", targetPerWeek: 5 },
  { slug: "complete_step", label: "Finish a module / lesson", emoji: "✅", targetPerWeek: 3 },
];

async function ensureDefaults(
  ctx: { db: { query: any; insert: any } },
  userId: Id<"learnhub_users">,
): Promise<void> {
  const existing = await ctx.db
    .query("learnhub_habits")
    .withIndex("by_user", (q: { eq: (k: string, v: Id<"learnhub_users">) => unknown }) => q.eq("userId", userId))
    .collect();
  const havenSlugs = new Set(existing.map((h: Doc<"learnhub_habits">) => h.slug));
  // Only seed when the user has NO habits — we don't want to recreate
  // archived defaults silently if the user deleted them on purpose.
  if (existing.length > 0) return;
  for (const h of DEFAULT_HABITS) {
    if (havenSlugs.has(h.slug)) continue;
    await ctx.db.insert("learnhub_habits", {
      userId,
      ...h,
      createdAt: Date.now(),
    });
  }
}

// ── Queries ───────────────────────────────────────────────────────────

export const listHabits = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    // Note: queries can't write, so the auto-seed lives in createHabit /
    // logHabit and a separate seedDefaultsForUser mutation the page
    // calls once on mount.
    const habits = await ctx.db
      .query("learnhub_habits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return habits
      .filter((h) => h.archivedAt === undefined)
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

/**
 * Habit grid for a 7-day window starting at `weekStart` (Manila YYYY-MM-DD).
 * Returns `[{habit, days:[{date,count}…]}]` ready to render as a heatmap.
 */
export const getWeekGrid = query({
  args: {
    userId: v.id("learnhub_users"),
    weekStart: v.string(),
  },
  handler: async (ctx, args) => {
    const habits = await ctx.db
      .query("learnhub_habits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const active = habits.filter((h) => h.archivedAt === undefined);

    const weekDates: string[] = [];
    const start = new Date(args.weekStart + "T00:00:00+08:00");
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      weekDates.push(d.toISOString().split("T")[0]);
    }

    // Single index range scan per user — efficient even for power users.
    const logs = await ctx.db
      .query("learnhub_habit_logs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId)
          .gte("date", weekDates[0])
          .lte("date", weekDates[6]),
      )
      .collect();
    const byKey = new Map<string, number>();
    for (const l of logs) {
      byKey.set(`${l.habitId}|${l.date}`, l.count);
    }

    return {
      weekDates,
      rows: active.map((h) => ({
        habit: {
          id: h._id,
          slug: h.slug,
          label: h.label,
          emoji: h.emoji,
          targetPerWeek: h.targetPerWeek,
        },
        days: weekDates.map((d) => ({
          date: d,
          count: byKey.get(`${h._id}|${d}`) ?? 0,
        })),
      })),
    };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────

export const seedDefaultsForUser = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    await ensureDefaults(ctx, args.userId);
    return { ok: true };
  },
});

export const createHabit = mutation({
  args: {
    userId: v.id("learnhub_users"),
    slug: v.optional(v.string()),
    label: v.string(),
    emoji: v.optional(v.string()),
    targetPerWeek: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const label = args.label.trim().slice(0, 60);
    if (!label) throw new Error("Habit label is required");

    const existing = await ctx.db
      .query("learnhub_habits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const active = existing.filter((h) => h.archivedAt === undefined);
    if (active.length >= MAX_HABITS_PER_USER) {
      throw new Error(`You can have at most ${MAX_HABITS_PER_USER} active habits.`);
    }

    const slug = (args.slug ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""))
      .slice(0, 32) || `habit_${Date.now()}`;

    // Reactivate a soft-archived row of the same slug if present.
    const dup = existing.find((h) => h.slug === slug);
    if (dup) {
      await ctx.db.patch(dup._id, {
        archivedAt: undefined,
        label,
        emoji: args.emoji ?? dup.emoji,
        targetPerWeek: Math.max(1, Math.min(7, args.targetPerWeek ?? dup.targetPerWeek)),
      });
      return dup._id;
    }

    return await ctx.db.insert("learnhub_habits", {
      userId: args.userId,
      slug,
      label,
      emoji: args.emoji ?? "🌱",
      targetPerWeek: Math.max(1, Math.min(7, args.targetPerWeek ?? 5)),
      createdAt: Date.now(),
    });
  },
});

export const archiveHabit = mutation({
  args: { userId: v.id("learnhub_users"), habitId: v.id("learnhub_habits") },
  handler: async (ctx, args) => {
    const h = await ctx.db.get(args.habitId);
    if (!h || h.userId !== args.userId) return;
    await ctx.db.patch(args.habitId, { archivedAt: Date.now() });
  },
});

/**
 * Log (or un-log) a habit for a given Manila-day. Idempotent on
 * (userId, habitId, date): re-calling for the same day increments the
 * count instead of inserting twice. Passing `delta: -1` decrements; when
 * the count reaches 0 the row is deleted so the heatmap goes dark.
 */
export const logHabit = mutation({
  args: {
    userId: v.id("learnhub_users"),
    habitId: v.id("learnhub_habits"),
    date: v.optional(v.string()),
    delta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const h = await ctx.db.get(args.habitId);
    if (!h || h.userId !== args.userId) throw new Error("Habit not found");

    const date = args.date ?? manilaDay();
    const delta = args.delta ?? 1;

    const existing = await ctx.db
      .query("learnhub_habit_logs")
      .withIndex("by_user_habit_date", (q) =>
        q.eq("userId", args.userId).eq("habitId", args.habitId).eq("date", date),
      )
      .unique();

    if (existing) {
      const next = existing.count + delta;
      if (next <= 0) {
        await ctx.db.delete(existing._id);
        return { date, count: 0 };
      }
      await ctx.db.patch(existing._id, { count: next, loggedAt: Date.now() });
      return { date, count: next };
    }
    if (delta <= 0) return { date, count: 0 };
    await ctx.db.insert("learnhub_habit_logs", {
      userId: args.userId,
      habitId: args.habitId,
      date,
      count: delta,
      loggedAt: Date.now(),
    });
    return { date, count: delta };
  },
});
