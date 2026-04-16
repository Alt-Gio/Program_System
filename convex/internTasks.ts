import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ── Auth helper ───────────────────────────────────────────────
async function resolveIntern(ctx: any, token: string) {
  const session = await ctx.db
    .query("internLoginSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) throw new Error("Session expired.");
  const loginRecord = await ctx.db.get(session.internLoginId);
  if (!loginRecord || !loginRecord.isActive) throw new Error("Account disabled.");
  return { internId: loginRecord.internId as Id<"interns"> };
}

// ── Queries ───────────────────────────────────────────────────

export const getMyTasks = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { internId } = await resolveIntern(ctx, args.token);
    const tasks = await ctx.db
      .query("internTasks")
      .withIndex("by_intern", (q: any) => q.eq("internId", internId))
      .order("desc")
      .take(100);

    return await Promise.all(tasks.map(async (t: any) => {
      const proofUrls: { storageId: string; url: string }[] = [];
      if (t.proofStorageIds?.length) {
        for (const sid of t.proofStorageIds) {
          const url = await ctx.storage.getUrl(sid);
          if (url) proofUrls.push({ storageId: sid, url });
        }
      }
      return { ...t, proofUrls };
    }));
  },
});

export const getTaskMilestones = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { internId } = await resolveIntern(ctx, args.token);
    const tasks = await ctx.db
      .query("internTasks")
      .withIndex("by_intern", (q: any) => q.eq("internId", internId))
      .collect();

    const completed  = tasks.filter((t: any) => t.status === "COMPLETED");
    const hasProof   = completed.filter((t: any) => (t.proofStorageIds?.length ?? 0) > 0);
    const onTime     = completed.filter((t: any) => t.dueDate && t.completedAt && t.completedAt <= t.dueDate);
    const totalNotes = tasks.reduce((s: number, t: any) => s + (t.progressNotes?.length ?? 0), 0);

    return {
      totalTasks:      tasks.length,
      completedCount:  completed.length,
      onTimeCount:     onTime.length,
      proofCount:      hasProof.length,
      totalNotes,
      inProgressCount: tasks.filter((t: any) => t.status === "IN_PROGRESS").length,
    };
  },
});

// ── Mutations ─────────────────────────────────────────────────

export const updateStatus = mutation({
  args: {
    token: v.string(),
    taskId: v.id("internTasks"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const { internId } = await resolveIntern(ctx, args.token);
    const task = await ctx.db.get(args.taskId);
    if (!task || task.internId !== internId) throw new Error("Task not found.");
    if (task.status === "COMPLETED") throw new Error("Task already completed.");

    const patch: any = { status: args.status };
    if (args.status === "COMPLETED") {
      patch.completedAt = new Date().toISOString().slice(0, 10);
      patch.submittedAt = Date.now();
    }
    await ctx.db.patch(args.taskId, patch);
    return { success: true };
  },
});

export const addProgressNote = mutation({
  args: {
    token: v.string(),
    taskId: v.id("internTasks"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { internId } = await resolveIntern(ctx, args.token);
    const task = await ctx.db.get(args.taskId);
    if (!task || task.internId !== internId) throw new Error("Task not found.");

    const existing = (task.progressNotes as any[]) ?? [];
    await ctx.db.patch(args.taskId, {
      progressNotes: [...existing, { note: args.note.trim(), createdAt: Date.now() }],
    });
    return { success: true };
  },
});

export const submitCompletion = mutation({
  args: {
    token: v.string(),
    taskId: v.id("internTasks"),
    completionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { internId } = await resolveIntern(ctx, args.token);
    const task = await ctx.db.get(args.taskId);
    if (!task || task.internId !== internId) throw new Error("Task not found.");

    const today = new Date().toISOString().slice(0, 10);
    await ctx.db.patch(args.taskId, {
      status: "COMPLETED",
      completedAt: today,
      submittedAt: Date.now(),
      completionNote: args.completionNote ?? undefined,
      supervisorNotified: true,
    });

    // Count completed tasks after this one (for milestone messages)
    const allTasks = await ctx.db
      .query("internTasks")
      .withIndex("by_intern", (q: any) => q.eq("internId", internId))
      .collect();
    const completedCount = allTasks.filter((t: any) => t.status === "COMPLETED").length + 1;

    // Milestone thresholds
    const milestoneMsg = completedCount === 1 ? "🏅 First task completed!"
      : completedCount === 3 ? "⚡ 3 tasks done — on a roll!"
      : completedCount === 5 ? "🏆 5 tasks completed — Taskmaster!"
      : completedCount === 10 ? "🌟 10 tasks done — exceptional work!"
      : null;

    // Notify supervisor if linked
    const intern = await ctx.db.get(internId) as any;
    if (intern?.supervisorId) {
      const lines = [`✅ Task completed: "${task.title}"`];
      if (args.completionNote) lines.push(`\n📝 ${args.completionNote}`);
      if (milestoneMsg) lines.push(`\n${milestoneMsg}`);
      const proofCount = (task.proofStorageIds as any[])?.length ?? 0;
      if (proofCount > 0) lines.push(`\n📎 ${proofCount} proof file${proofCount > 1 ? "s" : ""} attached`);

      await ctx.db.insert("supervisorMessages", {
        supervisorId: intern.supervisorId,
        internId,
        senderType: "intern",
        message: lines.join(""),
        createdAt: Date.now(),
      });
    }

    return { success: true, completedCount };
  },
});

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await resolveIntern(ctx, args.token);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveProofFile = mutation({
  args: {
    token: v.string(),
    taskId: v.id("internTasks"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const { internId } = await resolveIntern(ctx, args.token);
    const task = await ctx.db.get(args.taskId);
    if (!task || task.internId !== internId) throw new Error("Task not found.");

    const existing = (task.proofStorageIds as string[]) ?? [];
    await ctx.db.patch(args.taskId, {
      proofStorageIds: [...existing, args.storageId],
    });
    return { success: true };
  },
});

export const removeProofFile = mutation({
  args: {
    token: v.string(),
    taskId: v.id("internTasks"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const { internId } = await resolveIntern(ctx, args.token);
    const task = await ctx.db.get(args.taskId);
    if (!task || task.internId !== internId) throw new Error("Task not found.");

    await ctx.db.patch(args.taskId, {
      proofStorageIds: ((task.proofStorageIds as string[]) ?? []).filter(s => s !== args.storageId),
    });
    await ctx.storage.delete(args.storageId as Id<"_storage">);
    return { success: true };
  },
});
