import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listBookmarks = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const bookmarks = await ctx.db
      .query("learnhub_bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const withPosts = await Promise.all(
      bookmarks.map(async (b) => {
        const post = await ctx.db.get(b.postId);
        return { ...b, post };
      })
    );

    return withPosts;
  },
});

export const getBookmark = query({
  args: {
    userId: v.id("learnhub_users"),
    postId: v.id("learnhub_posts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_bookmarks")
      .withIndex("by_user_post", (q) =>
        q.eq("userId", args.userId).eq("postId", args.postId)
      )
      .unique();
  },
});

export const upsertBookmark = mutation({
  args: {
    userId: v.id("learnhub_users"),
    postId: v.id("learnhub_posts"),
    status: v.union(
      v.literal("want_to_learn"),
      v.literal("in_progress"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("learnhub_bookmarks")
      .withIndex("by_user_post", (q) =>
        q.eq("userId", args.userId).eq("postId", args.postId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("learnhub_bookmarks", {
      userId: args.userId,
      postId: args.postId,
      status: args.status,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeBookmark = mutation({
  args: { bookmarkId: v.id("learnhub_bookmarks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.bookmarkId);
  },
});

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_users")
      .collect()
      .then((users) =>
        users
          .sort((a, b) => b.xpPoints - a.xpPoints)
          .slice(0, args.limit ?? 20)
          .map((u, i) => ({ ...u, rank: i + 1 }))
      );
  },
});
