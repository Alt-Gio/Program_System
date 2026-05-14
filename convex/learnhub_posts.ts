import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Pure scoring pass over the latest N posts. Higher score floats up; ties break
// on createdAt-desc (stable sort because we use a stable sort fn). Not ML — a
// small, transparent function that's easy to tune. Keep it pure.
type ScorablePost = {
  tags?: string[];
  type?: string;
  authorId?: unknown;
  createdAt?: number;
};

type ScorableViewer = {
  interests?: string[];
  skillLevels?: Record<string, string>;
  goals?: string[];
  province?: string;
} | null;

function scorePostForViewer(
  post: ScorablePost,
  viewer: ScorableViewer,
  authorProvince: string | null,
): number {
  if (!viewer) return 0;
  let score = 0;

  const interestSet = viewer.interests ? new Set(viewer.interests) : null;
  if (interestSet && post.tags && post.tags.length > 0) {
    for (const t of post.tags) {
      if (!interestSet.has(t)) continue;
      score += 3;
      // Extra weight for areas the viewer is growing in — surface learning
      // content for beginner/intermediate over content they've already
      // mastered.
      const level = viewer.skillLevels?.[t];
      if (level === "beginner" || level === "intermediate") score += 1;
    }
  }

  const goalSet = viewer.goals ? new Set(viewer.goals) : null;
  if (goalSet) {
    if (post.type === "opportunity" && goalSet.has("find_work")) score += 2;
    if (post.type === "certificate" && goalSet.has("build_portfolio")) score += 2;
  }

  if (viewer.province && authorProvince && viewer.province === authorProvince) {
    score += 1;
  }

  return score;
}

export const listFeedWithAuthors = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("learnhub_posts")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 30);
    const viewer = args.userId ? await ctx.db.get(args.userId) : null;

    // Resolve authors once, then score posts using author province for the
    // local-bonus rule. We need this lookup anyway to attach `.author` below.
    const withAuthors = await Promise.all(
      posts.map(async (p) => ({
        ...p,
        author: await ctx.db.get(p.authorId),
      })),
    );

    if (!viewer) return withAuthors;

    const scored = withAuthors.map((p, idx) => ({
      p,
      idx,
      s: scorePostForViewer(p, viewer, p.author?.province ?? null),
    }));
    scored.sort((a, b) => (b.s - a.s) || (a.idx - b.idx));
    return scored.map(({ p }) => p);
  },
});

export const listFeedPosts = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("learnhub_posts")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 30);
    const viewer = args.userId ? await ctx.db.get(args.userId) : null;
    if (!viewer) return posts;

    // Resolve author province only for posts that need it (province set on
    // viewer). For the common case where viewer has no province, skip the
    // per-post author fetch.
    const needAuthorProvince = Boolean(viewer.province);
    const scored = await Promise.all(
      posts.map(async (p, idx) => {
        const authorProvince = needAuthorProvince
          ? (await ctx.db.get(p.authorId))?.province ?? null
          : null;
        return { p, idx, s: scorePostForViewer(p, viewer, authorProvince) };
      }),
    );
    scored.sort((a, b) => (b.s - a.s) || (a.idx - b.idx));
    return scored.map(({ p }) => p);
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
    tags: v.optional(v.array(v.string())),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const postId = await ctx.db.insert("learnhub_posts", {
      ...args,
      likeCount: 0,
      commentCount: 0,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    });

    // For Meet posts, schedule the lifecycle hooks (15-min "starting
    // soon" bell, markLive at scheduledAt, markEnded after duration).
    if (args.type === "meet") {
      const m = (args.metadata ?? {}) as Record<string, unknown>;
      const scheduledAt =
        typeof m.scheduledAt === "number" ? (m.scheduledAt as number) : null;
      const durationMinutes =
        typeof m.durationMinutes === "number"
          ? (m.durationMinutes as number)
          : 60;
      if (scheduledAt && scheduledAt > now) {
        await ctx.scheduler.runAfter(
          0,
          internal.learnhub_meet.scheduleLifecycle,
          { postId, scheduledAt, durationMinutes }
        );
      }
    }

    return postId;
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
