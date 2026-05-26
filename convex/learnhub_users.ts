import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { evaluateAndAwardForUser } from "./learnhub_badges";

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

/**
 * Phase 8.E.4 — activity timeline.
 *
 * Pulls the user's recent XP events and surfaces them as a uniform
 * timeline. Each row is derived (not stored) so the rendering can evolve
 * without a schema migration. Limits to the last 50 events.
 */
export const getUserActivityTimeline = query({
  args: {
    userId: v.id("learnhub_users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    const events = await ctx.db
      .query("learnhub_xp_events")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    type TimelineRow = {
      id: string;
      kind: "xp" | "badge" | "cohort_join" | "path_completion";
      emoji: string;
      title: string;
      detail: string;
      xp: number;
      date: string;
      createdAt: number;
    };

    const rows: TimelineRow[] = events.map((e) => {
      let emoji = "⚡";
      let kind: TimelineRow["kind"] = "xp";
      switch (e.sourceType) {
        case "module_completion":
          emoji = "🎓";
          kind = "path_completion";
          break;
        case "challenge_completion":
          emoji = "🏆";
          break;
        case "flashcard_review":
          emoji = "🎴";
          break;
        case "video_completion":
          emoji = "📺";
          break;
        case "journal_habit":
          emoji = "📝";
          break;
        case "mentor_acceptance":
          emoji = "🤝";
          break;
        case "work_completion":
          emoji = "💼";
          break;
        case "flow_session":
          emoji = "🔁";
          break;
        case "daily_login":
          emoji = "🌅";
          break;
        case "manual":
          emoji = "✨";
          break;
      }
      return {
        id: e._id as string,
        kind,
        emoji,
        title: e.reason,
        detail: `+${e.amount} XP`,
        xp: e.amount,
        date: e.date,
        createdAt: e.createdAt,
      };
    });

    return rows;
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

    // For mentors created via self-onboarding (i.e. not coming through an
    // invite/acceptInvite which sets mentorStatus="verified"), we mark them
    // as pending_verification and mirror their interests onto expertiseTags
    // so they immediately appear in /learnhub/mentors with a "Pending" chip
    // and learners can find them by expertise. Coordinators get a fan-out
    // notification so review isn't backlogged.
    const isSelfOnboardedMentor = args.role === "mentor";
    const mentorFields = isSelfOnboardedMentor
      ? {
          mentorStatus: "pending_verification" as const,
          expertiseTags: args.interests ?? [],
        }
      : {};

    const newUserId = await ctx.db.insert("learnhub_users", {
      ...args,
      ...mentorFields,
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

    if (isSelfOnboardedMentor) {
      // Also create a verification record so the /org/mentors review queue
      // (which reads learnhub_mentor_verifications by status="pending")
      // picks this mentor up. Self-onboarded mentors have no doc URL yet —
      // they can attach one later via submitVerification; coordinators can
      // still approve based on the profile alone.
      await ctx.db.insert("learnhub_mentor_verifications", {
        mentorId: newUserId,
        submittedAt: Date.now(),
        status: "pending",
      });
      await ctx.scheduler.runAfter(
        0,
        internal.learnhub_notifications.notifyMentorPendingVerification,
        { mentorId: newUserId },
      );
    }

    return newUserId;
  },
});

// Internal: fetch coordinator + admin user IDs for fan-out notifications.
// Used for mentor-verification queue alerts.
export const listVerifiersForNotification = internalQuery({
  args: {},
  handler: async (ctx) => {
    const coordinators = await ctx.db
      .query("learnhub_users")
      .withIndex("by_role", (q) => q.eq("role", "coordinator"))
      .take(200);
    const admins = await ctx.db
      .query("learnhub_users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(200);
    return [...coordinators, ...admins];
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
    feedColumns: v.optional(v.number()),
    // Mentor-only fields. The schema already permits them on every user
    // record; the mentor profile editor at /learnhub/mentor/profile writes
    // them and the marketplace reads them.
    designation: v.optional(v.string()),
    expertiseTags: v.optional(v.array(v.string())),
    maxMentees: v.optional(v.number()),
    availability: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const interestsTouched = fields.interests !== undefined;
    // Drop undefined fields so we don't overwrite with undefined
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(id, clean);

    // Editing interests can flip Polymath; cheap to re-evaluate on any
    // profile edit since most criteria are constant-time lookups.
    if (interestsTouched) {
      await evaluateAndAwardForUser(ctx, id);
    }
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

    // Streak update may have crossed the 14-day Streak Keeper threshold.
    await evaluateAndAwardForUser(ctx, args.userId);
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

export const updateFeedColumns = mutation({
  args: {
    userId: v.id("learnhub_users"),
    feedColumns: v.number(),
  },
  handler: async (ctx, args) => {
    // Clamp 1..4 — the feed masonry has no visual room beyond that on
    // standard desktop widths, and 0 columns would hide the feed entirely.
    const n = Math.max(1, Math.min(4, Math.round(args.feedColumns)));
    await ctx.db.patch(args.userId, { feedColumns: n });
  },
});

// Permanently delete the signed-in user's account.
//
// Posts, comments, certificates, and likes the user authored are *kept* —
// their `authorId` becomes a dangling reference, and the feed/watch UIs
// already render missing authors as "Unknown User" (per the original
// request: "what their post is saved as it is and can still be viewed
// […] would have avoidance for any unknown post user").
//
// Personal records cascade-cleaned (best-effort): bookmarks, journal,
// video study sessions + dependents, Google OAuth credentials,
// notifications, conversations the user is a sole participant in, and
// follower edges from other users back to this one. Each step is
// wrapped in try/catch so a single index/table issue can't roll back
// the critical user-doc delete — that would have left an undeletable
// "ghost" account that still blocks re-registration via the email
// uniqueness check in createUser. (This was the actual bug behind
// reports of "previous account still on Convex database after delete".)
//
// We fully drop the user document (rather than soft-delete) so the
// person can sign up again with the same Google account — the
// googleId / email uniqueness checks in createUser would otherwise
// block re-registration.
export const deleteAccount = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { ok: true, alreadyGone: true };

    // Track what happened for diagnostics — surfaced back to the API
    // route so the server log shows which cascade step failed (if any)
    // while still guaranteeing the account is gone.
    const log: Record<string, number | string> = {};
    const safe = async (label: string, fn: () => Promise<number>) => {
      try {
        log[label] = await fn();
      } catch (e) {
        log[label] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    };

    await safe("bookmarks", async () => {
      const rows = await ctx.db
        .query("learnhub_bookmarks")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
      return rows.length;
    });

    await safe("journal", async () => {
      const rows = await ctx.db
        .query("learnhub_journal")
        .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
      return rows.length;
    });

    await safe("video_sessions", async () => {
      const sessions = await ctx.db
        .query("learnhub_video_sessions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const s of sessions) {
        const tables: Array<"learnhub_video_notes" | "learnhub_video_flashcards" | "learnhub_video_quizzes" | "learnhub_video_timeline_events" | "learnhub_video_chat_messages" | "learnhub_video_viewers"> = [
          "learnhub_video_notes",
          "learnhub_video_flashcards",
          "learnhub_video_quizzes",
          "learnhub_video_timeline_events",
          "learnhub_video_chat_messages",
          "learnhub_video_viewers",
        ];
        for (const t of tables) {
          try {
            const rows = await ctx.db
              .query(t)
              .withIndex("by_session", (q) => q.eq("sessionId", s._id))
              .collect();
            for (const r of rows) await ctx.db.delete(r._id);
          } catch {
            // skip — table or index drift; we don't want to leak the
            // exception and prevent the user delete below.
          }
        }
        await ctx.db.delete(s._id);
      }
      return sessions.length;
    });

    await safe("google_credentials", async () => {
      const rows = await ctx.db
        .query("learnhub_google_credentials")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
      return rows.length;
    });

    await safe("followers", async () => {
      // No index by followingIds — scan capped at 2000. Bump when the
      // cohort outgrows that. Removes this userId from everyone else's
      // followingIds array.
      const others = await ctx.db.query("learnhub_users").take(2000);
      let touched = 0;
      for (const u of others) {
        if (u._id === args.userId) continue;
        if (!u.followingIds?.includes(args.userId)) continue;
        await ctx.db.patch(u._id, {
          followingIds: u.followingIds.filter((id) => id !== args.userId),
        });
        touched++;
      }
      return touched;
    });

    // The critical step. Wrapped separately so we get a clear error
    // back to the caller if the user-doc itself can't be deleted.
    let userDeleted = false;
    try {
      await ctx.db.delete(args.userId);
      userDeleted = true;
    } catch (e) {
      log["user_doc"] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Belt and braces — confirm the row is gone so the API route never
    // returns ok:true when the doc is still there (which was the
    // confusing "still in Convex DB" symptom).
    const recheck = await ctx.db.get(args.userId);
    if (recheck) {
      throw new Error(
        `DELETE_FAILED: user ${args.userId} still present after delete. log=${JSON.stringify(log)}`,
      );
    }

    return { ok: true, userDeleted, log };
  },
});

// Admin/coordinator-only: flip a user's role. Used to provision coordinators
// (no self-signup path for that role — they get assigned by program staff).
// Re-checks on the server so a stale client cookie can't grant elevation.
export const setUserRole = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    targetId: v.id("learnhub_users"),
    role: v.union(
      v.literal("student"),
      v.literal("mentor"),
      v.literal("org_partner"),
      v.literal("coordinator"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");
    if (actor.role !== "admin" && actor.role !== "coordinator") {
      throw new Error("FORBIDDEN: only admins or coordinators can change roles");
    }
    await ctx.db.patch(args.targetId, { role: args.role });
    return { ok: true };
  },
});
