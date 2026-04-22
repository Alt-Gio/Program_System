import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Conversations ──────────────────────────────────────────────────────────────

export const listMyConversations = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("learnhub_conversations").collect();
    const mine = all.filter((c) => c.participantIds.includes(args.userId));
    mine.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

    return Promise.all(
      mine.map(async (conv) => {
        const otherId = conv.participantIds.find((id) => id !== args.userId);
        const other = otherId ? await ctx.db.get(otherId) : null;
        const lastMsg = await ctx.db
          .query("learnhub_messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();
        const unreadCount = await ctx.db
          .query("learnhub_messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .filter((q) => q.and(q.eq(q.field("read"), false), q.neq(q.field("senderId"), args.userId)))
          .collect()
          .then((msgs) => msgs.length);
        return { ...conv, other, lastMsg, unreadCount };
      })
    );
  },
});

export const getOrCreateConversation = mutation({
  args: {
    userIdA: v.id("learnhub_users"),
    userIdB: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("learnhub_conversations").collect();
    const existing = all.find(
      (c) =>
        c.participantIds.includes(args.userIdA) &&
        c.participantIds.includes(args.userIdB) &&
        c.participantIds.length === 2
    );
    if (existing) return existing._id;
    return await ctx.db.insert("learnhub_conversations", {
      participantIds: [args.userIdA, args.userIdB],
      type: "direct",
      unreadCounts: {},
    });
  },
});

// ── Messages ───────────────────────────────────────────────────────────────────

export const listMessages = query({
  args: {
    conversationId: v.id("learnhub_conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("learnhub_messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .take(args.limit ?? 100);
    return Promise.all(
      msgs.map(async (m) => ({ ...m, sender: await ctx.db.get(m.senderId) }))
    );
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("learnhub_conversations"),
    senderId: v.id("learnhub_users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("learnhub_messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      content: args.content,
      read: false,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessage: args.content,
      lastMessageAt: now,
    } as any);
    return id;
  },
});

export const markConversationRead = mutation({
  args: {
    conversationId: v.id("learnhub_conversations"),
    userId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("learnhub_messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.and(q.eq(q.field("read"), false), q.neq(q.field("senderId"), args.userId)))
      .collect();
    await Promise.all(unread.map((m) => ctx.db.patch(m._id, { read: true })));
  },
});
