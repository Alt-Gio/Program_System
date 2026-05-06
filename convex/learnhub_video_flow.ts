import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    await addTimelineEvent(ctx, {
      sessionId: args.sessionId,
      userId: args.userId,
      type: args.kind === "question" ? "question" : "note",
      timestampSec: args.timestampSec,
      message: args.kind === "question" ? "Added a timestamped question" : "Added a timestamped note",
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
