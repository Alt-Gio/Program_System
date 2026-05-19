import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const XP_SOURCE = v.union(
  v.literal("daily_login"),
  v.literal("work_completion"),
  v.literal("journal_habit"),
  v.literal("flow_session"),
  v.literal("manual")
);

const DAILY_CAPS = {
  daily_login: 10,
  work_completion: 1000,
  journal_habit: 60,
  flow_session: 80,
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

  await ctx.db.patch(args.userId, { xpPoints: user.xpPoints + awarded });
  return { awarded, duplicate: false, capped: awarded < amount };
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
