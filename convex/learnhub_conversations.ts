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

// ── Group conversations (Phase 8.B) ────────────────────────────────────────────

export const getOrCreateGroupConversation = mutation({
  args: { groupId: v.id("learnhub_groups") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_conversations")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .first();
    if (existing) return existing._id;
    const members = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    return await ctx.db.insert("learnhub_conversations", {
      participantIds: members.map((m) => m.userId),
      type: "group",
      groupId: args.groupId,
      unreadCounts: {},
    });
  },
});

export const listGroupMessages = query({
  args: {
    groupId: v.id("learnhub_groups"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db
      .query("learnhub_conversations")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .first();
    if (!conv) return [];
    const msgs = await ctx.db
      .query("learnhub_messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .order("asc")
      .take(args.limit ?? 100);
    return Promise.all(
      msgs.map(async (m) => ({ ...m, sender: await ctx.db.get(m.senderId) })),
    );
  },
});

export const sendGroupMessage = mutation({
  args: {
    groupId: v.id("learnhub_groups"),
    senderId: v.id("learnhub_users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the sender is a member.
    const membership = await ctx.db
      .query("learnhub_group_members")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), args.senderId))
      .first();
    if (!membership) throw new Error("Not a member of this cohort");

    // Idempotent: get or create the conversation.
    let conv = await ctx.db
      .query("learnhub_conversations")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .first();
    let convId = conv?._id;
    if (!convId) {
      const members = await ctx.db
        .query("learnhub_group_members")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      convId = await ctx.db.insert("learnhub_conversations", {
        participantIds: members.map((m) => m.userId),
        type: "group",
        groupId: args.groupId,
        unreadCounts: {},
      });
    } else {
      // Refresh the participant list in case membership grew since creation.
      const members = await ctx.db
        .query("learnhub_group_members")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      const memberIds = members.map((m) => m.userId);
      const next = Array.from(
        new Set([...conv!.participantIds, ...memberIds]),
      );
      if (next.length !== conv!.participantIds.length) {
        await ctx.db.patch(convId, { participantIds: next });
      }
    }

    const now = Date.now();
    const msgId = await ctx.db.insert("learnhub_messages", {
      conversationId: convId,
      senderId: args.senderId,
      content: args.content,
      read: false,
      createdAt: now,
    });
    await ctx.db.patch(convId, {
      lastMessage: args.content,
      lastMessageAt: now,
    });
    return msgId;
  },
});
