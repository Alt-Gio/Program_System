/**
 * Learning path queries + completion gates.
 *
 * Phase 8.A: minimal listing for mentor cohort-creation dropdowns.
 * Phase 8.C: extends this file with attemptModuleCompletion, getPathModule,
 *   gate-checking, cert auto-issue, and skill inference.
 */

import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { awardLearnHubXp } from "./learnhub_xp";
import { evaluateAndAwardForUser } from "./learnhub_badges";

export const listAvailablePaths = query({
  args: {},
  handler: async (ctx) => {
    // Only surface published or legacy (pre-Phase-9 / undefined visibility) paths.
    // Drafts and private paths stay hidden from the global picker.
    const paths = await ctx.db.query("learnhub_learning_paths").collect();
    const surfaceable = paths.filter((p) => {
      if (p.published === false) return false;
      const vis = p.visibility ?? "public";
      return vis === "public" || vis === undefined;
    });
    return surfaceable.map((p) => ({
      _id: p._id,
      title: p.title,
      description: p.description,
      programType: p.programType,
      moduleCount: p.modules.length,
      estimatedWeeks: p.estimatedWeeks,
      coverEmoji: p.coverEmoji,
      coverColor: p.coverColor,
      enrollmentCount: p.enrollmentCount,
    }));
  },
});

// Phase 9.A.6 — browse surface for /learnhub/paths.
export const listPublishedPaths = query({
  args: {
    programType: v.optional(v.string()),
    weeksBucket: v.optional(v.union(v.literal("short"), v.literal("medium"), v.literal("long"))),
  },
  handler: async (ctx, args) => {
    const paths = await ctx.db.query("learnhub_learning_paths").collect();
    const filtered = paths.filter((p) => {
      if (p.published === false) return false;
      const vis = p.visibility ?? "public";
      if (vis !== "public") return false;
      if (args.programType && p.programType !== args.programType) return false;
      if (args.weeksBucket) {
        const w = p.estimatedWeeks;
        if (args.weeksBucket === "short" && w > 4) return false;
        if (args.weeksBucket === "medium" && (w < 5 || w > 8)) return false;
        if (args.weeksBucket === "long" && w < 9) return false;
      }
      return true;
    });
    filtered.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
    const withAuthors = await Promise.all(
      filtered.map(async (p) => {
        const author = await ctx.db.get(p.createdBy);
        return {
          _id: p._id,
          title: p.title,
          description: p.description,
          programType: p.programType,
          moduleCount: p.modules.length,
          estimatedWeeks: p.estimatedWeeks,
          coverEmoji: p.coverEmoji,
          coverColor: p.coverColor,
          enrollmentCount: p.enrollmentCount,
          author: author
            ? {
                _id: author._id,
                name: author.name,
                avatarUrl: author.avatarUrl,
                role: author.role,
                mentorStatus: author.mentorStatus ?? null,
              }
            : null,
        };
      }),
    );
    return withAuthors;
  },
});

// Phase 9.A.8 — paths authored by a specific user. Caller decides whether to
// hide drafts (e.g. when viewing someone else's profile).
export const listAuthoredPaths = query({
  args: {
    authorId: v.id("learnhub_users"),
    includeDrafts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const paths = await ctx.db
      .query("learnhub_learning_paths")
      .withIndex("by_creator", (q) => q.eq("createdBy", args.authorId))
      .collect();
    const filtered = paths.filter((p) => {
      if (args.includeDrafts) return true;
      return p.published !== false;
    });
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return filtered.map((p) => ({
      _id: p._id,
      title: p.title,
      description: p.description,
      programType: p.programType,
      moduleCount: p.modules.length,
      estimatedWeeks: p.estimatedWeeks,
      visibility: p.visibility ?? "public",
      published: p.published ?? true,
      coverEmoji: p.coverEmoji,
      coverColor: p.coverColor,
      enrollmentCount: p.enrollmentCount,
      goalId: p.goalId,
      createdAt: p.createdAt,
    }));
  },
});

export const getPath = query({
  args: { pathId: v.id("learnhub_learning_paths") },
  handler: async (ctx, args) => ctx.db.get(args.pathId),
});

export const getMyEnrollment = query({
  args: {
    userId: v.id("learnhub_users"),
    pathId: v.id("learnhub_learning_paths"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_path_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", args.userId))
      .filter((q) => q.eq(q.field("pathId"), args.pathId))
      .first();
  },
});

/**
 * Phase 8.D — enroll a learner in a path with an optional target completion
 * date. Also creates a goal row linking back to the path so the deadline
 * surfaces in the Today landing's "My goals" section.
 *
 * Idempotent: enrolling twice in the same path patches the existing
 * enrollment rather than creating a duplicate.
 */
export const enrollWithCommitment = mutation({
  args: {
    userId: v.id("learnhub_users"),
    pathId: v.id("learnhub_learning_paths"),
    targetCompletionDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const path = await ctx.db.get(args.pathId);
    if (!path) throw new Error("Path not found");

    const existing = await ctx.db
      .query("learnhub_path_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", args.userId))
      .filter((q) => q.eq(q.field("pathId"), args.pathId))
      .first();

    let enrollmentId;
    if (existing) {
      if (args.targetCompletionDate && existing.targetCompletionDate !== args.targetCompletionDate) {
        await ctx.db.patch(existing._id, { targetCompletionDate: args.targetCompletionDate });
      }
      enrollmentId = existing._id;
    } else {
      enrollmentId = await ctx.db.insert("learnhub_path_enrollments", {
        pathId: args.pathId,
        studentId: args.userId,
        currentModuleIndex: 0,
        completedModuleIndices: [],
        enrolledAt: Date.now(),
        targetCompletionDate: args.targetCompletionDate,
      });
      // Bump the path's enrollmentCount counter.
      await ctx.db.patch(args.pathId, {
        enrollmentCount: path.enrollmentCount + 1,
      });
    }

    // Mirror the commitment as a goal row so it shows up in goal lists.
    const goalDeadline = args.targetCompletionDate
      ? new Date(args.targetCompletionDate + "T00:00:00Z").getTime()
      : undefined;
    const existingGoal = await ctx.db
      .query("learnhub_goals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("pathId"), args.pathId))
      .first();
    if (!existingGoal) {
      await ctx.db.insert("learnhub_goals", {
        userId: args.userId,
        title: `Complete ${path.title}`,
        description: `Finish all ${path.modules.length} modules of ${path.title}.`,
        deadline: goalDeadline,
        createdAt: Date.now(),
        pathId: args.pathId,
      });
    } else if (goalDeadline && existingGoal.deadline !== goalDeadline) {
      await ctx.db.patch(existingGoal._id, { deadline: goalDeadline });
    }

    return enrollmentId;
  },
});

/**
 * Phase 8.C — attempt to advance the current module. Gates on the module's
 * `completionRequirements` (form passing score). Awards module_completion
 * XP (with bayanihan multiplier if cohort momentum is met). On final-module
 * completion, auto-issues a learning cert and re-evaluates badges.
 */
export const attemptModuleCompletion = mutation({
  args: {
    userId: v.id("learnhub_users"),
    enrollmentId: v.id("learnhub_path_enrollments"),
    moduleIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");
    if (enrollment.studentId !== args.userId) throw new Error("Not your enrollment");
    if (enrollment.completedModuleIndices.includes(args.moduleIndex)) {
      return { advanced: false, reason: "Already completed" };
    }
    if (args.moduleIndex !== enrollment.currentModuleIndex) {
      return { advanced: false, reason: "Must complete prior modules first" };
    }

    const path = await ctx.db.get(enrollment.pathId);
    if (!path) throw new Error("Path not found");
    const module = path.modules[args.moduleIndex];
    if (!module) throw new Error("Module not found");

    // Gate check: if the module has a passing-score requirement, look up
    // the student's assessment results on any form attached to its posts.
    // `passed` already encodes the per-form threshold check (see
    // learnhub_forms submission flow), so we just check that one passed
    // result exists for a post in this module.
    const required = module.completionRequirements.formPassingScore;
    if (required !== undefined) {
      const results = await ctx.db
        .query("learnhub_assessment_results")
        .withIndex("by_student", (q) => q.eq("studentId", args.userId))
        .collect();
      const passed = results.some(
        (r) => r.passed === true && module.postIds.includes(r.postId),
      );
      if (!passed) {
        return {
          advanced: false,
          reason: `Pass the module quiz to continue`,
        };
      }
    }

    // Advance.
    const completed = [...enrollment.completedModuleIndices, args.moduleIndex];
    const isFinal = args.moduleIndex >= path.modules.length - 1;
    const nextIndex = isFinal ? args.moduleIndex : args.moduleIndex + 1;
    await ctx.db.patch(args.enrollmentId, {
      currentModuleIndex: nextIndex,
      completedModuleIndices: completed,
      completedAt: isFinal ? Date.now() : enrollment.completedAt,
    });

    // Bayanihan: if pinned to a cohort and ≥50% of cohort members already
    // cleared this module, apply a 1.2× XP multiplier.
    let bayanihan = false;
    if (enrollment.groupId) {
      const peers = await ctx.db
        .query("learnhub_path_enrollments")
        .withIndex("by_group", (q) => q.eq("groupId", enrollment.groupId!))
        .collect();
      const cleared = peers.filter((p) =>
        p.completedModuleIndices.includes(args.moduleIndex),
      ).length;
      if (peers.length > 0 && cleared / peers.length >= 0.5) {
        bayanihan = true;
      }
    }

    const baseXp = 30;
    const xp = bayanihan ? Math.round(baseXp * 1.2) : baseXp;
    await awardLearnHubXp(ctx, {
      userId: args.userId,
      amount: xp,
      reason: `Completed module ${args.moduleIndex + 1} of ${path.title}${bayanihan ? " (bayanihan boost)" : ""}`,
      sourceType: "module_completion",
      idempotencyKey: `module:${args.enrollmentId}:${args.moduleIndex}`,
    });

    // Final module: auto-issue cert + skill inference + badge re-eval.
    if (isFinal) {
      try {
        await autoIssueOnPathCompletionImpl(ctx, {
          userId: args.userId,
          pathId: enrollment.pathId,
        });
      } catch (e) {
        console.error("auto-issue cert failed", e);
      }
      try {
        await bumpSkillsForCompletionImpl(ctx, {
          userId: args.userId,
          pathId: enrollment.pathId,
        });
      } catch (e) {
        console.error("skill bump failed", e);
      }
    }

    return { advanced: true, bayanihan, xp, completed: isFinal };
  },
});

// ── Phase 8.C helpers (in this file to avoid a circular import via `internal`) ──

async function autoIssueOnPathCompletionImpl(
  ctx: MutationCtx,
  args: { userId: Id<"learnhub_users">; pathId: Id<"learnhub_learning_paths"> },
): Promise<void> {
  const path = await ctx.db.get(args.pathId);
  if (!path) return;
  const verificationId = `path-${args.pathId}-${args.userId}`;
  // Dedup on verificationId — idempotent across retries.
  const existing = await ctx.db
    .query("learnhub_certificates")
    .withIndex("by_verification", (q) => q.eq("verificationId", verificationId))
    .first();
  if (existing) return;

  const recipient = await ctx.db.get(args.userId);
  const issuer = await ctx.db.get(path.createdBy);

  await ctx.db.insert("learnhub_certificates", {
    studentEmail: recipient?.email ?? "",
    studentId: args.userId,
    courseTitle: path.title,
    programType: path.programType,
    issuedBy: path.createdBy,
    issuedByName: issuer?.name ?? "LearnHub",
    issuedAt: Date.now(),
    status: "issued",
    verificationId,
    certType: "learning",
  });

  // Cross-subsystem badge re-eval (Renaissance Learner, etc.).
  await evaluateAndAwardForUser(ctx, args.userId);
}

async function bumpSkillsForCompletionImpl(
  ctx: MutationCtx,
  args: { userId: Id<"learnhub_users">; pathId: Id<"learnhub_learning_paths"> },
): Promise<void> {
  const user = await ctx.db.get(args.userId);
  const path = await ctx.db.get(args.pathId);
  if (!user || !path) return;
  const skillLevels: Record<string, "beginner" | "intermediate" | "advanced"> = {
    ...(user.skillLevels ?? {}),
  };
  const tag = path.programType.toLowerCase();
  const current = skillLevels[tag] ?? "beginner";
  const enrollments = await ctx.db
    .query("learnhub_path_enrollments")
    .withIndex("by_student", (q) => q.eq("studentId", args.userId))
    .collect();
  const completedInSkill =
    enrollments.filter((e) => e.completedAt !== undefined).length;
  let next: "beginner" | "intermediate" | "advanced" = current;
  if (completedInSkill >= 4) next = "advanced";
  else if (completedInSkill >= 2) next = "intermediate";
  if (next !== current) {
    skillLevels[tag] = next;
    await ctx.db.patch(args.userId, { skillLevels });
  }
}

// ── Phase 9.A — Authoring mutations ─────────────────────────────────────

// Role check mirrors createLearningCohort in learnhub_groups.ts.
function isPublishingRole(role: string, mentorStatus: string | null | undefined): boolean {
  if (role === "org_partner" || role === "coordinator" || role === "admin") return true;
  if (role === "mentor" && mentorStatus === "verified") return true;
  return false;
}

const moduleValidator = v.object({
  order: v.number(),
  title: v.string(),
  postIds: v.array(v.id("learnhub_posts")),
  completionRequirements: v.object({
    watchPercent: v.optional(v.number()),
    formPassingScore: v.optional(v.number()),
  }),
});

const visibilityValidator = v.union(
  v.literal("private"),
  v.literal("cohort"),
  v.literal("public"),
);

export const createLearningPath = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    title: v.string(),
    description: v.string(),
    programType: v.string(),
    modules: v.array(moduleValidator),
    estimatedWeeks: v.number(),
    visibility: visibilityValidator,
    coverEmoji: v.optional(v.string()),
    coverColor: v.optional(v.string()),
    goalId: v.optional(v.id("learnhub_goals")),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");

    if (!args.title.trim()) throw new Error("Title is required");
    if (args.estimatedWeeks < 1 || args.estimatedWeeks > 52) {
      throw new Error("Estimated weeks must be between 1 and 52");
    }

    // Visibility gate: students can only create private paths.
    let effectiveVisibility = args.visibility;
    if (actor.role === "student" && effectiveVisibility !== "private") {
      effectiveVisibility = "private";
    }

    // Publishing public requires the publishing role.
    let effectivePublished = args.publish ?? false;
    if (
      effectivePublished &&
      effectiveVisibility === "public" &&
      !isPublishingRole(actor.role, actor.mentorStatus ?? null)
    ) {
      effectivePublished = false;
    }

    // If goalId is set, verify ownership.
    if (args.goalId) {
      const goal = await ctx.db.get(args.goalId);
      if (!goal) throw new Error("Goal not found");
      if (goal.userId !== args.actorId) throw new Error("Goal does not belong to actor");
    }

    const pathId = await ctx.db.insert("learnhub_learning_paths", {
      createdBy: args.actorId,
      title: args.title.trim(),
      description: args.description.trim(),
      programType: args.programType,
      modules: args.modules,
      estimatedWeeks: args.estimatedWeeks,
      prerequisitePathIds: [],
      enrollmentCount: 0,
      createdAt: Date.now(),
      visibility: effectiveVisibility,
      published: effectivePublished,
      coverEmoji: args.coverEmoji,
      coverColor: args.coverColor,
      goalId: args.goalId,
    });

    // Bidirectional link: patch goal's pathId.
    if (args.goalId) {
      await ctx.db.patch(args.goalId, { pathId });
    }

    return pathId;
  },
});

export const publishLearningPath = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    pathId: v.id("learnhub_learning_paths"),
  },
  handler: async (ctx, args) => {
    const path = await ctx.db.get(args.pathId);
    if (!path) throw new Error("Path not found");
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");

    const isAuthor = path.createdBy === args.actorId;
    const canPublish =
      isAuthor || isPublishingRole(actor.role, actor.mentorStatus ?? null);
    if (!canPublish) throw new Error("Not authorized to publish");

    // Public publishing requires the privileged role even if you're the author.
    const vis = path.visibility ?? "public";
    if (vis === "public" && !isPublishingRole(actor.role, actor.mentorStatus ?? null)) {
      throw new Error("Only verified mentors or org roles can publish public paths");
    }

    await ctx.db.patch(args.pathId, { published: true });
  },
});

export const updateLearningPath = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    pathId: v.id("learnhub_learning_paths"),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      programType: v.optional(v.string()),
      modules: v.optional(v.array(moduleValidator)),
      estimatedWeeks: v.optional(v.number()),
      visibility: v.optional(visibilityValidator),
      coverEmoji: v.optional(v.string()),
      coverColor: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const path = await ctx.db.get(args.pathId);
    if (!path) throw new Error("Path not found");
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");
    if (path.createdBy !== args.actorId && !isPublishingRole(actor.role, actor.mentorStatus ?? null)) {
      throw new Error("Not authorized to edit this path");
    }

    const patch: Record<string, unknown> = {};
    if (args.patch.title !== undefined) patch.title = args.patch.title.trim();
    if (args.patch.description !== undefined) patch.description = args.patch.description.trim();
    if (args.patch.programType !== undefined) patch.programType = args.patch.programType;
    if (args.patch.modules !== undefined) patch.modules = args.patch.modules;
    if (args.patch.estimatedWeeks !== undefined) {
      if (args.patch.estimatedWeeks < 1 || args.patch.estimatedWeeks > 52) {
        throw new Error("Estimated weeks must be between 1 and 52");
      }
      patch.estimatedWeeks = args.patch.estimatedWeeks;
    }
    if (args.patch.coverEmoji !== undefined) patch.coverEmoji = args.patch.coverEmoji;
    if (args.patch.coverColor !== undefined) patch.coverColor = args.patch.coverColor;
    if (args.patch.visibility !== undefined) {
      const next = args.patch.visibility;
      const cur = path.visibility ?? "public";
      // Upgrade to public requires privileged role.
      if (next === "public" && cur !== "public" && !isPublishingRole(actor.role, actor.mentorStatus ?? null)) {
        throw new Error("Only verified mentors or org roles can make a path public");
      }
      // Students can never set visibility to anything but private.
      if (actor.role === "student" && next !== "private") {
        throw new Error("Students can only have private paths");
      }
      patch.visibility = next;
    }

    await ctx.db.patch(args.pathId, patch);
  },
});

/**
 * Rec #9 — Clone a public path into a new private draft owned by actor.
 *
 * Copies title (suffixed " (copy)"), description, programType, modules
 * (postIds preserved — the cloned path points at the same materials),
 * estimatedWeeks, cover, but resets enrollmentCount/published/goalId.
 * Visibility forced to "private" + published=false so the cloner can
 * customise before exposing it.
 */
export const cloneLearningPath = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    sourcePathId: v.id("learnhub_learning_paths"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourcePathId);
    if (!source) throw new Error("Source path not found");
    // Only public paths (or your own) can be cloned. Private/cohort paths of
    // someone else's are intentionally not forkable.
    const sourceVis = source.visibility ?? "public";
    const isOwn = source.createdBy === args.actorId;
    if (!isOwn && sourceVis !== "public") {
      throw new Error("This path isn't public — only the author can clone it");
    }
    const newPathId = await ctx.db.insert("learnhub_learning_paths", {
      createdBy: args.actorId,
      title: `${source.title} (copy)`,
      description: source.description,
      programType: source.programType,
      modules: source.modules.map((m) => ({
        order: m.order,
        title: m.title,
        postIds: [...m.postIds],
        completionRequirements: { ...m.completionRequirements },
      })),
      estimatedWeeks: source.estimatedWeeks,
      prerequisitePathIds: [],
      enrollmentCount: 0,
      createdAt: Date.now(),
      visibility: "private",
      published: false,
      coverEmoji: source.coverEmoji,
      coverColor: source.coverColor,
    });
    return newPathId;
  },
});

export const archiveLearningPath = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    pathId: v.id("learnhub_learning_paths"),
  },
  handler: async (ctx, args) => {
    const path = await ctx.db.get(args.pathId);
    if (!path) throw new Error("Path not found");
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");
    if (path.createdBy !== args.actorId && !isPublishingRole(actor.role, actor.mentorStatus ?? null)) {
      throw new Error("Not authorized to archive this path");
    }
    await ctx.db.patch(args.pathId, { published: false });
  },
});
