import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { extractHashtags, normalizeHashtag } from "../lib/learnhub/interests";

// 7-day default boost window for org_partner posts. Stored as a constant so
// the management UI can show "Boosted until <date>" and the scoring path
// reads the same value.
const ORG_BOOST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Pure scoring pass over the latest N posts. Higher score floats up; ties break
// on createdAt-desc (stable sort because we use a stable sort fn). Not ML — a
// small, transparent function that's easy to tune. Keep it pure.
type ScorablePost = {
  tags?: string[];
  hashtags?: string[];
  type?: string;
  authorId?: unknown;
  createdAt?: number;
  boostLevel?: "none" | "standard" | "featured";
  boostExpiresAt?: number;
  metadata?: unknown;
};

type ScorableViewer = {
  interests?: string[];
  skillLevels?: Record<string, string>;
  goals?: string[];
  province?: string;
} | null;

type ScorableAuthor = {
  province?: string;
  role?: string;
} | null;

type ScorableOrgProfile = {
  isVerified?: boolean;
} | null;

function scorePostForViewer(
  post: ScorablePost,
  viewer: ScorableViewer,
  author: ScorableAuthor,
  orgProfile: ScorableOrgProfile,
  now: number,
): number {
  let score = 0;

  // 1. Recency decay. Half-life ≈ 24h (decay constant 36h chosen so a 36h-old
  //    post still scores ~0.37). Applies regardless of viewer presence so
  //    logged-out feed views still see fresh content first.
  const ageMs = Math.max(0, now - (post.createdAt ?? now));
  const hoursOld = ageMs / 3_600_000;
  score += Math.exp(-hoursOld / 36) * 5;

  // 2. Org boost — only while inside the boost window.
  const boostActive =
    post.boostLevel && post.boostLevel !== "none" &&
    (!post.boostExpiresAt || post.boostExpiresAt > now);
  if (boostActive && author?.role === "org_partner") {
    score += 15;
    if (orgProfile?.isVerified) score += 10;
  }
  if (post.boostLevel === "featured" && boostActive) score += 8;

  if (!viewer) return score;

  // 3. Interest match: union of legacy `tags` (taxonomy strings) and new
  //    `hashtags` (normalized). Hashtag match is fuzzy on whitespace so
  //    "AI & ML" interest matches "#aiml" hashtag.
  const interestSet = viewer.interests ? new Set(viewer.interests) : null;
  if (interestSet) {
    if (post.tags && post.tags.length > 0) {
      for (const t of post.tags) {
        if (!interestSet.has(t)) continue;
        score += 3;
        const level = viewer.skillLevels?.[t];
        if (level === "beginner" || level === "intermediate") score += 1;
      }
    }
    if (post.hashtags && post.hashtags.length > 0) {
      // Pre-normalize the viewer's interests once so every hashtag compare is
      // a Set lookup instead of an O(n) scan.
      const normalizedInterests = new Set(
        Array.from(interestSet).map((i) => normalizeHashtag(i)),
      );
      for (const h of post.hashtags) {
        const n = normalizeHashtag(h);
        if (n && normalizedInterests.has(n)) score += 3;
      }
    }
  }

  // 4. Goal alignment.
  const goalSet = viewer.goals ? new Set(viewer.goals) : null;
  if (goalSet) {
    if (post.type === "opportunity" && goalSet.has("find_work")) score += 2;
    if (post.type === "certificate" && goalSet.has("build_portfolio")) score += 2;
  }

  // 5. Province bonus.
  if (viewer.province && author?.province && viewer.province === author.province) {
    score += 1;
  }

  // 6. Event proximity — posts that link to an upcoming event get a bump
  //    that fades to 0 by 7 days out. metadata.eventStartsAt is set by
  //    createPost when type === "meet" or "event".
  const meta = post.metadata as Record<string, unknown> | undefined;
  const eventStartsAt =
    meta && typeof meta.eventStartsAt === "number"
      ? (meta.eventStartsAt as number)
      : null;
  if (eventStartsAt) {
    const daysUntil = (eventStartsAt - now) / 86_400_000;
    if (daysUntil >= 0 && daysUntil <= 7) {
      score += 5 * (1 - daysUntil / 7);
    }
  }

  return score;
}

// Internal helper: join posts with their authors + (for org_partner authors)
// the org profile, run the scoring pass, return the ordered list. Pulled out
// so both `listFeedWithAuthors` and `listFeedPaginated` share one
// implementation — the only thing they differ on is which posts to feed in.
async function scorePostsForViewer(
  ctx: QueryCtx,
  posts: Array<Doc<"learnhub_posts">>,
  viewerId: Id<"learnhub_users"> | null,
) {
  const now = Date.now();
  const viewer = viewerId ? await ctx.db.get(viewerId) : null;

  const authorIds = Array.from(new Set(posts.map((p) => p.authorId as unknown as string)));
  const authors = new Map<string, Doc<"learnhub_users"> | null>();
  for (const id of authorIds) {
    authors.set(id, await ctx.db.get(id as unknown as Id<"learnhub_users">));
  }

  const orgProfiles = new Map<string, Doc<"learnhub_org_profiles"> | null>();
  const authorEntries = Array.from(authors.entries());
  for (let i = 0; i < authorEntries.length; i++) {
    const [id, author] = authorEntries[i];
    if (author && author.role === "org_partner") {
      const profile = await ctx.db
        .query("learnhub_org_profiles")
        .withIndex("by_org", (q) => q.eq("orgId", id as unknown as Id<"learnhub_users">))
        .unique();
      orgProfiles.set(id, profile);
    }
  }

  const scored = posts.map((p, idx) => ({
    p,
    idx,
    s: scorePostForViewer(
      p as ScorablePost,
      viewer as ScorableViewer,
      authors.get(p.authorId as unknown as string) as ScorableAuthor,
      (orgProfiles.get(p.authorId as unknown as string) ?? null) as ScorableOrgProfile,
      now,
    ),
  }));
  scored.sort((a, b) => (b.s - a.s) || (a.idx - b.idx));
  return { scored, authors };
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

    const { scored, authors } = await scorePostsForViewer(ctx, posts, args.userId ?? null);
    return scored.map(({ p }) => ({
      ...p,
      author: authors.get(p.authorId as unknown as string) ?? null,
    }));
  },
});

// Cursor-paginated feed. Returns up to `limit` items + a `nextCursor` you
// can pass back in to load the page after this one. Cursor is the
// `createdAt` of the oldest item in the previous chronological window.
// Optional `hashtag` filter narrows the feed to a single #tag.
export const listFeedPaginated = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.id("learnhub_users")),
    cursor: v.optional(v.number()),
    hashtag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pageSize = Math.min(args.limit ?? 30, 50);
    // Overscan: pull ~2× the page so the post-fetch re-rank can promote
    // higher-scoring older items without dropping them off the page edge.
    const overscan = Math.min(pageSize * 2, 100);

    let postsQ = ctx.db
      .query("learnhub_posts")
      .withIndex("by_created")
      .order("desc");
    if (typeof args.cursor === "number") {
      const cur = args.cursor;
      postsQ = postsQ.filter((q) => q.lt(q.field("createdAt"), cur));
    }
    let posts = await postsQ.take(overscan);

    if (args.hashtag) {
      const want = normalizeHashtag(args.hashtag);
      posts = posts.filter((p) => (p.hashtags ?? []).some((h) => normalizeHashtag(h) === want));
    }

    const { scored, authors } = await scorePostsForViewer(ctx, posts, args.userId ?? null);
    const page = scored.slice(0, pageSize);
    const items = page.map(({ p }) => ({
      ...p,
      author: authors.get(p.authorId as unknown as string) ?? null,
    }));

    const nextCursor =
      posts.length === overscan
        ? Math.min(...posts.map((p) => p.createdAt))
        : null;

    return { items, nextCursor, hashtag: args.hashtag ?? null };
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
    const { scored } = await scorePostsForViewer(ctx, posts, args.userId ?? null);
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
    // New: free-form #hashtags parsed by the client. We still
    // re-normalize + dedupe server-side so the canonical list can't
    // contain raw casing or whitespace.
    hashtags: v.optional(v.array(v.string())),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Normalize hashtags: lowercase, strip leading `#`, drop bad chars,
    // dedupe. Also pull any hashtags that exist in the content body but
    // weren't passed in `hashtags` — covers older clients.
    const fromContent = extractHashtags(args.content ?? "");
    const fromArg = (args.hashtags ?? []).map((h) => normalizeHashtag(h)).filter(Boolean);
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const h of [...fromArg, ...fromContent]) {
      if (h && !seen.has(h)) {
        seen.add(h);
        merged.push(h);
      }
      if (merged.length >= 10) break;
    }

    // Auto-boost: org_partner posts get a `standard` 7-day boost. Existing
    // mentor / student / admin posts default to no boost. Coordinators can
    // later upgrade to `featured` via pinPost / a separate mutation.
    const author = await ctx.db.get(args.authorId);
    const isOrg = author?.role === "org_partner";
    const boostLevel: "none" | "standard" | "featured" = isOrg ? "standard" : "none";
    const boostExpiresAt = isOrg ? now + ORG_BOOST_WINDOW_MS : undefined;

    // For meet/event posts, mirror the start time into metadata.eventStartsAt
    // so the ranking can apply the upcoming-event bonus without needing
    // another lookup per post.
    let metadata = args.metadata;
    if (args.type === "meet" || (args.type as string) === "event") {
      const m = (metadata ?? {}) as Record<string, unknown>;
      const scheduledAt = typeof m.scheduledAt === "number" ? m.scheduledAt : null;
      if (scheduledAt && !m.eventStartsAt) {
        metadata = { ...m, eventStartsAt: scheduledAt };
      }
    }

    const { hashtags: _drop, ...rest } = args;
    void _drop;
    const postId = await ctx.db.insert("learnhub_posts", {
      ...rest,
      metadata,
      hashtags: merged.length > 0 ? merged : undefined,
      boostLevel,
      boostExpiresAt,
      likeCount: 0,
      commentCount: 0,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    });

    // For Meet posts, schedule the lifecycle hooks (15-min "starting
    // soon" bell, markLive at scheduledAt, markEnded after duration).
    if (args.type === "meet") {
      const m = (metadata ?? {}) as Record<string, unknown>;
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
