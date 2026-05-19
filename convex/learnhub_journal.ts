import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

// ── Constants ───────────────────────────────────────────────────────────

const MOOD_OPTIONS = ["low", "ok", "good", "great"] as const;
const MOOD_VALIDATOR = v.union(
  v.literal("low"),
  v.literal("ok"),
  v.literal("good"),
  v.literal("great"),
);

// Default prompt bank seeded the first time an admin calls seedPrompts.
// Slugs are stable so re-running seed is idempotent and we can reference
// answered prompts back through promptResponses.promptId.
const DEFAULT_PROMPTS: Array<{
  slug: string; text: string; category: "learning" | "reflection" | "goal" | "mood"; weight: number;
}> = [
  { slug: "today-learn", text: "What's one thing you learned today?", category: "learning", weight: 5 },
  { slug: "today-confused", text: "What confused you, and what would clear it up?", category: "learning", weight: 4 },
  { slug: "apply-monday", text: "How will you apply this on Monday?", category: "learning", weight: 3 },
  { slug: "win-today", text: "What was a small win today?", category: "reflection", weight: 4 },
  { slug: "stuck-where", text: "Where are you stuck, and who could help?", category: "reflection", weight: 3 },
  { slug: "drain-energy", text: "What drained your energy today?", category: "mood", weight: 2 },
  { slug: "next-step", text: "What's the next smallest step on your goal?", category: "goal", weight: 5 },
  { slug: "weekly-theme", text: "If this week had a theme, what would it be?", category: "reflection", weight: 2 },
  { slug: "skill-grow", text: "Which skill do you want to grow this month?", category: "goal", weight: 3 },
  { slug: "gratitude", text: "What's one thing you're grateful for from today?", category: "mood", weight: 2 },
  { slug: "compare-week-ago", text: "What can you do today that you couldn't a week ago?", category: "reflection", weight: 3 },
  { slug: "block-time", text: "When this week will you block focus time to keep momentum?", category: "goal", weight: 2 },
];

// Manila-day formatter — matches the convention in learnhub_streaks.
function manilaDay(): string {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().split("T")[0];
}

// ── Queries ─────────────────────────────────────────────────────────────

export const getEntry = query({
  args: { userId: v.id("learnhub_users"), date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .unique();
  },
});

export const listEntries = query({
  args: { userId: v.id("learnhub_users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 30);
  },
});

/**
 * Pulls the things the editor needs to render the "Today's activity" panel
 * + suggested prompts. Designed for a single subscription on mount so the
 * page doesn't waterfall queries.
 */
export const getDayContext = query({
  args: {
    userId: v.id("learnhub_users"),
    date: v.string(),
    promptCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const take = Math.min(args.promptCount ?? 3, 6);

    // Range filter for today's activity: anything updated between the
    // start (00:00 Manila) and the next-day boundary.
    const dayStart = new Date(args.date + "T00:00:00+08:00").getTime();
    const dayEnd = dayStart + 86_400_000;

    const recentSessions = await ctx.db
      .query("learnhub_video_sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(40);
    const todaySessions = recentSessions.filter((s) =>
      s.updatedAt >= dayStart && s.updatedAt < dayEnd,
    );

    const allBookmarks = await ctx.db
      .query("learnhub_bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const todayBookmarks = allBookmarks.filter((b) =>
      b.updatedAt >= dayStart && b.updatedAt < dayEnd,
    );

    const activePrompts = await ctx.db
      .query("learnhub_journal_prompts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    // Weighted-random selection: each prompt gets `weight` tickets in
    // a virtual lottery, sample `take` distinct tickets. Deterministic
    // within a single render but rotates across renders due to Math.random.
    const tickets: typeof activePrompts = [];
    for (const p of activePrompts) {
      for (let i = 0; i < Math.max(1, p.weight); i++) tickets.push(p);
    }
    const picked: typeof activePrompts = [];
    const seen = new Set<string>();
    while (picked.length < take && tickets.length > 0) {
      const idx = Math.floor(Math.random() * tickets.length);
      const candidate = tickets[idx];
      if (!seen.has(candidate.slug)) {
        seen.add(candidate.slug);
        picked.push(candidate);
      }
      tickets.splice(idx, 1);
    }

    return {
      sessions: todaySessions.map((s) => ({
        id: s._id,
        videoId: s.videoId,
        title: s.title ?? s.videoId,
        thumbnail: s.thumbnail ?? null,
        channelName: s.channelName ?? null,
        progressPct: s.progressPct,
        status: s.status,
      })),
      bookmarks: todayBookmarks.map((b) => ({
        id: b._id,
        postId: b.postId,
        status: b.status,
        updatedAt: b.updatedAt,
      })),
      prompts: picked.map((p) => ({
        slug: p.slug,
        text: p.text,
        category: p.category,
      })),
      manilaToday: manilaDay(),
    };
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const upsertEntry = mutation({
  args: {
    userId: v.id("learnhub_users"),
    date: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    // Optional reflection fields — passed through to storage as-is.
    mood: v.optional(MOOD_VALIDATOR),
    energy: v.optional(v.number()),
    confidence: v.optional(v.number()),
    promptResponses: v.optional(v.array(v.object({
      promptId: v.string(),
      answer: v.string(),
    }))),
    linkedSessionIds: v.optional(v.array(v.id("learnhub_video_sessions"))),
  },
  handler: async (ctx, args) => {
    const wordCount = args.content.trim()
      ? args.content.trim().split(/\s+/).length
      : 0;

    const clampUnit = (n: number | undefined): number | undefined => {
      if (typeof n !== "number") return undefined;
      return Math.max(1, Math.min(5, Math.round(n)));
    };

    const patch = {
      content: args.content,
      tags: args.tags,
      wordCount,
      mood: args.mood,
      energy: clampUnit(args.energy),
      confidence: clampUnit(args.confidence),
      promptResponses: args.promptResponses,
      linkedSessionIds: args.linkedSessionIds,
      updatedAt: Date.now(),
    };

    const existing = await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("learnhub_journal", {
      userId: args.userId,
      date: args.date,
      ...patch,
    });
  },
});

export const deleteEntry = mutation({
  args: { entryId: v.id("learnhub_journal") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
  },
});

/**
 * Idempotent prompt-bank seed. Admin-only. Adds missing slugs and
 * re-activates any pre-existing rows that match by slug.
 */
export const seedPrompts = mutation({
  args: { actorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");
    if (actor.role !== "admin" && actor.role !== "coordinator") {
      throw new Error("FORBIDDEN: only admins or coordinators can seed prompts");
    }
    let added = 0;
    let updated = 0;
    for (const p of DEFAULT_PROMPTS) {
      const existing = await ctx.db
        .query("learnhub_journal_prompts")
        .withIndex("by_slug", (q) => q.eq("slug", p.slug))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          text: p.text,
          category: p.category,
          weight: p.weight,
          isActive: true,
        });
        updated += 1;
      } else {
        await ctx.db.insert("learnhub_journal_prompts", { ...p, isActive: true });
        added += 1;
      }
    }
    return { added, updated };
  },
});

// ── Weekly Groq summary (optional, degrades gracefully) ─────────────────

/**
 * Internal mutation called by the requestWeeklySummary action to patch
 * the user's most-recent entry with the generated insight. Splitting it
 * keeps the action pure-fetch / pure-LLM.
 */
export const _storeWeeklySummary = internalMutation({
  args: {
    userId: v.id("learnhub_users"),
    weekStart: v.string(),
    text: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    if (!recent) return null;
    await ctx.db.patch(recent._id, {
      aiSummary: {
        text: args.text,
        model: args.model,
        weekStart: args.weekStart,
        generatedAt: Date.now(),
      },
    });
    return recent._id;
  },
});

/**
 * Internal query used by the summary action to assemble the last 7 days
 * of entries without giving the action raw db access.
 */
export const _recentForSummary = query({
  args: { userId: v.id("learnhub_users"), weekStart: v.string() },
  handler: async (ctx, args) => {
    const start = new Date(args.weekStart + "T00:00:00+08:00").getTime();
    const all = await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(14);
    return all
      .filter((e) => new Date(e.date + "T00:00:00+08:00").getTime() >= start)
      .map((e) => ({
        date: e.date,
        content: e.content,
        mood: e.mood ?? null,
        energy: e.energy ?? null,
        confidence: e.confidence ?? null,
        wordCount: e.wordCount,
      }));
  },
});

/**
 * Public action: gather the last week's entries and ask Groq for a
 * 4-line insight. No-op when `LEARNHUB_GROQ_API_KEY` is not configured;
 * the UI checks the return value's `status` and renders an informative
 * empty state in that case.
 */
export const requestWeeklySummary = action({
  args: {
    userId: v.id("learnhub_users"),
    weekStart: v.string(),
  },
  handler: async (ctx, args): Promise<
    | { status: "ok"; text: string; model: string }
    | { status: "not_configured" }
    | { status: "no_entries" }
    | { status: "error"; message: string }
  > => {
    if (!process.env.LEARNHUB_GROQ_API_KEY) {
      return { status: "not_configured" };
    }
    const entries: Array<{
      date: string;
      content: string;
      mood: string | null;
      energy: number | null;
      confidence: number | null;
      wordCount: number;
    }> = await ctx.runQuery(api.learnhub_journal._recentForSummary, {
      userId: args.userId,
      weekStart: args.weekStart,
    });
    if (entries.length === 0) {
      return { status: "no_entries" };
    }

    const { groq, CHAT_MODEL } = await import("../lib/learnhub/groq");
    const corpus = entries
      .map((e) => `## ${e.date}${e.mood ? ` · mood:${e.mood}` : ""}\n${e.content}`)
      .join("\n\n");

    try {
      const completion = await groq.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a kind learning coach. Read this week's journal entries and reply with 4 short lines: a recurring theme, a clear win, a friction point, and one concrete suggestion for next week. Use plain language. Don't add headings or bullets — just the four lines.",
          },
          { role: "user", content: corpus.slice(0, 8000) },
        ],
        max_tokens: 320,
        temperature: 0.4,
      });
      const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { status: "error", message: "Empty response" };
      await ctx.runMutation(internal.learnhub_journal._storeWeeklySummary, {
        userId: args.userId,
        weekStart: args.weekStart,
        text,
        model: CHAT_MODEL,
      });
      return { status: "ok", text, model: CHAT_MODEL };
    } catch (e) {
      return { status: "error", message: e instanceof Error ? e.message : String(e) };
    }
  },
});

/**
 * Bootstrap helper: seed the prompt bank without a role check. Callable
 * only via Convex admin-key (i.e. `npx convex run`), never from the
 * browser. Mirrors the public `seedPrompts` behaviour but skips the
 * actor-role gate so a fresh deployment with no admin user yet can still
 * populate prompts.
 */
export const _seedDefaultPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    let added = 0;
    let updated = 0;
    for (const p of DEFAULT_PROMPTS) {
      const existing = await ctx.db
        .query("learnhub_journal_prompts")
        .withIndex("by_slug", (q) => q.eq("slug", p.slug))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          text: p.text,
          category: p.category,
          weight: p.weight,
          isActive: true,
        });
        updated += 1;
      } else {
        await ctx.db.insert("learnhub_journal_prompts", { ...p, isActive: true });
        added += 1;
      }
    }
    return { added, updated };
  },
});

// Silence unused-import warnings for the few types/consts we expose for
// future consumers.
void MOOD_OPTIONS;
void (null as Doc<"learnhub_journal"> | Id<"learnhub_journal"> | null);
