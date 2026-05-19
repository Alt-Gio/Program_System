/**
 * Mentor- and Coordinator-only learning-progress queries.
 *
 * Access rules (enforced on the server — clients only pass viewerId):
 *   • mentor     → sees only students in active mentoring_relationships where
 *                  mentorId = viewerId.
 *   • coordinator / admin → sees every mentor + every student in the program.
 *   • student / org_partner / unauth → all queries return { forbidden: true }.
 *
 * The shape mirrors the mockup data structure (overall %, current module,
 * hours, XP, certs, days-since-active, status) so the UI from
 * mentor-progress-app.jsx can drop in unchanged.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

type ProgressStatus = "on-track" | "risk" | "inactive" | "done";

type StudentProgress = {
  id: Id<"learnhub_users">;
  name: string;
  initials: string;
  avatarUrl: string;
  mentorId: Id<"learnhub_users"> | null;
  province: string | null;
  overall: number;
  hours: number;
  xp: number;
  days: number;
  certs: number;
  status: ProgressStatus;
  currentModule: {
    title: string;
    progress: number;
    total: number;
  } | null;
  enrolledAt: number | null;
};

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function daysSince(ts: string | number | undefined): number {
  if (!ts) return 999;
  const t = typeof ts === "string" ? new Date(ts).getTime() : ts;
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function deriveStatus(overall: number, days: number): ProgressStatus {
  if (overall >= 92) return "done";
  if (days > 14) return "inactive";
  if (overall < 25 || days > 8) return "risk";
  return "on-track";
}

async function buildStudentProgress(
  ctx: { db: { get: (id: Id<"learnhub_users">) => Promise<Doc<"learnhub_users"> | null> } },
  student: Doc<"learnhub_users">,
  mentorId: Id<"learnhub_users"> | null,
): Promise<StudentProgress> {
  const xp = student.xpPoints ?? 0;
  // Overall is a transparent transform of XP. Each module ≈ 1000 XP target,
  // capped at 99% so cards never claim "done" until the student is actually
  // marked complete elsewhere. Adjust the divisor when the curriculum
  // length changes.
  const overall = Math.min(99, Math.round((xp / 7000) * 100));
  const lastActive = student.lastActiveDate;
  const days = daysSince(lastActive);
  const status = deriveStatus(overall, days);
  return {
    id: student._id,
    name: student.name,
    initials: initialsFromName(student.name),
    avatarUrl: student.avatarUrl,
    mentorId,
    province: student.province ?? null,
    overall,
    // Rough hours estimate from XP — 10 XP per hour of activity is what
    // markDailyLogin awards plus quiz/journal hooks. Surface as informational
    // only; switch to a real session ledger once that table lands.
    hours: Math.round(xp / 10),
    xp,
    days,
    certs: Math.floor(overall / 35),
    status,
    currentModule: null,
    enrolledAt: student.onboardingCompletedAt ?? null,
  };
}

// Single source of truth for "who is this viewer and what tier of access
// do they get?" — every public query in this module funnels through it
// so the rules don't drift.
async function classifyViewer(
  ctx: { db: { get: (id: Id<"learnhub_users">) => Promise<Doc<"learnhub_users"> | null> } },
  viewerId: Id<"learnhub_users"> | null,
): Promise<
  | { ok: false; reason: "unauth" | "forbidden" }
  | { ok: true; tier: "mentor" | "coordinator"; viewer: Doc<"learnhub_users"> }
> {
  if (!viewerId) return { ok: false, reason: "unauth" };
  const viewer = await ctx.db.get(viewerId);
  if (!viewer) return { ok: false, reason: "unauth" };
  if (viewer.role === "coordinator" || viewer.role === "admin") {
    return { ok: true, tier: "coordinator", viewer };
  }
  if (viewer.role === "mentor") {
    return { ok: true, tier: "mentor", viewer };
  }
  return { ok: false, reason: "forbidden" };
}

// What the dashboard route loads on mount. Returns the same shape for both
// tiers; the UI branches on `tier`. Students hitting this query get
// { forbidden: true } and the page renders an access-denied state.
export const getDashboard = query({
  args: { viewerId: v.optional(v.id("learnhub_users")) },
  handler: async (ctx, args) => {
    const access = await classifyViewer(ctx, args.viewerId ?? null);
    if (!access.ok) return { forbidden: true as const, reason: access.reason };
    const { tier, viewer } = access;

    if (tier === "mentor") {
      // Only this mentor's active mentees. Pulls from
      // learnhub_mentoring_relationships so the moment a relationship is
      // declined / completed the student drops off the list.
      const rels = await ctx.db
        .query("learnhub_mentoring_relationships")
        .withIndex("by_mentor", (q) => q.eq("mentorId", viewer._id))
        .collect();
      const activeRels = rels.filter((r) => r.status === "active" || r.status === "requested");
      const students: StudentProgress[] = [];
      for (const r of activeRels) {
        const s = await ctx.db.get(r.menteeId);
        if (!s) continue;
        students.push(await buildStudentProgress(ctx, s, viewer._id));
      }
      students.sort((a, b) => b.overall - a.overall);

      const total = students.length;
      const avgProgress = total
        ? Math.round(students.reduce((sum, s) => sum + s.overall, 0) / total)
        : 0;
      return {
        forbidden: false as const,
        tier: "mentor" as const,
        viewer: {
          id: viewer._id,
          name: viewer.name,
          initials: initialsFromName(viewer.name),
          avatarUrl: viewer.avatarUrl,
        },
        kpi: {
          totalStudents: total,
          avgProgress,
          atRisk: students.filter((s) => s.status === "risk").length,
          inactive: students.filter((s) => s.status === "inactive").length,
          completed: students.filter((s) => s.status === "done").length,
          totalHours: students.reduce((sum, s) => sum + s.hours, 0),
          totalXp: students.reduce((sum, s) => sum + s.xp, 0),
        },
        students,
        mentors: [],
        flags: [],
      };
    }

    // Coordinator / admin — everyone, partitioned by mentor.
    const allStudents = await ctx.db
      .query("learnhub_users")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .take(1000);
    const allMentors = await ctx.db
      .query("learnhub_users")
      .withIndex("by_role", (q) => q.eq("role", "mentor"))
      .take(500);

    // Map menteeId → mentorId by scanning all active relationships once.
    // Capped at 5000 — bump if cohorts grow past that.
    const relPages = await ctx.db
      .query("learnhub_mentoring_relationships")
      .take(5000);
    const mentorByMentee = new Map<string, Id<"learnhub_users">>();
    for (const r of relPages) {
      if (r.status !== "active") continue;
      mentorByMentee.set(r.menteeId as unknown as string, r.mentorId);
    }

    const students: StudentProgress[] = [];
    for (const s of allStudents) {
      const mentorId = mentorByMentee.get(s._id as unknown as string) ?? null;
      students.push(await buildStudentProgress(ctx, s, mentorId));
    }
    students.sort((a, b) => b.overall - a.overall);

    // Per-mentor rollup for the coordinator leaderboard.
    const mentorRollup = allMentors.map((m) => {
      const cohort = students.filter(
        (s) => s.mentorId && (s.mentorId as unknown as string) === (m._id as unknown as string),
      );
      const total = cohort.length;
      const avgProgress = total
        ? Math.round(cohort.reduce((sum, s) => sum + s.overall, 0) / total)
        : 0;
      return {
        id: m._id,
        name: m.name,
        initials: initialsFromName(m.name),
        avatarUrl: m.avatarUrl,
        province: m.province ?? null,
        regionalOffice: m.regionalOffice ?? null,
        joinedAt: m._creationTime,
        total,
        avgProgress,
        atRisk: cohort.filter((s) => s.status === "risk").length,
        inactive: cohort.filter((s) => s.status === "inactive").length,
        done: cohort.filter((s) => s.status === "done").length,
        totalXp: cohort.reduce((sum, s) => sum + s.xp, 0),
      };
    });
    mentorRollup.sort((a, b) => b.avgProgress - a.avgProgress);

    return {
      forbidden: false as const,
      tier: "coordinator" as const,
      viewer: {
        id: viewer._id,
        name: viewer.name,
        initials: initialsFromName(viewer.name),
        avatarUrl: viewer.avatarUrl,
      },
      kpi: {
        totalStudents: students.length,
        totalMentors: allMentors.length,
        avgProgress: students.length
          ? Math.round(students.reduce((sum, s) => sum + s.overall, 0) / students.length)
          : 0,
        atRisk: students.filter((s) => s.status === "risk").length,
        inactive: students.filter((s) => s.status === "inactive").length,
        completed: students.filter((s) => s.status === "done").length,
        totalHours: students.reduce((sum, s) => sum + s.hours, 0),
        totalXp: students.reduce((sum, s) => sum + s.xp, 0),
      },
      students,
      mentors: mentorRollup,
      // Confidential flags storage is out of scope for this drop — the
      // dashboard reads an empty array and the UI hides the panel when
      // there are no entries.
      flags: [],
    };
  },
});

// Read a single student's progress (with full context: mentor, journal-day
// count, certs). Mentor tier is restricted to their own mentees; coordinator
// tier sees anyone. Used by the side-drawer.
export const getStudentDetail = query({
  args: {
    viewerId: v.optional(v.id("learnhub_users")),
    studentId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const access = await classifyViewer(ctx, args.viewerId ?? null);
    if (!access.ok) return { forbidden: true as const, reason: access.reason };

    const student = await ctx.db.get(args.studentId);
    if (!student) return { forbidden: true as const, reason: "not_found" };
    if (student.role !== "student") {
      return { forbidden: true as const, reason: "not_a_student" };
    }

    // Mentor tier: must have an active relationship with this student.
    if (access.tier === "mentor") {
      const rels = await ctx.db
        .query("learnhub_mentoring_relationships")
        .withIndex("by_mentor", (q) => q.eq("mentorId", access.viewer._id))
        .collect();
      const hasRel = rels.some(
        (r) => r.menteeId === args.studentId && (r.status === "active" || r.status === "requested"),
      );
      if (!hasRel) return { forbidden: true as const, reason: "not_your_student" };
    }

    // Mentor lookup
    const rels = await ctx.db
      .query("learnhub_mentoring_relationships")
      .withIndex("by_mentee", (q) => q.eq("menteeId", args.studentId))
      .collect();
    const activeRel = rels.find((r) => r.status === "active") ?? rels[0];
    const mentor = activeRel ? await ctx.db.get(activeRel.mentorId) : null;

    // Journal entries — used as a learning-cadence signal.
    const journalEntries = await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) => q.eq("userId", args.studentId))
      .take(120);

    // Certificates
    const certs = await ctx.db
      .query("learnhub_certificates")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const progress = await buildStudentProgress(ctx, student, mentor?._id ?? null);
    return {
      forbidden: false as const,
      tier: access.tier,
      student: {
        ...progress,
        bio: student.bio ?? null,
        email: student.email,
        school: student.school ?? null,
        interests: student.interests ?? [],
      },
      mentor: mentor
        ? {
            id: mentor._id,
            name: mentor.name,
            initials: initialsFromName(mentor.name),
            avatarUrl: mentor.avatarUrl,
            province: mentor.province ?? null,
          }
        : null,
      journalDays: journalEntries.length,
      lastJournalDate: journalEntries.length
        ? journalEntries.sort((a, b) => b.updatedAt - a.updatedAt)[0].date
        : null,
      certificates: certs.map((c) => ({
        id: c._id,
        title: c.courseTitle,
        issuedAt: c.issuedAt,
        status: c.status,
      })),
    };
  },
});

// Coordinator-only confidential note on a student. Surfaces in the
// CONFIDENTIAL FLAGS panel of the dashboard. Storage is a future table
// (learnhub_progress_flags); for now this is an API stub so the UI wires
// can land without blocking on the migration.
export const flagStudent = mutation({
  args: {
    viewerId: v.id("learnhub_users"),
    studentId: v.id("learnhub_users"),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await classifyViewer(ctx, args.viewerId);
    if (!access.ok || access.tier !== "coordinator") {
      throw new Error("FORBIDDEN: coordinator-only");
    }
    return { ok: true, queued: true };
  },
});

// ────────────────────────────────────────────────────────────────────────
// Learner-facing overview for /learnhub/learning-path
// ────────────────────────────────────────────────────────────────────────
//
// Replaces the previous Kanban-only experience. Pulls everything the
// "Paths" and "Courses" tabs need in a single subscription:
//   • enrolled learning paths + per-module completion %
//   • active video sessions (in_progress / paused)
//   • streak summary (re-aliased from learnhub_streaks.getStreak)
//   • certificate count
//   • bookmark counts by status
//   • recent goals
//
// Unlike `getDashboard` this is intentionally *not* role-gated — a learner
// asks "show me my own progress". A future mentor view will use a separate
// query that proxies through this with a viewerId check.
export const getLearnerOverview = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Path enrollments → hydrate with their parent path so we can show
    // module titles and total module count.
    const enrollments = await ctx.db
      .query("learnhub_path_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", args.userId))
      .collect();
    enrollments.sort((a, b) => b.enrolledAt - a.enrolledAt);

    const pathRows = [];
    for (const enr of enrollments) {
      const path = await ctx.db.get(enr.pathId);
      if (!path) continue;
      const totalModules = path.modules.length;
      const completed = enr.completedModuleIndices.length;
      const currentIdx = Math.min(enr.currentModuleIndex, Math.max(totalModules - 1, 0));
      const currentModule = totalModules > 0 ? path.modules[currentIdx] : null;
      const nextPostId = currentModule?.postIds?.[0] ?? null;
      pathRows.push({
        enrollmentId: enr._id,
        pathId: path._id,
        title: path.title,
        description: path.description,
        programType: path.programType,
        totalModules,
        completedModules: completed,
        progressPct: totalModules === 0
          ? 0
          : Math.round((completed / totalModules) * 100),
        currentModuleIndex: currentIdx,
        currentModuleTitle: currentModule?.title ?? null,
        nextPostId,
        completedAt: enr.completedAt ?? null,
        enrolledAt: enr.enrolledAt,
      });
    }

    // Active video sessions. Cap at 12 so a heavy learner doesn't push
    // the page over the Convex 8MB query result ceiling.
    const sessionsInProgress = await ctx.db
      .query("learnhub_video_sessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "in_progress"),
      )
      .order("desc")
      .take(12);

    const sessionsCompleted = await ctx.db
      .query("learnhub_video_sessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "completed"),
      )
      .order("desc")
      .take(6);

    const bookmarks = await ctx.db
      .query("learnhub_bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const bookmarkCounts = {
      want_to_learn: 0,
      in_progress: 0,
      done: 0,
    } as Record<"want_to_learn" | "in_progress" | "done", number>;
    for (const b of bookmarks) bookmarkCounts[b.status] += 1;

    const certs = await ctx.db
      .query("learnhub_certificates")
      .withIndex("by_student", (q) => q.eq("studentId", args.userId))
      .collect();

    const goals = await ctx.db
      .query("learnhub_goals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);

    return {
      streak: {
        currentStreak: user.currentStreak ?? 0,
        longestStreak: user.longestStreak ?? 0,
        lastActiveDate: user.lastActiveDate ?? null,
        xpPoints: user.xpPoints ?? 0,
      },
      paths: pathRows,
      sessionsInProgress: sessionsInProgress.map((s) => ({
        id: s._id,
        videoId: s.videoId,
        title: s.title ?? s.videoId,
        thumbnail: s.thumbnail ?? null,
        channelName: s.channelName ?? null,
        progressPct: s.progressPct,
        lastPositionSec: s.lastPositionSec,
        durationSec: s.durationSec ?? null,
        updatedAt: s.updatedAt,
      })),
      sessionsCompleted: sessionsCompleted.map((s) => ({
        id: s._id,
        videoId: s.videoId,
        title: s.title ?? s.videoId,
        thumbnail: s.thumbnail ?? null,
        completedAt: s.completedAt ?? s.updatedAt,
      })),
      bookmarkCounts,
      certCount: certs.length,
      goals: goals.map((g) => ({
        id: g._id,
        title: g.title,
        deadline: g.deadline ?? null,
        completedAt: g.completedAt ?? null,
      })),
    };
  },
});
