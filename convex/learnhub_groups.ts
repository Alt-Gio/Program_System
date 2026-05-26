/**
 * Cohort lifecycle: create/join/leave + discovery + lifecycle transitions.
 *
 * A "cohort" is a `learnhub_groups` row with `type: "learning"` and a
 * `pathId` set. The cohort lead is `adminIds[0]`. Members live in the
 * existing `learnhub_group_members` table. Path progression is pinned
 * to the cohort via `learnhub_path_enrollments.groupId` on join.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

function manilaDay(now = Date.now()): string {
  const d = new Date(now + 8 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function deriveLifecycle(
  group: Pick<Doc<"learnhub_groups">, "startDate" | "endDate" | "lifecycleStatus">,
  today = manilaDay(),
): "draft" | "upcoming" | "active" | "completed" | "archived" {
  if (group.lifecycleStatus === "draft") return "draft";
  if (group.lifecycleStatus === "archived") return "archived";
  if (group.lifecycleStatus === "completed") return "completed";
  if (!group.startDate) return group.lifecycleStatus ?? "upcoming";
  if (today < group.startDate) return "upcoming";
  if (group.endDate && today > group.endDate) return "completed";
  return "active";
}

// ── Mutations ───────────────────────────────────────────────────────────

export const createLearningCohort = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    pathId: v.id("learnhub_learning_paths"),
    name: v.string(),
    description: v.string(),
    regionScope: v.optional(v.string()),
    capacity: v.optional(v.number()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    coverEmoji: v.optional(v.string()),
    coverColor: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");
    const isVerifiedMentor =
      actor.role === "mentor" && actor.mentorStatus === "verified";
    const isOrgRole =
      actor.role === "org_partner" ||
      actor.role === "coordinator" ||
      actor.role === "admin";
    if (!isVerifiedMentor && !isOrgRole) {
      throw new Error("Only verified mentors or org roles can create cohorts");
    }

    const path = await ctx.db.get(args.pathId);
    if (!path) throw new Error("Path not found");

    const now = Date.now();
    const displayName = args.regionScope
      ? `${args.regionScope} · ${args.name}`
      : args.name;

    const groupId = await ctx.db.insert("learnhub_groups", {
      name: displayName,
      description: args.description,
      type: "learning",
      programType: path.programType,
      createdBy: args.actorId,
      adminIds: [args.actorId],
      memberCount: 1,
      isPrivate: false,
      createdAt: now,
      pathId: args.pathId,
      regionScope: args.regionScope,
      startDate: args.startDate,
      endDate: args.endDate,
      capacity: args.capacity,
      coverEmoji: args.coverEmoji ?? "🚀",
      coverColor: args.coverColor,
      lifecycleStatus: args.publish ? "upcoming" : "draft",
    });

    // Lead is also a member (admin role).
    await ctx.db.insert("learnhub_group_members", {
      groupId,
      userId: args.actorId,
      role: "admin",
      joinedAt: now,
    });

    return groupId;
  },
});

export const publishCohort = mutation({
  args: { actorId: v.id("learnhub_users"), groupId: v.id("learnhub_groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Cohort not found");
    if (!group.adminIds.includes(args.actorId)) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(args.groupId, { lifecycleStatus: "upcoming" });
  },
});

export const joinCohort = mutation({
  args: { userId: v.id("learnhub_users"), groupId: v.id("learnhub_groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Cohort not found");
    const status = deriveLifecycle(group);
    if (status === "archived" || status === "completed") {
      throw new Error("This cohort is no longer accepting members");
    }
    if (status === "draft") {
      throw new Error("This cohort is still being set up");
    }
    if (group.capacity && group.memberCount >= group.capacity) {
      throw new Error("This cohort is full");
    }

    const existing = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (existing) return existing._id;

    const memberId = await ctx.db.insert("learnhub_group_members", {
      groupId: args.groupId,
      userId: args.userId,
      role: "member",
      joinedAt: Date.now(),
    });
    await ctx.db.patch(args.groupId, { memberCount: group.memberCount + 1 });

    // Auto-enroll in the bound path if not already enrolled.
    if (group.pathId) {
      const enrollment = await ctx.db
        .query("learnhub_path_enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", args.userId))
        .filter((q) => q.eq(q.field("pathId"), group.pathId!))
        .first();
      if (!enrollment) {
        await ctx.db.insert("learnhub_path_enrollments", {
          pathId: group.pathId,
          studentId: args.userId,
          currentModuleIndex: 0,
          completedModuleIndices: [],
          enrolledAt: Date.now(),
          groupId: args.groupId,
        });
      } else if (!enrollment.groupId) {
        await ctx.db.patch(enrollment._id, { groupId: args.groupId });
      }
    }

    // Cohort lead notification (cohort_member_joined) is wired in Phase 8.B
    // when notifyCohortEvent ships. Keep this mutation pure for 8.A.

    return memberId;
  },
});

export const leaveCohort = mutation({
  args: { userId: v.id("learnhub_users"), groupId: v.id("learnhub_groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return;
    const membership = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (!membership) return;
    if (membership.role === "admin" && group.adminIds.length === 1) {
      throw new Error("Cohort lead cannot leave; archive the cohort instead");
    }
    await ctx.db.delete(membership._id);
    await ctx.db.patch(args.groupId, {
      memberCount: Math.max(0, group.memberCount - 1),
    });

    // Unpin enrollment (keep progress, just remove cohort link).
    if (group.pathId) {
      const enrollment = await ctx.db
        .query("learnhub_path_enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", args.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("pathId"), group.pathId!),
            q.eq(q.field("groupId"), args.groupId),
          ),
        )
        .first();
      if (enrollment) {
        await ctx.db.patch(enrollment._id, { groupId: undefined });
      }
    }
  },
});

export const muteCohortNotifications = mutation({
  args: {
    userId: v.id("learnhub_users"),
    groupId: v.id("learnhub_groups"),
    muted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const m = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (!m) throw new Error("Not a member of this cohort");
    await ctx.db.patch(m._id, { notificationsMuted: args.muted });
  },
});

// ── Queries ─────────────────────────────────────────────────────────────

export const listMyCohorts = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const today = manilaDay();
    const results: Array<{
      group: Doc<"learnhub_groups">;
      role: "member" | "admin";
      status: ReturnType<typeof deriveLifecycle>;
      muted: boolean;
    }> = [];
    for (const m of memberships) {
      const g = await ctx.db.get(m.groupId);
      if (!g) continue;
      if (g.type !== "learning") continue;
      results.push({
        group: g,
        role: m.role,
        status: deriveLifecycle(g, today),
        muted: m.notificationsMuted ?? false,
      });
    }
    return results;
  },
});

export const listLedCohorts = query({
  args: { mentorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const groups = await ctx.db
      .query("learnhub_groups")
      .withIndex("by_type", (q) => q.eq("type", "learning"))
      .collect();
    const today = manilaDay();
    return groups
      .filter((g) => g.adminIds[0] === args.mentorId)
      .map((g) => ({ group: g, status: deriveLifecycle(g, today) }));
  },
});

export const listDiscoverableCohorts = query({
  args: {
    userId: v.id("learnhub_users"),
    pathId: v.optional(v.id("learnhub_learning_paths")),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const groups = await ctx.db
      .query("learnhub_groups")
      .withIndex("by_type", (q) => q.eq("type", "learning"))
      .collect();

    const today = manilaDay();
    const myMembershipsRaw = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const memberOf = new Set(myMembershipsRaw.map((m) => m.groupId as string));

    const userInterests = new Set(
      (user.interests ?? []).map((s) => normalize(s)),
    );

    type ScoredCohort = {
      group: Doc<"learnhub_groups">;
      status: ReturnType<typeof deriveLifecycle>;
      score: number;
      isMember: boolean;
      lead: Doc<"learnhub_users"> | null;
      path: Doc<"learnhub_learning_paths"> | null;
    };

    const out: ScoredCohort[] = [];
    for (const g of groups) {
      const status = deriveLifecycle(g, today);
      if (status === "draft" || status === "archived") continue;
      if (args.pathId && g.pathId !== args.pathId) continue;
      if (args.region && g.regionScope && g.regionScope !== args.region) continue;

      const path = g.pathId ? await ctx.db.get(g.pathId) : null;
      const lead = g.adminIds[0] ? await ctx.db.get(g.adminIds[0]) : null;

      let score = 0;
      // Lifecycle: upcoming > active > completed
      if (status === "upcoming") score += 5;
      else if (status === "active") score += 3;
      else score += 0;
      // Same region as user
      if (user.region && g.regionScope === user.region) score += 4;
      // Mentor-led bonus (lead is a verified mentor)
      if (lead && lead.role === "mentor" && lead.mentorStatus === "verified") {
        score += 3;
      }
      // Interest overlap via path.programType
      if (path && userInterests.has(normalize(path.programType))) score += 3;
      // Open seats
      const remaining = g.capacity ? g.capacity - g.memberCount : 1;
      if (remaining > 0) score += 1;

      out.push({
        group: g,
        status,
        score,
        isMember: memberOf.has(g._id as string),
        lead,
        path,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  },
});

export const getCohortDashboard = query({
  args: {
    groupId: v.id("learnhub_groups"),
    viewerId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    if (group.type !== "learning") return null;

    const today = manilaDay();
    const status = deriveLifecycle(group, today);
    const lead = group.adminIds[0] ? await ctx.db.get(group.adminIds[0]) : null;
    const path = group.pathId ? await ctx.db.get(group.pathId) : null;

    const memberships = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    type MemberRow = {
      userId: Id<"learnhub_users">;
      name: string;
      avatarUrl: string;
      role: "member" | "admin";
      currentModuleIndex: number;
      completedCount: number;
      totalModules: number;
      progressPct: number;
    };

    const members: MemberRow[] = [];
    const enrollmentsByUser = new Map<string, Doc<"learnhub_path_enrollments">>();
    if (group.pathId) {
      const enrollments = await ctx.db
        .query("learnhub_path_enrollments")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      for (const e of enrollments) {
        enrollmentsByUser.set(e.studentId as string, e);
      }
    }
    const totalModules = path?.modules.length ?? 0;

    for (const m of memberships) {
      const u = await ctx.db.get(m.userId);
      if (!u) continue;
      const enrollment = enrollmentsByUser.get(m.userId as string);
      const completedCount = enrollment?.completedModuleIndices.length ?? 0;
      const progressPct =
        totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
      members.push({
        userId: u._id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        role: m.role,
        currentModuleIndex: enrollment?.currentModuleIndex ?? 0,
        completedCount,
        totalModules,
        progressPct,
      });
    }
    // Lead first, then by progress desc.
    members.sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return b.progressPct - a.progressPct;
    });

    const viewerMembership = args.viewerId
      ? memberships.find((m) => m.userId === args.viewerId)
      : null;

    return {
      group,
      status,
      lead,
      path,
      members,
      viewerIsMember: !!viewerMembership,
      viewerRole: viewerMembership?.role ?? null,
      viewerMuted: viewerMembership?.notificationsMuted ?? false,
      remainingSeats: group.capacity
        ? Math.max(0, group.capacity - group.memberCount)
        : null,
    };
  },
});

// Rec #4 — Public cohort summary for the unauthenticated /cohorts/[id]
// page. Returns ONLY aggregate, shareable data: cohort name + region +
// mentor display name + member count + path title + lifecycle stats.
// Never returns member names, emails, ids, posts, or chat content.
export const getCohortPublicSummary = query({
  args: { groupId: v.id("learnhub_groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    if (group.type !== "learning") return null;
    if (group.isPrivate) return null;

    const today = manilaDay();
    const status = deriveLifecycle(group, today);
    if (status === "draft") return null;

    const lead = group.adminIds[0] ? await ctx.db.get(group.adminIds[0]) : null;
    const path = group.pathId ? await ctx.db.get(group.pathId) : null;

    // Completion stats — what fraction of members have finished the path.
    let graduatedCount = 0;
    let totalModulesCompleted = 0;
    if (group.pathId) {
      const enrollments = await ctx.db
        .query("learnhub_path_enrollments")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      graduatedCount = enrollments.filter((e) => e.completedAt !== undefined).length;
      totalModulesCompleted = enrollments.reduce(
        (sum, e) => sum + e.completedModuleIndices.length,
        0,
      );
    }

    return {
      groupId: group._id,
      name: group.name,
      description: group.description,
      coverEmoji: group.coverEmoji ?? "🚀",
      coverColor: group.coverColor ?? null,
      regionScope: group.regionScope ?? null,
      startDate: group.startDate ?? null,
      endDate: group.endDate ?? null,
      memberCount: group.memberCount,
      capacity: group.capacity ?? null,
      status,
      lead: lead
        ? {
            name: lead.name,
            avatarUrl: lead.avatarUrl,
            isVerifiedMentor: lead.role === "mentor" && lead.mentorStatus === "verified",
          }
        : null,
      path: path
        ? {
            title: path.title,
            programType: path.programType,
            moduleCount: path.modules.length,
            estimatedWeeks: path.estimatedWeeks,
          }
        : null,
      graduatedCount,
      totalModulesCompleted,
    };
  },
});

export const suggestCohortAtSignup = query({
  args: {
    userId: v.id("learnhub_users"),
    pathId: v.optional(v.id("learnhub_learning_paths")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const today = manilaDay();

    const groups = await ctx.db
      .query("learnhub_groups")
      .withIndex("by_type", (q) => q.eq("type", "learning"))
      .collect();

    let best: { group: Doc<"learnhub_groups">; score: number } | null = null;
    for (const g of groups) {
      const status = deriveLifecycle(g, today);
      if (status !== "upcoming" && status !== "active") continue;
      if (g.capacity && g.memberCount >= g.capacity) continue;
      if (args.pathId && g.pathId !== args.pathId) continue;

      let score = 0;
      if (args.pathId && g.pathId === args.pathId) score += 10;
      if (user.region && g.regionScope === user.region) score += 5;
      const lead = g.adminIds[0] ? await ctx.db.get(g.adminIds[0]) : null;
      if (lead && lead.role === "mentor" && lead.mentorStatus === "verified") {
        score += 3;
      }
      if (status === "upcoming") score += 2;

      if (!best || score > best.score) best = { group: g, score };
    }
    return best ? best.group : null;
  },
});

// ── Lifecycle cron helper ───────────────────────────────────────────────

export const tickCohortLifecycles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = manilaDay();
    const groups = await ctx.db
      .query("learnhub_groups")
      .withIndex("by_type", (q) => q.eq("type", "learning"))
      .collect();
    let transitioned = 0;
    for (const g of groups) {
      const next = deriveLifecycle(g, today);
      if (g.lifecycleStatus !== next) {
        await ctx.db.patch(g._id, { lifecycleStatus: next });
        transitioned++;
      }
      // Auto-archive empty upcoming cohorts after 14 days past startDate.
      if (
        g.lifecycleStatus === "upcoming" &&
        g.startDate &&
        g.memberCount <= 1
      ) {
        const start = new Date(g.startDate + "T00:00:00Z").getTime();
        if (Date.now() - start > 14 * 24 * 60 * 60 * 1000) {
          await ctx.db.patch(g._id, { lifecycleStatus: "archived" });
          transitioned++;
        }
      }
    }
    return { transitioned };
  },
});
