import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_EMOJIS = ["👍", "❤️", "🙋", "⭐", "💡", "🤔"];

const VIEWER_ACTIVE_MS = 60 * 1000;

async function viewerCanAccess(ctx: any, sessionId: any, viewerId?: any) {
  const session = await ctx.db.get(sessionId);
  if (!session) return null;
  if (viewerId && session.userId === viewerId) return { session, canEdit: true };
  if (session.visibility === "private") return null;
  if (session.visibility === "learnhub" && !viewerId) return null;
  return { session, canEdit: false };
}

// === Comments ===

export const listNoteComments = query({
  args: {
    noteId: v.id("learnhub_video_notes"),
    viewerId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return [];
    const access = await viewerCanAccess(ctx, note.sessionId, args.viewerId);
    if (!access) return [];
    const comments = await ctx.db
      .query("learnhub_video_note_comments")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();
    comments.sort((a, b) => a.createdAt - b.createdAt);
    const authorIds = Array.from(new Set(comments.map((c) => c.authorId)));
    const authors: Record<string, { name: string; avatarUrl?: string }> = {};
    for (const id of authorIds) {
      const user = await ctx.db.get(id);
      if (user) authors[id] = { name: (user as any).name, avatarUrl: (user as any).avatarUrl };
    }
    return comments.map((c) => ({
      _id: c._id,
      content: c.content,
      authorId: c.authorId,
      author: authors[c.authorId] ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },
});

export const addNoteComment = mutation({
  args: {
    noteId: v.id("learnhub_video_notes"),
    authorId: v.id("learnhub_users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return null;
    const access = await viewerCanAccess(ctx, note.sessionId, args.authorId);
    if (!access) return null;
    const trimmed = args.content.trim().slice(0, 1500);
    if (!trimmed) return null;
    const now = Date.now();
    return await ctx.db.insert("learnhub_video_note_comments", {
      sessionId: note.sessionId,
      noteId: args.noteId,
      authorId: args.authorId,
      content: trimmed,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteNoteComment = mutation({
  args: {
    commentId: v.id("learnhub_video_note_comments"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) return null;
    const session = await ctx.db.get(comment.sessionId);
    if (!session) return null;
    const isAuthor = comment.authorId === args.userId;
    const isSessionOwner = session.userId === args.userId;
    if (!isAuthor && !isSessionOwner) return null;
    await ctx.db.delete(args.commentId);
    return true;
  },
});

// === Reactions ===

export const listNoteReactions = query({
  args: {
    noteId: v.id("learnhub_video_notes"),
    viewerId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return null;
    const access = await viewerCanAccess(ctx, note.sessionId, args.viewerId);
    if (!access) return null;
    const reactions = await ctx.db
      .query("learnhub_video_note_reactions")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();
    const counts: Record<string, number> = {};
    const myEmojis = new Set<string>();
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (args.viewerId && r.userId === args.viewerId) myEmojis.add(r.emoji);
    }
    return { counts, mine: Array.from(myEmojis) };
  },
});

export const toggleNoteReaction = mutation({
  args: {
    noteId: v.id("learnhub_video_notes"),
    userId: v.id("learnhub_users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    if (!ALLOWED_EMOJIS.includes(args.emoji)) return null;
    const note = await ctx.db.get(args.noteId);
    if (!note) return null;
    const access = await viewerCanAccess(ctx, note.sessionId, args.userId);
    if (!access) return null;
    const existing = await ctx.db
      .query("learnhub_video_note_reactions")
      .withIndex("by_note_user_emoji", (q) =>
        q.eq("noteId", args.noteId).eq("userId", args.userId).eq("emoji", args.emoji)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { added: false };
    }
    await ctx.db.insert("learnhub_video_note_reactions", {
      sessionId: note.sessionId,
      noteId: args.noteId,
      userId: args.userId,
      emoji: args.emoji,
      createdAt: Date.now(),
    });
    return { added: true };
  },
});

// === Viewer presence ===

export const pingViewer = mutation({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    currentSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await viewerCanAccess(ctx, args.sessionId, args.userId);
    if (!access) return null;
    const session = access.session;
    const now = Date.now();
    const patch: Record<string, unknown> = { lastPingAt: now };
    patch.videoId = session.videoId;
    if (args.currentSec !== undefined) {
      patch.currentSec = Math.max(0, Math.floor(args.currentSec));
    }
    const existing = await ctx.db
      .query("learnhub_video_viewers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", args.userId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("learnhub_video_viewers", {
      sessionId: args.sessionId,
      userId: args.userId,
      videoId: session.videoId,
      currentSec: args.currentSec !== undefined ? Math.max(0, Math.floor(args.currentSec)) : undefined,
      lastPingAt: now,
    });
  },
});

export const listSharedViewersForVideo = query({
  args: {
    videoId: v.string(),
    viewerId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - VIEWER_ACTIVE_MS;
    const viewers = await ctx.db
      .query("learnhub_video_viewers")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .collect();
    const out: {
      userId: string;
      sessionId: string;
      currentSec: number;
      progressPct: number;
      durationSec?: number;
      isSelf: boolean;
      name: string;
      avatarUrl?: string;
      lastPingAt: number;
    }[] = [];
    for (const viewer of viewers) {
      if (viewer.lastPingAt < cutoff) continue;
      const session = await ctx.db.get(viewer.sessionId);
      if (!session) continue;
      const isSelf = args.viewerId !== undefined && session.userId === args.viewerId;
      // Only surface non-private sessions, OR the viewer's own pings
      if (session.visibility === "private" && !isSelf) continue;
      const user = await ctx.db.get(viewer.userId);
      if (!user) continue;
      out.push({
        userId: viewer.userId,
        sessionId: viewer.sessionId,
        currentSec: viewer.currentSec ?? session.lastPositionSec,
        progressPct: session.progressPct,
        durationSec: session.durationSec,
        isSelf,
        name: (user as any).name,
        avatarUrl: (user as any).avatarUrl,
        lastPingAt: viewer.lastPingAt,
      });
    }
    out.sort((a, b) => b.lastPingAt - a.lastPingAt);
    return out;
  },
});

export const listActiveViewers = query({
  args: {
    sessionId: v.id("learnhub_video_sessions"),
    viewerId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const access = await viewerCanAccess(ctx, args.sessionId, args.viewerId);
    if (!access) return [];
    const cutoff = Date.now() - VIEWER_ACTIVE_MS;
    const viewers = await ctx.db
      .query("learnhub_video_viewers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const active = viewers.filter((v) => v.lastPingAt >= cutoff);
    const out: { userId: string; name: string; avatarUrl?: string; lastPingAt: number }[] = [];
    for (const viewer of active) {
      const user = await ctx.db.get(viewer.userId);
      if (user) {
        out.push({
          userId: viewer.userId,
          name: (user as any).name,
          avatarUrl: (user as any).avatarUrl,
          lastPingAt: viewer.lastPingAt,
        });
      }
    }
    out.sort((a, b) => b.lastPingAt - a.lastPingAt);
    return out;
  },
});
