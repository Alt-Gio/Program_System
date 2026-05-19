import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { awardLearnHubXp } from "./learnhub_xp";
import { evaluateAndAwardForUser } from "./learnhub_badges";

// Internal: count flashcards due as of a given timestamp for a user. Used by
// the daily learnhub_notifications.notifyFlashcardsDue cron to decide who
// gets a nudge.
export const countDueFlashcards = internalQuery({
  args: {
    userId: v.id("learnhub_users"),
    asOf: v.number(),
  },
  handler: async (ctx, args) => {
    const due = await ctx.db
      .query("learnhub_video_flashcards")
      .withIndex("by_user_due", (q) =>
        q.eq("userId", args.userId).lte("dueAt", args.asOf),
      )
      .collect();
    return due.length;
  },
});

// Public companion of countDueFlashcards used by /learning-path's review
// tile. Returns both the count and the session of the first due card so the
// CTA can deep-link the user straight into a review surface that already
// exists (the per-session video-flow page renders flashcards inline).
export const countMyDueFlashcards = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const due = await ctx.db
      .query("learnhub_video_flashcards")
      .withIndex("by_user_due", (q) =>
        q.eq("userId", args.userId).lte("dueAt", now),
      )
      .collect();
    if (due.length === 0) {
      return { dueCount: 0, firstDueSessionId: null as null };
    }
    // Pick the earliest-due card's session — that's the most "behind" one.
    due.sort((a, b) => a.dueAt - b.dueAt);
    return {
      dueCount: due.length,
      firstDueSessionId: due[0].sessionId,
    };
  },
});

const visibility = v.union(
  v.literal("private"),
  v.literal("mentors"),
  v.literal("learnhub"),
  v.literal("public")
);

const noteKind = v.union(
  v.literal("note"),
  v.literal("question"),
  v.literal("bookmark"),
  v.literal("takeaway")
);

const chatRole = v.union(v.literal("user"), v.literal("assistant"));

const chatCitation = v.object({
  timestampSec: v.number(),
  quote: v.optional(v.string()),
});

async function addTimelineEvent(
  ctx: any,
  args: {
    sessionId: any;
    userId: any;
    type: "started" | "progress" | "note" | "question" | "summary" | "quiz" | "completed" | "shared" | "exported";
    timestampSec?: number;
    message: string;
  }
) {
  const doc: Record<string, unknown> = {
    sessionId: args.sessionId,
    userId: args.userId,
    type: args.type,
    message: args.message,
    createdAt: Date.now(),
  };
  if (args.timestampSec !== undefined) doc.timestampSec = args.timestampSec;
  return await ctx.db.insert("learnhub_video_timeline_events", doc);
}

export const getOrCreateSession = mutation({
  args: {
    userId: v.id("learnhub_users"),
    postId: v.optional(v.id("learnhub_posts")),
    videoId: v.string(),
    sourceUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    channelName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_video_sessions")
      .withIndex("by_user_video", (q) =>
        q.eq("userId", args.userId).eq("videoId", args.videoId)
      )
      .first();

    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: Date.now() };
      if (args.postId && !existing.postId) patch.postId = args.postId;
      if (args.sourceUrl && !existing.sourceUrl) patch.sourceUrl = args.sourceUrl;
      if (args.title && !existing.title) patch.title = args.title;
      if (args.thumbnail && !existing.thumbnail) patch.thumbnail = args.thumbnail;
      if (args.channelName && !existing.channelName) patch.channelName = args.channelName;
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert("learnhub_video_sessions", {
      userId: args.userId,
      videoId: args.videoId,
      status: "not_started",
      lastPositionSec: 0,
      progressPct: 0,
      visibility: "private",
      createdAt: now,
      updatedAt: now,
      ...(args.postId !== undefined ? { postId: args.postId } : {}),
      ...(args.sourceUrl !== undefined ? { sourceUrl: args.sourceUrl } : {}),
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.thumbnail !== undefined ? { thumbnail: args.thumbnail } : {}),
      ...(args.channelName !== undefined ? { channelName: args.channelName } : {}),
    });

    await addTimelineEvent(ctx, {
      sessionId,
      userId: args.userId,
      type: "started",
      message: "Started Video Flow session",
    });

    return sessionId;
  },
});

export const getSessionBundle = query({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const notes = await ctx.db
      .query("learnhub_video_notes")
      .withIndex("by_session_timestamp", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const timeline = await ctx.db
      .query("learnhub_video_timeline_events")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return { session, notes, timeline };
  },
});

export const listMySessions = query({
  args: {
    userId: v.id("learnhub_users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_video_sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 12);
  },
});

export const updateProgress = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    lastPositionSec: v.number(),
    durationSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const duration = args.durationSec ?? session.durationSec ?? 0;
    const progressPct = duration > 0
      ? Math.min(100, Math.max(0, Math.round((args.lastPositionSec / duration) * 100)))
      : session.progressPct;
    const status = progressPct >= 95 ? "completed" : progressPct > 0 ? "in_progress" : session.status;
    const patch: Record<string, unknown> = {
      lastPositionSec: Math.max(0, args.lastPositionSec),
      progressPct,
      status,
      updatedAt: Date.now(),
    };
    if (duration > 0) patch.durationSec = duration;
    if (status === "completed" && !session.completedAt) {
      patch.completedAt = Date.now();
      await addTimelineEvent(ctx, {
        sessionId: args.sessionId,
        userId: args.userId,
        type: "completed",
        timestampSec: args.lastPositionSec,
        message: "Marked video as completed",
      });
      // Award XP exactly once per session — the idempotency key contains the
      // session id, so re-emitting updateProgress with status=completed (e.g.
      // from a paused-and-resumed player at 100%) won't double-credit.
      await awardLearnHubXp(ctx, {
        userId: args.userId,
        amount: 30,
        reason: "Completed a learning video",
        sourceType: "video_completion",
        sourceId: args.sessionId,
        idempotencyKey: `video_completion:${args.sessionId}`,
      });
    }
    await ctx.db.patch(args.sessionId, patch);
    return { progressPct, status };
  },
});

export const markCompleted = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const now = Date.now();
    const justCompleted = !session.completedAt;
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      progressPct: 100,
      completedAt: session.completedAt ?? now,
      updatedAt: now,
    });
    await addTimelineEvent(ctx, {
      sessionId: args.sessionId,
      userId: args.userId,
      type: "completed",
      message: "Completed Video Flow session",
    });
    if (justCompleted) {
      await awardLearnHubXp(ctx, {
        userId: args.userId,
        amount: 30,
        reason: "Completed a learning video",
        sourceType: "video_completion",
        sourceId: args.sessionId,
        idempotencyKey: `video_completion:${args.sessionId}`,
      });
    }
    return true;
  },
});

export const updateSummary = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    summary: v.optional(v.string()),
    aiSummary: v.optional(v.any()),
    takeaways: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.summary !== undefined) patch.summary = args.summary;
    if (args.aiSummary !== undefined) patch.aiSummary = args.aiSummary;
    if (args.takeaways !== undefined) patch.takeaways = args.takeaways;
    await ctx.db.patch(args.sessionId, patch);
    await addTimelineEvent(ctx, {
      sessionId: args.sessionId,
      userId: args.userId,
      type: "summary",
      message: args.aiSummary ? "Generated AI summary" : "Updated session summary",
    });
    return true;
  },
});

export const setVisibility = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    visibility,
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const now = Date.now();
    const patch: Record<string, unknown> = {
      visibility: args.visibility,
      updatedAt: now,
    };
    if (args.visibility !== "private") patch.sharedAt = now;
    await ctx.db.patch(args.sessionId, patch);
    await addTimelineEvent(ctx, {
      sessionId: args.sessionId,
      userId: args.userId,
      type: "shared",
      message: args.visibility === "private" ? "Timeline set to private" : `Timeline shared as ${args.visibility}`,
    });
    return true;
  },
});

export const createNote = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    timestampSec: v.number(),
    content: v.string(),
    kind: noteKind,
    label: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const now = Date.now();
    const noteId = await ctx.db.insert("learnhub_video_notes", {
      sessionId: args.sessionId,
      userId: args.userId,
      timestampSec: Math.max(0, args.timestampSec),
      content: args.content,
      kind: args.kind,
      isShared: args.isShared ?? false,
      createdAt: now,
      updatedAt: now,
      ...(args.label !== undefined ? { label: args.label } : {}),
    });
    return noteId;
  },
});

export const updateNote = mutation({
  args: {
    noteId: v.id("learnhub_video_notes"),
    userId: v.id("learnhub_users"),
    content: v.string(),
    label: v.optional(v.string()),
    isShared: v.boolean(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== args.userId) return null;
    const patch: Record<string, unknown> = {
      content: args.content,
      isShared: args.isShared,
      updatedAt: Date.now(),
    };
    if (args.label !== undefined) patch.label = args.label;
    await ctx.db.patch(args.noteId, patch);
    return true;
  },
});

export const setNoteTags = mutation({
  args: {
    noteId: v.id("learnhub_video_notes"),
    userId: v.id("learnhub_users"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== args.userId) return null;
    const cleaned = Array.from(
      new Set(args.tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0 && t.length <= 24))
    ).slice(0, 8);
    await ctx.db.patch(args.noteId, { tags: cleaned, updatedAt: Date.now() });
    return cleaned;
  },
});

export const deleteNote = mutation({
  args: {
    noteId: v.id("learnhub_video_notes"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== args.userId) return null;
    await ctx.db.delete(args.noteId);
    return true;
  },
});

export const listChatMessages = query({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return [];
    return await ctx.db
      .query("learnhub_video_chat_messages")
      .withIndex("by_session_created", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const appendChatMessage = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    role: chatRole,
    content: v.string(),
    citations: v.optional(v.array(chatCitation)),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const trimmed = args.content.trim().slice(0, 6000);
    if (!trimmed) return null;
    const doc: Record<string, unknown> = {
      sessionId: args.sessionId,
      userId: args.userId,
      role: args.role,
      content: trimmed,
      createdAt: Date.now(),
    };
    if (args.citations && args.citations.length > 0) doc.citations = args.citations.slice(0, 12);
    return await ctx.db.insert("learnhub_video_chat_messages", doc as any);
  },
});

export const clearChatMessages = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const msgs = await ctx.db
      .query("learnhub_video_chat_messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    return msgs.length;
  },
});

// === Flashcards (SM-2) ===

const DAY_MS = 24 * 60 * 60 * 1000;

export const createFlashcard = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    front: v.string(),
    back: v.string(),
    sourceNoteId: v.optional(v.id("learnhub_video_notes")),
    timestampSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const front = args.front.trim().slice(0, 400);
    const back = args.back.trim().slice(0, 1200);
    if (!front || !back) return null;
    const now = Date.now();
    const doc: Record<string, unknown> = {
      sessionId: args.sessionId,
      userId: args.userId,
      front,
      back,
      ease: 2.5,
      intervalDays: 0,
      reviewCount: 0,
      dueAt: now,
      createdAt: now,
      updatedAt: now,
    };
    if (args.sourceNoteId) doc.sourceNoteId = args.sourceNoteId;
    if (args.timestampSec !== undefined) doc.timestampSec = Math.max(0, args.timestampSec);
    return await ctx.db.insert("learnhub_video_flashcards", doc as any);
  },
});

export const listSessionFlashcards = query({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return [];
    return await ctx.db
      .query("learnhub_video_flashcards")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const reviewFlashcard = mutation({
  args: {
    cardId: v.id("learnhub_video_flashcards"),
    userId: v.id("learnhub_users"),
    rating: v.union(v.literal("hard"), v.literal("good"), v.literal("easy")),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card || card.userId !== args.userId) return null;
    const now = Date.now();
    const quality = args.rating === "hard" ? 2 : args.rating === "good" ? 4 : 5;
    let ease = card.ease;
    let interval = card.intervalDays;
    let reviewCount = card.reviewCount;

    if (quality < 3) {
      reviewCount = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    } else {
      if (reviewCount === 0) interval = 1;
      else if (reviewCount === 1) interval = 6;
      else interval = Math.max(1, Math.round(interval * ease));
      ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      ease = Math.max(1.3, Math.min(3.0, ease));
      if (quality === 5) interval = Math.max(interval, Math.round(interval * 1.3));
      reviewCount += 1;
    }

    await ctx.db.patch(args.cardId, {
      ease,
      intervalDays: interval,
      reviewCount,
      dueAt: now + interval * DAY_MS,
      lastReviewedAt: now,
      updatedAt: now,
    });
    // Award a small XP grant per review. Idempotency uses (cardId, now)
    // bucketed to the minute so rapid-fire identical clicks within a minute
    // (e.g. accidental double-tap) don't double-credit, but legitimate
    // re-reviews tomorrow do.
    const minuteBucket = Math.floor(now / 60000);
    await awardLearnHubXp(ctx, {
      userId: args.userId,
      amount: 5,
      reason: "Reviewed a flashcard",
      sourceType: "flashcard_review",
      sourceId: args.cardId,
      idempotencyKey: `flashcard_review:${args.cardId}:${minuteBucket}`,
    });

    // May have just hit the Knowledge Builder threshold (50 reviews).
    await evaluateAndAwardForUser(ctx, args.userId);
    return { interval, ease, reviewCount };
  },
});

export const deleteFlashcard = mutation({
  args: {
    cardId: v.id("learnhub_video_flashcards"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card || card.userId !== args.userId) return null;
    await ctx.db.delete(args.cardId);
    return true;
  },
});

// === Quiz ===

const quizQuestion = v.object({
  question: v.string(),
  choices: v.array(v.string()),
  answerIndex: v.number(),
  explanation: v.optional(v.string()),
  timestampSec: v.optional(v.number()),
});

export const saveQuiz = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    questions: v.array(quizQuestion),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    const now = Date.now();
    const existing = await ctx.db
      .query("learnhub_video_quizzes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        questions: args.questions,
        generatedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("learnhub_video_quizzes", {
      sessionId: args.sessionId,
      userId: args.userId,
      questions: args.questions,
      attempts: 0,
      generatedAt: now,
      updatedAt: now,
    });
  },
});

export const getSessionQuiz = query({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    return await ctx.db
      .query("learnhub_video_quizzes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const recordQuizAttempt = mutation({
  args: {
    quizId: v.id("learnhub_video_quizzes"),
    userId: v.id("learnhub_users"),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.userId !== args.userId) return null;
    const score = Math.max(0, Math.min(100, Math.round(args.score)));
    const next: Record<string, unknown> = {
      attempts: quiz.attempts + 1,
      lastAttemptAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (quiz.bestScore === undefined || score > quiz.bestScore) next.bestScore = score;
    await ctx.db.patch(args.quizId, next);
    if (score >= 70) {
      await addTimelineEvent(ctx, {
        sessionId: quiz.sessionId,
        userId: args.userId,
        type: "quiz",
        message: `Passed quiz with ${score}%`,
      });
    }
    return { bestScore: (next.bestScore as number | undefined) ?? quiz.bestScore, score };
  },
});

export const logExportEvent = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    await addTimelineEvent(ctx, {
      sessionId: args.sessionId,
      userId: args.userId,
      type: "exported",
      message: "Exported study pack",
    });
    return true;
  },
});

export const getSharedTimeline = query({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    viewerId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    const isOwner = args.viewerId && session.userId === args.viewerId;
    if (!isOwner && session.visibility === "private") return null;
    const owner = await ctx.db.get(session.userId);
    const allNotes = await ctx.db
      .query("learnhub_video_notes")
      .withIndex("by_session_timestamp", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const notes = isOwner ? allNotes : allNotes.filter((note) => note.isShared);
    const timeline = await ctx.db
      .query("learnhub_video_timeline_events")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return { session, owner, notes, timeline };
  },
});
