import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getEntry = query({
  args: { userId: v.id("learnhub_users"), date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date)
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

export const upsertEntry = mutation({
  args: {
    userId: v.id("learnhub_users"),
    date: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const wordCount = args.content.trim()
      ? args.content.trim().split(/\s+/).length
      : 0;

    const existing = await ctx.db
      .query("learnhub_journal")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        tags: args.tags,
        wordCount,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("learnhub_journal", {
      userId: args.userId,
      date: args.date,
      content: args.content,
      tags: args.tags,
      wordCount,
      updatedAt: Date.now(),
    });
  },
});

export const deleteEntry = mutation({
  args: { entryId: v.id("learnhub_journal") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
  },
});
