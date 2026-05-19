import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { awardLearnHubXp } from "./learnhub_xp";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getHabitStreak(ctx: QueryCtx, habitId: Id<"learnhub_habits">) {
  const logs = await ctx.db
    .query("learnhub_habit_logs")
    .withIndex("by_habit_date", (q) => q.eq("habitId", habitId))
    .collect();
  const completedDates = new Set(
    logs.filter((log) => log.completed).map((log) => log.date)
  );
  let streak = 0;
  const cursor = new Date(todayKey() + "T12:00:00");
  while (completedDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export const listForDate = query({
  args: { userId: v.id("learnhub_users"), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const date = args.date ?? todayKey();
    const habits = await ctx.db
      .query("learnhub_habits")
      .withIndex("by_user_active", (q) => q.eq("userId", args.userId).eq("isActive", true))
      .collect();
    const logs = await ctx.db
      .query("learnhub_habit_logs")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", date))
      .collect();
    const enriched = await Promise.all(
      habits.map(async (habit) => {
        const log = logs.find((item) => item.habitId === habit._id);
        return {
          ...habit,
          completedToday: log?.completed ?? false,
          xpAwarded: log?.xpAwarded ?? 0,
          streak: await getHabitStreak(ctx, habit._id),
        };
      })
    );
    return {
      habits: enriched,
      completedToday: enriched.filter((habit) => habit.completedToday).length,
      totalToday: enriched.length,
    };
  },
});

export const addHabit = mutation({
  args: {
    userId: v.id("learnhub_users"),
    title: v.string(),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (!title) throw new Error("Habit title is required");
    const now = Date.now();
    return await ctx.db.insert("learnhub_habits", {
      userId: args.userId,
      title,
      emoji: args.emoji ?? "✨",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeHabit = mutation({
  args: { habitId: v.id("learnhub_habits"), userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== args.userId) throw new Error("Habit not found");
    await ctx.db.patch(args.habitId, { isActive: false, updatedAt: Date.now() });
  },
});

export const toggleHabit = mutation({
  args: {
    habitId: v.id("learnhub_habits"),
    userId: v.id("learnhub_users"),
    date: v.optional(v.string()),
    desiredCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== args.userId || !habit.isActive) throw new Error("Habit not found");
    const date = args.date ?? todayKey();
    const existing = await ctx.db
      .query("learnhub_habit_logs")
      .withIndex("by_habit_date", (q) => q.eq("habitId", args.habitId).eq("date", date))
      .unique();
    const completed = args.desiredCompleted ?? !(existing?.completed ?? false);
    let xpAwarded = existing?.xpAwarded ?? 0;
    if (completed && xpAwarded === 0) {
      const res = await awardLearnHubXp(ctx, {
        userId: args.userId,
        amount: 10,
        reason: `Completed habit: ${habit.title}`,
        sourceType: "journal_habit",
        sourceId: String(args.habitId),
        idempotencyKey: `habit:${args.userId}:${args.habitId}:${date}`,
      });
      xpAwarded = res.awarded;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        completed,
        completedAt: completed ? Date.now() : undefined,
        xpAwarded,
      });
    } else {
      await ctx.db.insert("learnhub_habit_logs", {
        habitId: args.habitId,
        userId: args.userId,
        date,
        completed,
        completedAt: completed ? Date.now() : undefined,
        xpAwarded,
      });
    }
    return { completed, xpAwarded };
  },
});
