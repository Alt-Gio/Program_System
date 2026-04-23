import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Cross-system identity lookup.
 *
 * Given a Google ID, returns records from BOTH the DICT `users` table
 * and the LearnHub `learnhub_users` table. This powers the role-picker
 * when a single Google account has roles in multiple portals.
 */
export const findByGoogleId = query({
  args: { googleId: v.string() },
  handler: async (ctx, args) => {
    const [dictUser, lhUser] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
        .first(),
      ctx.db
        .query("learnhub_users")
        .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
        .first(),
    ]);

    return {
      dictUser: dictUser
        ? {
            id: dictUser._id,
            email: dictUser.email,
            fullName: dictUser.fullName,
            role: dictUser.role,
            isActive: dictUser.isActive,
          }
        : null,
      lhUser: lhUser
        ? {
            id: lhUser._id,
            email: lhUser.email,
            name: lhUser.name,
            role: lhUser.role,
            avatarUrl: lhUser.avatarUrl,
          }
        : null,
    };
  },
});

/**
 * Find DICT user by email for linking existing accounts.
 */
export const findDictUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) return null;
    return {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      hasGoogleId: !!user.googleId,
    };
  },
});
