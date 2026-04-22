import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Invite Queries ────────────────────────────────────────────────────────────

export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("learnhub_mentor_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique(),
});

export const listInvites = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("learnhub_mentor_invites").order("desc").collect();
    if (args.status) return all.filter((i) => i.status === args.status);
    return all;
  },
});

export const listActiveMentors = query({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("learnhub_users")
      .withIndex("by_role", (q) => q.eq("role", "mentor"))
      .collect(),
});

export const listPendingVerifications = query({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("learnhub_mentor_verifications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect(),
});

// ── Invite Mutations ──────────────────────────────────────────────────────────

export const createInvite = mutation({
  args: {
    token: v.string(),
    invitedEmail: v.string(),
    invitedName: v.string(),
    dictDesignation: v.string(),
    regionalOffice: v.string(),
    programs: v.array(v.string()),
    expertiseTags: v.array(v.string()),
    maxMentees: v.number(),
    personalMessage: v.optional(v.string()),
    invitedBy: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("learnhub_mentor_invites", {
      ...args,
      status: "pending",
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });
  },
});

export const acceptInvite = mutation({
  args: {
    token: v.string(),
    googleId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("learnhub_mentor_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invite) return { error: "Invite not found" };
    if (invite.status !== "pending") return { error: `Invite already ${invite.status}` };
    if (Date.now() > invite.expiresAt) {
      await ctx.db.patch(invite._id, { status: "expired" });
      return { error: "Invite expired" };
    }
    if (invite.invitedEmail.toLowerCase() !== args.email.toLowerCase()) {
      return { error: "Email mismatch" };
    }

    const existingUser = await ctx.db
      .query("learnhub_users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .unique();

    let mentorUserId: string;
    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        role: "mentor",
        mentorStatus: "verified",
        designation: invite.dictDesignation,
        regionalOffice: invite.regionalOffice,
        expertiseTags: invite.expertiseTags,
        maxMentees: invite.maxMentees,
      });
      mentorUserId = existingUser._id;
    } else {
      mentorUserId = await ctx.db.insert("learnhub_users", {
        googleId: args.googleId,
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        role: "mentor",
        mentorStatus: "verified",
        designation: invite.dictDesignation,
        regionalOffice: invite.regionalOffice,
        expertiseTags: invite.expertiseTags,
        maxMentees: invite.maxMentees,
        xpPoints: 0,
        badges: [],
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: new Date().toISOString().split("T")[0],
        followingIds: [],
        followerCount: 0,
        fcmTokens: [],
        unreadNotifCount: 0,
        notifPrefs: { pushEnabled: true, emailDigest: "weekly" },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: Date.now(),
      mentorUserId,
    } as any);

    return { ok: true, mentorUserId };
  },
});

export const declineInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("learnhub_mentor_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite) return;
    await ctx.db.patch(invite._id, { status: "declined" });
  },
});

export const cancelInvite = mutation({
  args: { inviteId: v.id("learnhub_mentor_invites") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, { status: "expired" });
  },
});

// ── Mentor Verification ───────────────────────────────────────────────────────

export const submitVerification = mutation({
  args: {
    mentorId: v.id("learnhub_users"),
    dictEmployeeId: v.optional(v.string()),
    designation: v.optional(v.string()),
    verificationDocUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mentorId, { mentorStatus: "pending_verification" });
    return await ctx.db.insert("learnhub_mentor_verifications", {
      mentorId: args.mentorId,
      dictEmployeeId: args.dictEmployeeId,
      designation: args.designation,
      verificationDocUrl: args.verificationDocUrl,
      submittedAt: Date.now(),
      status: "pending",
    });
  },
});

export const reviewVerification = mutation({
  args: {
    verificationId: v.id("learnhub_mentor_verifications"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    reviewedBy: v.id("learnhub_users"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ver = await ctx.db.get(args.verificationId);
    if (!ver) return;
    await ctx.db.patch(args.verificationId, {
      status: args.decision,
      reviewedAt: Date.now(),
      reviewedBy: args.reviewedBy,
      rejectionReason: args.rejectionReason,
    });
    await ctx.db.patch(ver.mentorId, {
      mentorStatus: args.decision === "approved" ? "verified" : "rejected",
    });
  },
});
