import { query, mutation, internalQuery } from "./_generated/server";
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
    interests: v.optional(v.array(v.string())),
    skillLevels: v.optional(v.record(v.string(), v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ))),
    goals: v.optional(v.array(v.union(
      v.literal("find_work"),
      v.literal("learn"),
      v.literal("build_portfolio"),
      v.literal("mentor"),
      v.literal("network")
    ))),
    hoursPerWeek: v.optional(v.union(
      v.literal("<5"),
      v.literal("5-10"),
      v.literal("10-20"),
      v.literal("20+")
    )),
    region: v.optional(v.string()),
    province: v.optional(v.string()),
    municipality: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .unique();
    if (existing) {
      // Role strictness — once an account is established, the role is sticky.
      // Surface the conflict so the API layer can return a clear error instead
      // of silently downgrading/upgrading the user.
      if (existing.role !== "admin" && existing.role !== args.role) {
        throw new Error(
          `ROLE_CONFLICT: account already registered as ${existing.role}`,
        );
      }
      return existing._id;
    }

    // Same-email collision (different Google account). Block to prevent one
    // person from registering parallel mentor / student profiles.
    const byEmail = await ctx.db
      .query("learnhub_users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (byEmail) {
      throw new Error(
        `EMAIL_TAKEN: this email is already registered as ${byEmail.role}`,
      );
    }

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
      onboardingCompletedAt: Date.now(),
      notifPrefs: {
        pushEnabled: false,
        emailDigest: "weekly",
      },
    });
  },
});

// Internal: fetch a bounded list of students for fan-out notifications.
// TODO: paginate via .paginate() once student count exceeds ~1k.
export const listStudentsForNotification = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("learnhub_users")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .take(500);
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("learnhub_users"),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    school: v.optional(v.string()),
    organization: v.optional(v.string()),
    interests: v.optional(v.array(v.string())),
    skillLevels: v.optional(v.record(v.string(), v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ))),
    goals: v.optional(v.array(v.union(
      v.literal("find_work"),
      v.literal("learn"),
      v.literal("build_portfolio"),
      v.literal("mentor"),
      v.literal("network")
    ))),
    hoursPerWeek: v.optional(v.union(
      v.literal("<5"),
      v.literal("5-10"),
      v.literal("10-20"),
      v.literal("20+")
    )),
    region: v.optional(v.string()),
    province: v.optional(v.string()),
    municipality: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Drop undefined fields so we don't overwrite with undefined
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(id, clean);
  },
});

export const toggleFollow = mutation({
  args: {
    followerId: v.id("learnhub_users"),
    targetId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    if (args.followerId === args.targetId) {
      throw new Error("Cannot follow yourself");
    }
    const follower = await ctx.db.get(args.followerId);
    const target = await ctx.db.get(args.targetId);
    if (!follower || !target) throw new Error("User not found");

    const isFollowing = follower.followingIds.some((id) => id === args.targetId);
    const newFollowingIds = isFollowing
      ? follower.followingIds.filter((id) => id !== args.targetId)
      : [...follower.followingIds, args.targetId];

    await ctx.db.patch(args.followerId, { followingIds: newFollowingIds });
    await ctx.db.patch(args.targetId, {
      followerCount: Math.max(0, target.followerCount + (isFollowing ? -1 : 1)),
    });
    return { isFollowing: !isFollowing };
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
