import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listComments = query({
  args: { postId: v.id("learnhub_posts"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_comments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("asc")
      .take(args.limit ?? 50);
  },
});

export const listCommentsWithAuthors = query({
  args: { postId: v.id("learnhub_posts"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("learnhub_comments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("asc")
      .take(args.limit ?? 50);
    return Promise.all(
      comments.map(async (c) => ({
        ...c,
        author: await ctx.db.get(c.authorId),
      }))
    );
  },
});

export const createComment = mutation({
  args: {
    postId: v.id("learnhub_posts"),
    authorId: v.id("learnhub_users"),
    content: v.string(),
    parentId: v.optional(v.id("learnhub_comments")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("learnhub_comments", {
      ...args,
      createdAt: Date.now(),
    });
    const post = await ctx.db.get(args.postId);
    if (post) {
      await ctx.db.patch(args.postId, {
        commentCount: post.commentCount + 1,
      });
    }
    return id;
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("learnhub_comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) return;
    await ctx.db.delete(args.commentId);
    const post = await ctx.db.get(comment.postId);
    if (post) {
      await ctx.db.patch(comment.postId, {
        commentCount: Math.max(0, post.commentCount - 1),
      });
    }
  },
});
