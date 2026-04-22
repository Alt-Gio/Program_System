import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserByGoogleId = query({
  args: { googleId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .unique();
  },
});

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const getUser = query({
  args: { id: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("learnhub_users").take(50);
  },
});

export const createUser = mutation({
  args: {
    googleId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    role: v.union(
      v.literal("student"),
      v.literal("mentor"),
      v.literal("org_partner")
    ),
    organization: v.optional(v.string()),
    school: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("learnhub_users", {
      ...args,
      bio: undefined,
      xpPoints: 100,
      badges: ["🏁 First Steps"],
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: new Date().toISOString().split("T")[0],
      followingIds: [],
      followerCount: 0,
      fcmTokens: [],
      unreadNotifCount: 0,
      notifPrefs: {
        pushEnabled: false,
        emailDigest: "weekly",
      },
    });
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("learnhub_users"),
    bio: v.optional(v.string()),
    school: v.optional(v.string()),
    organization: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const addFcmToken = mutation({
  args: {
    userId: v.id("learnhub_users"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const tokens = user.fcmTokens.includes(args.token)
      ? user.fcmTokens
      : [...user.fcmTokens, args.token];
    await ctx.db.patch(args.userId, { fcmTokens: tokens });
  },
});

export const removeFcmToken = mutation({
  args: {
    userId: v.id("learnhub_users"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(args.userId, {
      fcmTokens: user.fcmTokens.filter((t) => t !== args.token),
    });
  },
});

export const markDailyLogin = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const today = new Date().toISOString().split("T")[0];
    if (user.lastActiveDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreak =
      user.lastActiveDate === yesterday ? user.currentStreak + 1 : 1;
    const longestStreak = Math.max(newStreak, user.longestStreak);

    await ctx.db.patch(args.userId, {
      lastActiveDate: today,
      currentStreak: newStreak,
      longestStreak,
      xpPoints: user.xpPoints + 10,
    });
  },
});

export const awardXp = mutation({
  args: {
    userId: v.id("learnhub_users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(args.userId, {
      xpPoints: user.xpPoints + args.amount,
    });
  },
});

export const updateNotifPrefs = mutation({
  args: {
    userId: v.id("learnhub_users"),
    pushEnabled: v.boolean(),
    emailDigest: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("never")
    ),
    quietHoursFrom: v.optional(v.string()),
    quietHoursTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...prefs } = args;
    await ctx.db.patch(userId, { notifPrefs: prefs });
  },
});

export const clearUnreadNotifCount = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { unreadNotifCount: 0 });
  },
});
