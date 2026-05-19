/**
 * /learnhub/today aggregator. One query returns the entire dashboard
 * payload so the landing renders without 6+ parallel `useQuery` calls.
 *
 * Reuses logic from elsewhere where practical (habit-grid math from
 * learnhub_habits, mentor expertise/interest match from learnhub_mentors,
 * journal prompts from learnhub_journal). Lives in its own file purely
 * because the composition cuts across subsystems and shouldn't live in
 * any single one.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function manilaDay(now = Date.now()): string {
  const d = new Date(now + 8 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function manilaWeekStart(now = Date.now()): string {
  const d = new Date(now + 8 * 60 * 60 * 1000);
  const day = d.getUTCDay(); // 0..6 with Sun=0
  const diffToMonday = (day + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

export const getDashboard = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const today = manilaDay();
    const weekStart = manilaWeekStart();
    const now = Date.now();

    // ── Habits: today's column from the same week-grid logic learnhub_habits uses.
    const habits = await ctx.db
      .query("learnhub_habits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const activeHabits = habits.filter((h) => h.archivedAt === undefined);
    const todaysLogs = await ctx.db
      .query("learnhub_habit_logs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", today),
      )
      .collect();
    const logsByHabit = new Map<string, number>();
    for (const l of todaysLogs) logsByHabit.set(l.habitId as string, l.count);

    const habitsToday = activeHabits.map((h) => ({
      id: h._id,
      slug: h.slug,
      label: h.label,
      emoji: h.emoji,
      targetPerWeek: h.targetPerWeek,
      countToday: logsByHabit.get(h._id as string) ?? 0,
    }));

    // ── Due flashcards (count + earliest-due session for the CTA deep link).
    const dueCards = await ctx.db
      .query("learnhub_video_flashcards")
      .withIndex("by_user_due", (q) =>
        q.eq("userId", args.userId).lte("dueAt", now),
      )
      .collect();
    dueCards.sort((a, b) => a.dueAt - b.dueAt);
    const flashcardsDue = {
      count: dueCards.length,
      firstDueSessionId:
        dueCards.length > 0 ? (dueCards[0].sessionId as string) : null,
      previews: dueCards.slice(0, 3).map((c) => ({
        id: c._id,
        front: c.front.slice(0, 120),
      })),
    };

    // ── Journal prompt for today (rotating). Single weighted pick.
    const prompts = await ctx.db
      .query("learnhub_journal_prompts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    let prompt: { slug: string; text: string; category: string } | null = null;
    if (prompts.length > 0) {
      const tickets: typeof prompts = [];
      for (const p of prompts) {
        for (let i = 0; i < Math.max(1, p.weight); i++) tickets.push(p);
      }
      const pick = tickets[Math.floor(Math.random() * tickets.length)];
      prompt = { slug: pick.slug, text: pick.text, category: pick.category };
    }

    // ── Continue learning: first active enrollment with an incomplete module.
    const enrollments = await ctx.db
      .query("learnhub_path_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", args.userId))
      .collect();
    const activeEnrollment = enrollments.find(
      (e) => e.completedAt === undefined,
    );
    let continueLearning: {
      enrollmentId: string;
      pathId: string;
      pathTitle: string;
      completedModules: number;
      totalModules: number;
    } | null = null;
    if (activeEnrollment) {
      const path = await ctx.db.get(activeEnrollment.pathId);
      if (path) {
        continueLearning = {
          enrollmentId: activeEnrollment._id as string,
          pathId: activeEnrollment.pathId as string,
          pathTitle: path.title,
          completedModules: activeEnrollment.completedModuleIndices?.length ?? 0,
          totalModules: path.modules?.length ?? 0,
        };
      }
    }

    // ── Recommended mentors: verified, expertise overlaps user.interests.
    const userTags = new Set(
      (user.interests ?? []).map(normalize).filter((t) => t.length > 0),
    );
    let recommendedMentors: Array<{
      id: string;
      name: string;
      avatarUrl: string;
      designation: string | null;
      expertiseTags: string[];
      overlap: number;
    }> = [];
    if (userTags.size > 0) {
      const mentors = await ctx.db
        .query("learnhub_users")
        .withIndex("by_role", (q) => q.eq("role", "mentor"))
        .collect();
      const scored = mentors
        .filter((m) => m.mentorStatus === "verified")
        .map((m) => {
          const mTags = (m.expertiseTags ?? []).concat(m.interests ?? []);
          const normTags = new Set(
            mTags.map(normalize).filter((t) => t.length > 0),
          );
          let overlap = 0;
          for (const t of userTags) if (normTags.has(t)) overlap++;
          return { mentor: m, overlap };
        })
        .filter((x) => x.overlap > 0);
      scored.sort((a, b) => b.overlap - a.overlap);
      recommendedMentors = scored.slice(0, 2).map((x) => ({
        id: x.mentor._id as string,
        name: x.mentor.name,
        avatarUrl: x.mentor.avatarUrl,
        designation: x.mentor.designation ?? null,
        expertiseTags: x.mentor.expertiseTags ?? [],
        overlap: x.overlap,
      }));
    }

    // ── Fresh feed: top 3 recent posts that match any user hashtag/interest,
    //   falling back to the absolute most-recent posts if there's no match.
    const recent = await ctx.db
      .query("learnhub_posts")
      .withIndex("by_created")
      .order("desc")
      .take(40);
    type ScoredPost = { post: Doc<"learnhub_posts">; score: number };
    const scoredPosts: ScoredPost[] = recent.map((p) => {
      const tags = (p.hashtags ?? []).concat(p.tags ?? []);
      let score = 0;
      for (const t of tags) if (userTags.has(normalize(t))) score++;
      return { post: p, score };
    });
    const matched = scoredPosts.filter((s) => s.score > 0);
    matched.sort((a, b) => b.score - a.score || b.post.createdAt - a.post.createdAt);
    const filler = scoredPosts
      .filter((s) => s.score === 0)
      .sort((a, b) => b.post.createdAt - a.post.createdAt);
    const freshPicks = [...matched, ...filler].slice(0, 3);

    const freshPosts = await Promise.all(
      freshPicks.map(async ({ post }) => {
        const author = await ctx.db.get(post.authorId);
        return {
          id: post._id as string,
          type: post.type,
          content: post.content.slice(0, 180),
          authorName: author?.name ?? "Unknown",
          authorAvatar: author?.avatarUrl ?? "",
          createdAt: post.createdAt,
        };
      }),
    );

    return {
      user: {
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      streak: {
        current: user.currentStreak ?? 0,
        longest: user.longestStreak ?? 0,
      },
      today,
      weekStart,
      habitsToday,
      flashcardsDue,
      prompt,
      continueLearning,
      recommendedMentors,
      freshPosts,
    };
  },
});
