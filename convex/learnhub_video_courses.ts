import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const visibility = v.union(
  v.literal("private"),
  v.literal("learnhub"),
  v.literal("public")
);

const status = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("archived")
);

export const createCourse = mutation({
  args: {
    ownerId: v.id("learnhub_users"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim().slice(0, 120);
    if (!title) return null;
    const now = Date.now();
    const doc: Record<string, unknown> = {
      ownerId: args.ownerId,
      title,
      visibility: "private" as const,
      status: "active" as const,
      itemCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (args.description) doc.description = args.description.trim().slice(0, 800);
    return await ctx.db.insert("learnhub_video_courses", doc as any);
  },
});

export const listMyCourses = query({
  args: { ownerId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_video_courses")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .collect();
  },
});

export const getCourseWithProgress = query({
  args: {
    courseId: v.id("learnhub_video_courses"),
    viewerId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return null;
    const isOwner = args.viewerId && course.ownerId === args.viewerId;
    if (!isOwner && course.visibility === "private") return null;

    const items = await ctx.db
      .query("learnhub_video_course_items")
      .withIndex("by_course_position", (q) => q.eq("courseId", args.courseId))
      .collect();
    items.sort((a, b) => a.position - b.position);

    const owner = await ctx.db.get(course.ownerId);

    let progressByVideoId: Record<string, { progressPct: number; lastPositionSec: number; sessionId: string; status: string }> = {};
    if (args.viewerId) {
      for (const item of items) {
        const session = await ctx.db
          .query("learnhub_video_sessions")
          .withIndex("by_user_video", (q) => q.eq("userId", args.viewerId!).eq("videoId", item.videoId))
          .first();
        if (session) {
          progressByVideoId[item.videoId] = {
            progressPct: session.progressPct,
            lastPositionSec: session.lastPositionSec,
            sessionId: session._id,
            status: session.status,
          };
        }
      }
    }

    const totalProgress = items.length === 0
      ? 0
      : Math.round(
          items.reduce((acc, it) => acc + (progressByVideoId[it.videoId]?.progressPct ?? 0), 0) / items.length
        );

    const completed = items.filter((it) => (progressByVideoId[it.videoId]?.progressPct ?? 0) >= 95).length;

    return {
      course,
      items,
      owner: owner ? { name: (owner as any).name, avatarUrl: (owner as any).avatarUrl } : null,
      progressByVideoId,
      totalProgress,
      completedCount: completed,
    };
  },
});

export const updateCourseMeta = mutation({
  args: {
    courseId: v.id("learnhub_video_courses"),
    ownerId: v.id("learnhub_users"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(visibility),
    status: v.optional(status),
    coverImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course || course.ownerId !== args.ownerId) return null;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title.trim().slice(0, 120);
    if (args.description !== undefined) patch.description = args.description.trim().slice(0, 800);
    if (args.visibility !== undefined) patch.visibility = args.visibility;
    if (args.status !== undefined) patch.status = args.status;
    if (args.coverImageUrl !== undefined) patch.coverImageUrl = args.coverImageUrl;
    await ctx.db.patch(args.courseId, patch);
    return true;
  },
});

export const deleteCourse = mutation({
  args: {
    courseId: v.id("learnhub_video_courses"),
    ownerId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course || course.ownerId !== args.ownerId) return null;
    const items = await ctx.db
      .query("learnhub_video_course_items")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    for (const it of items) await ctx.db.delete(it._id);
    await ctx.db.delete(args.courseId);
    return true;
  },
});

export const addCourseItem = mutation({
  args: {
    courseId: v.id("learnhub_video_courses"),
    ownerId: v.id("learnhub_users"),
    videoId: v.string(),
    title: v.optional(v.string()),
    channelName: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    itemNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course || course.ownerId !== args.ownerId) return null;
    const existing = await ctx.db
      .query("learnhub_video_course_items")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    if (existing.some((it) => it.videoId === args.videoId)) return existing.find((it) => it.videoId === args.videoId)?._id ?? null;
    const now = Date.now();
    const position = existing.length === 0 ? 0 : Math.max(...existing.map((it) => it.position)) + 1;
    const doc: Record<string, unknown> = {
      courseId: args.courseId,
      ownerId: args.ownerId,
      videoId: args.videoId,
      position,
      createdAt: now,
      updatedAt: now,
    };
    if (args.title) doc.title = args.title.slice(0, 200);
    if (args.channelName) doc.channelName = args.channelName.slice(0, 120);
    if (args.thumbnail) doc.thumbnail = args.thumbnail.slice(0, 400);
    if (args.itemNote) doc.itemNote = args.itemNote.slice(0, 600);
    const itemId = await ctx.db.insert("learnhub_video_course_items", doc as any);
    await ctx.db.patch(args.courseId, {
      itemCount: existing.length + 1,
      updatedAt: now,
    });
    return itemId;
  },
});

export const removeCourseItem = mutation({
  args: {
    itemId: v.id("learnhub_video_course_items"),
    ownerId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.ownerId !== args.ownerId) return null;
    await ctx.db.delete(args.itemId);
    const remaining = await ctx.db
      .query("learnhub_video_course_items")
      .withIndex("by_course", (q) => q.eq("courseId", item.courseId))
      .collect();
    await ctx.db.patch(item.courseId, {
      itemCount: remaining.length,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const reorderCourseItems = mutation({
  args: {
    courseId: v.id("learnhub_video_courses"),
    ownerId: v.id("learnhub_users"),
    orderedItemIds: v.array(v.id("learnhub_video_course_items")),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course || course.ownerId !== args.ownerId) return null;
    const now = Date.now();
    for (let i = 0; i < args.orderedItemIds.length; i += 1) {
      const item = await ctx.db.get(args.orderedItemIds[i]);
      if (!item || item.courseId !== args.courseId) continue;
      await ctx.db.patch(args.orderedItemIds[i], { position: i, updatedAt: now });
    }
    await ctx.db.patch(args.courseId, { updatedAt: now });
    return true;
  },
});

export const listCoursesContainingVideo = query({
  args: {
    ownerId: v.id("learnhub_users"),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("learnhub_video_course_items")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    return items
      .filter((it) => it.videoId === args.videoId)
      .map((it) => ({ courseId: it.courseId, itemId: it._id }));
  },
});
