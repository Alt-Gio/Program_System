import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const DEFAULT_HABITS = [
  { emoji: "⏰", title: "Check in on time", frequency: "WEEKDAYS" },
  { emoji: "📝", title: "Log today's tasks & progress", frequency: "DAILY" },
  { emoji: "📚", title: "Learn something new today", frequency: "DAILY" },
  { emoji: "💬", title: "Communicate with supervisor", frequency: "WEEKDAYS" },
  { emoji: "💡", title: "Write a daily reflection", frequency: "DAILY" },
  { emoji: "🎯", title: "Review my goals", frequency: "DAILY" },
];

async function resolveInternFromToken(ctx: any, token: string) {
  const session = await ctx.db
    .query("internLoginSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  const loginRecord = await ctx.db.get(session.internLoginId);
  if (!loginRecord || !loginRecord.isActive) return null;
  return loginRecord.internId as Id<"interns">;
}

// ── HABITS ────────────────────────────────────────────────────────────

export const getHabitsForToday = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) return null;

    const today = new Date().toISOString().slice(0, 10);

    const habits = (
      await ctx.db
        .query("internHabits")
        .withIndex("by_intern", (q: any) => q.eq("internId", internId))
        .collect()
    ).filter((h: any) => h.isActive);

    const recentLogs = await ctx.db
      .query("internHabitLogs")
      .withIndex("by_intern", (q: any) => q.eq("internId", internId))
      .order("desc")
      .take(250);

    const logMap = new Map<string, boolean>();
    for (const log of recentLogs) {
      const key = `${log.habitId}:${log.date}`;
      if (!logMap.has(key)) logMap.set(key, log.completed);
    }

    const habitsWithData = habits.map((h: any) => {
      const completedToday = logMap.get(`${h._id}:${today}`) ?? false;

      const last7: { date: string; completed: boolean }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        last7.push({ date: ds, completed: logMap.get(`${h._id}:${ds}`) ?? false });
      }

      let streak = 0;
      if (completedToday) {
        streak = 1;
        for (let i = 1; i <= 30; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const ds = d.toISOString().slice(0, 10);
          if (logMap.get(`${h._id}:${ds}`)) streak++;
          else break;
        }
      } else {
        for (let i = 1; i <= 30; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const ds = d.toISOString().slice(0, 10);
          if (logMap.get(`${h._id}:${ds}`)) streak++;
          else break;
        }
      }

      return {
        id: h._id,
        title: h.title,
        emoji: h.emoji,
        frequency: h.frequency,
        completedToday,
        streak,
        last7,
      };
    });

    return {
      internId,
      habits: habitsWithData,
      completedToday: habitsWithData.filter((h: any) => h.completedToday).length,
      totalToday: habits.length,
    };
  },
});

export const seedDefaultHabits = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) throw new Error("Session expired");

    const existing = await ctx.db
      .query("internHabits")
      .withIndex("by_intern", (q: any) => q.eq("internId", internId))
      .first();
    if (existing) return { seeded: false };

    const now = Date.now();
    for (const habit of DEFAULT_HABITS) {
      await ctx.db.insert("internHabits", {
        internId,
        title: habit.title,
        emoji: habit.emoji,
        frequency: habit.frequency,
        isActive: true,
        createdAt: now,
      });
    }
    return { seeded: true };
  },
});

export const toggleHabit = mutation({
  args: { token: v.string(), habitId: v.id("internHabits") },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) throw new Error("Session expired");

    const today = new Date().toISOString().slice(0, 10);

    const existing = await ctx.db
      .query("internHabitLogs")
      .withIndex("by_habit_date", (q: any) =>
        q.eq("habitId", args.habitId).eq("date", today)
      )
      .first();

    if (existing) {
      const newVal = !existing.completed;
      await ctx.db.patch(existing._id, {
        completed: newVal,
        completedAt: newVal ? Date.now() : undefined,
      });
      return { completed: newVal };
    } else {
      await ctx.db.insert("internHabitLogs", {
        internId,
        habitId: args.habitId,
        date: today,
        completed: true,
        completedAt: Date.now(),
      });
      return { completed: true };
    }
  },
});

export const addHabit = mutation({
  args: { token: v.string(), title: v.string(), emoji: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) throw new Error("Session expired");
    const id = await ctx.db.insert("internHabits", {
      internId,
      title: args.title,
      emoji: args.emoji ?? "✨",
      frequency: "DAILY",
      isActive: true,
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const removeHabit = mutation({
  args: { token: v.string(), habitId: v.id("internHabits") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.habitId, { isActive: false });
    return { success: true };
  },
});

// ── DAILY JOURNAL ────────────────────────────────────────────────────

export const getDailyLog = query({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) return null;
    return await ctx.db
      .query("internDailyLogs")
      .withIndex("by_intern_date", (q: any) =>
        q.eq("internId", internId).eq("date", args.date)
      )
      .first();
  },
});

export const listDailyLogs = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) return [];
    return await ctx.db
      .query("internDailyLogs")
      .withIndex("by_intern", (q: any) => q.eq("internId", internId))
      .order("desc")
      .take(30);
  },
});

export const upsertDailyLog = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    accomplishments: v.optional(v.string()),
    mood: v.optional(v.string()),
    learnings: v.optional(v.string()),
    challenges: v.optional(v.string()),
    tomorrowPlan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) throw new Error("Session expired");

    const { token, date, ...fields } = args;
    const now = Date.now();

    const existing = await ctx.db
      .query("internDailyLogs")
      .withIndex("by_intern_date", (q: any) =>
        q.eq("internId", internId).eq("date", date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
      return { id: existing._id, created: false };
    } else {
      const id = await ctx.db.insert("internDailyLogs", {
        internId,
        date,
        ...fields,
        createdAt: now,
        updatedAt: now,
      });
      return { id, created: true };
    }
  },
});

// ── GOALS ─────────────────────────────────────────────────────────────

export const listGoals = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) return [];
    return await ctx.db
      .query("internGoals")
      .withIndex("by_intern", (q: any) => q.eq("internId", internId))
      .order("desc")
      .take(20);
  },
});

export const addGoal = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const internId = await resolveInternFromToken(ctx, args.token);
    if (!internId) throw new Error("Session expired");
    const id = await ctx.db.insert("internGoals", {
      internId,
      title: args.title,
      description: args.description,
      targetDate: args.targetDate,
      isCompleted: false,
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const toggleGoal = mutation({
  args: { token: v.string(), goalId: v.id("internGoals") },
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    const newVal = !goal.isCompleted;
    await ctx.db.patch(args.goalId, {
      isCompleted: newVal,
      completedAt: newVal ? Date.now() : undefined,
    });
    return { completed: newVal };
  },
});

export const deleteGoal = mutation({
  args: { goalId: v.id("internGoals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.goalId);
    return { success: true };
  },
});

// ── SUPERVISOR: engagement overview ───────────────────────────────────

export const getSupervisorOverview = query({
  args: {},
  handler: async (ctx) => {
    const interns = await ctx.db
      .query("interns")
      .withIndex("by_status", (q: any) => q.eq("status", "ACTIVE"))
      .take(100);

    const today = new Date().toISOString().slice(0, 10);

    const result = await Promise.all(
      interns.map(async (intern: any) => {
        const todayAtt = await ctx.db
          .query("internAttendance")
          .withIndex("by_intern_date", (q: any) =>
            q.eq("internId", intern._id).eq("date", today)
          )
          .first();

        const habitLogs = await ctx.db
          .query("internHabitLogs")
          .withIndex("by_intern_date", (q: any) =>
            q.eq("internId", intern._id).eq("date", today)
          )
          .collect();

        const habits = await ctx.db
          .query("internHabits")
          .withIndex("by_intern", (q: any) => q.eq("internId", intern._id))
          .collect();

        const activeHabits = habits.filter((h: any) => h.isActive).length;
        const completedHabits = habitLogs.filter((l: any) => l.completed).length;

        const lastLog = await ctx.db
          .query("internDailyLogs")
          .withIndex("by_intern", (q: any) => q.eq("internId", intern._id))
          .order("desc")
          .first();

        const tasks = await ctx.db
          .query("internTasks")
          .withIndex("by_intern", (q: any) => q.eq("internId", intern._id))
          .take(30);

        const doneTasks  = tasks.filter((t: any) => t.status === "COMPLETED").length;
        const activeTasks = tasks.filter((t: any) => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
        const pct = intern.requiredHours > 0
          ? Math.round((intern.totalHours / intern.requiredHours) * 100)
          : 0;

        const recentHabitLogs = await ctx.db
          .query("internHabitLogs")
          .withIndex("by_intern", (q: any) => q.eq("internId", intern._id))
          .order("desc")
          .take(14);
        const weeklyHabitDays = new Set(
          recentHabitLogs.filter((l: any) => l.completed).map((l: any) => l.date)
        ).size;

        return {
          id: intern._id,
          fullName: intern.fullName,
          school: intern.school,
          department: intern.department ?? null,
          supervisor: intern.supervisor ?? null,
          status: intern.status,
          totalHours: intern.totalHours,
          requiredHours: intern.requiredHours,
          progressPct: pct,
          todayCheckedIn: !!todayAtt?.timeIn,
          todayCheckedOut: !!todayAtt?.timeOut,
          habitsToday: { completed: completedHabits, total: activeHabits },
          weeklyHabitDays,
          lastJournalDate: lastLog?.date ?? null,
          tasksCompleted: doneTasks,
          tasksActive: activeTasks,
          engagementScore: Math.round(
            (pct * 0.4) +
            (activeHabits > 0 ? (completedHabits / activeHabits) * 30 : 0) +
            (lastLog && lastLog.date >= today ? 20 : 0) +
            (todayAtt?.timeIn ? 10 : 0)
          ),
        };
      })
    );

    return result.sort((a, b) => b.engagementScore - a.engagementScore);
  },
});

export const getInternJournalForSupervisor = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("internDailyLogs")
      .withIndex("by_intern", (q: any) => q.eq("internId", args.internId))
      .order("desc")
      .take(14);
  },
});
