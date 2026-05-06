import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listFeedWithAuthors = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("learnhub_posts")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 30);
    return Promise.all(
      posts.map(async (p) => ({
        ...p,
        author: await ctx.db.get(p.authorId),
      }))
    );
  },
});

export const listFeedPosts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_posts")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 30);
  },
});

export const getPost = query({
  args: { id: v.id("learnhub_posts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getPostsByAuthor = query({
  args: { authorId: v.id("learnhub_users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_posts")
      .withIndex("by_author", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const createPost = mutation({
  args: {
    authorId: v.id("learnhub_users"),
    type: v.union(
      v.literal("text"),
      v.literal("youtube"),
      v.literal("video"),
      v.literal("meet"),
      v.literal("drive"),
      v.literal("form"),
      v.literal("opportunity"),
      v.literal("certificate")
    ),
    content: v.string(),
    metadata: v.any(),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("learnhub_posts", {
      ...args,
      likeCount: 0,
      commentCount: 0,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const likePost = mutation({
  args: {
    postId: v.id("learnhub_posts"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_likes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .unique();
    if (existing) return;

    await ctx.db.insert("learnhub_likes", {
      postId: args.postId,
      userId: args.userId,
      createdAt: Date.now(),
    });
    const post = await ctx.db.get(args.postId);
    if (post) {
      await ctx.db.patch(args.postId, { likeCount: post.likeCount + 1 });
    }
  },
});

export const unlikePost = mutation({
  args: {
    postId: v.id("learnhub_posts"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_likes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .unique();
    if (!existing) return;

    await ctx.db.delete(existing._id);
    const post = await ctx.db.get(args.postId);
    if (post) {
      await ctx.db.patch(args.postId, {
        likeCount: Math.max(0, post.likeCount - 1),
      });
    }
  },
});

export const getLikeStatus = query({
  args: {
    postId: v.id("learnhub_posts"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const like = await ctx.db
      .query("learnhub_likes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .unique();
    return like !== null;
  },
});

export const pinPost = mutation({
  args: { postId: v.id("learnhub_posts"), isPinned: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, {
      isPinned: args.isPinned,
      updatedAt: Date.now(),
    });
  },
});

export const deletePost = mutation({
  args: { postId: v.id("learnhub_posts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.postId);
  },
});

// ── Native video uploads via Convex storage ──────────────────────────

export const generateVideoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const getUncompressedVideos = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("learnhub_posts")
      .filter(q =>
        q.and(
          q.eq(q.field("type"), "video"),
          q.neq(q.field("compressed"), true)
        )
      )
      .take(5)
  }
})

export const markVideoCompressed = mutation({
  args: {
    postId: v.id("learnhub_posts"),
    newStorageId: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId)
    if (!post) return
    await ctx.db.patch(args.postId, {
      metadata: {
        ...(post.metadata as Record<string, unknown>),
        storageId: args.newStorageId,
        contentType: args.contentType,
        compressed: true,
      },
      compressed: true,
    })
  }
})

export const getVideoUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  }
})

export const getVideoStorageStats = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("learnhub_posts")
      .filter(q => q.eq(q.field("type"), "video"))
      .collect()

    const total = posts.length
    const compressed = posts.filter(p => p.compressed === true).length
    const uncompressed = total - compressed

    const totalOriginalBytes = posts.reduce((sum, p) => {
      const meta = p.metadata as Record<string, unknown>
      return sum + ((meta?.sizeBytes as number) ?? 0)
    }, 0)

    const videos = posts.map(p => {
      const meta = p.metadata as Record<string, unknown>
      return {
        id: p._id,
        title: (meta?.title as string) ?? (meta?.courseTitle as string) ?? "Untitled",
        storageId: meta?.storageId as string,
        sizeBytes: (meta?.sizeBytes as number) ?? 0,
        compressed: p.compressed ?? false,
        contentType: (meta?.contentType as string) ?? "video/mp4",
        createdAt: p.createdAt,
        content: p.content,
      }
    })

    return { total, compressed, uncompressed, totalOriginalBytes, videos }
  }
})
