import { mutation, query, internalQuery, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { crossedLevelBoundary } from "../lib/learnhub/levels";

const XP_SOURCE = v.union(
  v.literal("daily_login"),
  v.literal("work_completion"),
  v.literal("journal_habit"),
  v.literal("flow_session"),
  v.literal("video_completion"),
  v.literal("flashcard_review"),
  v.literal("mentor_acceptance"),
  v.literal("module_completion"),
  v.literal("challenge_completion"),
  v.literal("manual")
);

// Daily XP cap per source. video_completion is generous (5 videos/day at 30
// XP each) so engaged learners aren't punished for binge-learning days.
// flashcard_review is small per-event but caps at 50/day so it tops out at
// 10 reviews/day. mentor_acceptance has no functional cap because the
// idempotencyKey on the awarding call (mentorship relationship id) already
// limits it to one award per relationship.
const DAILY_CAPS = {
  daily_login: 10,
  work_completion: 1000,
  journal_habit: 60,
  flow_session: 80,
  video_completion: 150,
  flashcard_review: 50,
  mentor_acceptance: 1000,
  module_completion: 200,
  challenge_completion: 500,
  manual: 500,
} as const;

type XpSource = keyof typeof DAILY_CAPS;

function dateKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export async function awardLearnHubXp(
  ctx: MutationCtx,
  args: {
    userId: Id<"learnhub_users">;
    amount: number;
    reason: string;
    sourceType: XpSource;
    sourceId?: string;
    idempotencyKey: string;
  }
) {
  const amount = Math.max(0, Math.min(1000, Math.round(args.amount)));
  if (amount <= 0) return { awarded: 0, duplicate: false, capped: false };

  const existing = await ctx.db
    .query("learnhub_xp_events")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
    .unique();
  if (existing) return { awarded: 0, duplicate: true, capped: false };

  const today = dateKey();
  const todaysEvents = await ctx.db
    .query("learnhub_xp_events")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", today))
    .collect();
  const earnedFromSource = todaysEvents
    .filter((event) => event.sourceType === args.sourceType)
    .reduce((sum, event) => sum + event.amount, 0);
  const remaining = Math.max(0, DAILY_CAPS[args.sourceType] - earnedFromSource);
  const awarded = Math.min(amount, remaining);
  if (awarded <= 0) return { awarded: 0, duplicate: false, capped: true };

  const user = await ctx.db.get(args.userId);
  if (!user) throw new Error("User not found");

  await ctx.db.insert("learnhub_xp_events", {
    userId: args.userId,
    amount: awarded,
    reason: args.reason,
    sourceType: args.sourceType,
    idempotencyKey: args.idempotencyKey,
    date: today,
    createdAt: Date.now(),
    ...(args.sourceId ? { sourceId: args.sourceId } : {}),
  });

  const nextXp = user.xpPoints + awarded;
  await ctx.db.patch(args.userId, { xpPoints: nextXp });
  const { crossed, newLevel } = crossedLevelBoundary(user.xpPoints, nextXp);
  return {
    awarded,
    duplicate: false,
    capped: awarded < amount,
    levelUp: crossed,
    newLevel: crossed ? newLevel : undefined,
  };
}

export const awardXp = mutation({
  args: {
    userId: v.id("learnhub_users"),
    amount: v.number(),
    reason: v.string(),
    sourceType: XP_SOURCE,
    sourceId: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => awardLearnHubXp(ctx, args),
});

// Internal: cheap check used by the daily streak-at-risk cron. We don't care
// about the count or amounts — only whether the user logged anything today.
export const hasActivityToday = internalQuery({
  args: {
    userId: v.id("learnhub_users"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const first = await ctx.db
      .query("learnhub_xp_events")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .first();
    return first !== null;
  },
});

// Internal: summarise the last 7 days of XP events for the weekly digest.
// Bucketed by sourceType so the digest can phrase activity per-channel
// ("3 videos, 12 flashcards"). Uses a single by_user index scan, cheap.
export const weeklyDigestSummary = internalQuery({
  args: {
    userId: v.id("learnhub_users"),
    sinceDate: v.string(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("learnhub_xp_events")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const recent = events.filter((e) => e.date >= args.sinceDate);
    let totalXp = 0;
    const bySource: Record<string, number> = {};
    for (const e of recent) {
      totalXp += e.amount;
      bySource[e.sourceType] = (bySource[e.sourceType] ?? 0) + 1;
    }
    return {
      totalXp,
      bySource,
      eventCount: recent.length,
    };
  },
});

export const listXpEvents = query({
  args: {
    userId: v.id("learnhub_users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_xp_events")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});
