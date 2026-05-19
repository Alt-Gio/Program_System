import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { awardLearnHubXp } from "./learnhub_xp";
import { evaluateAndAwardForUser } from "./learnhub_badges";
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
    await ctx.scheduler.runAfter(
      0,
      internal.learnhub_notifications.notifyMentorVerificationResult,
      {
        mentorId: ver.mentorId,
        decision: args.decision,
        rejectionReason: args.rejectionReason,
      },
    );
  },
});

// ── Mentor Marketplace ────────────────────────────────────────────────────────
//
// Public-facing queries/mutations that power /learnhub/mentors. Reads use the
// existing learnhub_users table; writes go to learnhub_mentoring_relationships.
// We always derive the *live* active-mentee count from the relationships table
// rather than trusting the stale currentMenteeCount field on the user record.

// Status sort order: verified mentors first (most useful to learners), then
// pending_verification (will be visible soon), then anything else, then
// suspended/rejected last so they sink to the bottom of the marketplace.
const MENTOR_STATUS_SORT: Record<string, number> = {
  verified: 0,
  pending_verification: 1,
  suspended: 3,
  rejected: 4,
};

export const listAvailableMentors = query({
  args: {},
  handler: async (ctx) => {
    const mentors = await ctx.db
      .query("learnhub_users")
      .withIndex("by_role", (q) => q.eq("role", "mentor"))
      .collect();

    // Surface ALL mentors (not just verified) so the marketplace stays
    // populated for new deployments and so learners can see pending mentors
    // who are awaiting review. The Request CTA is gated client-side and the
    // server-side `requestMentorship` mutation still rejects requests to
    // non-verified mentors, so visibility ≠ requestability.
    const hydrated = await Promise.all(
      mentors.map(async (m) => {
        const active = await ctx.db
          .query("learnhub_mentoring_relationships")
          .withIndex("by_mentor", (q) => q.eq("mentorId", m._id))
          .collect();
        const activeCount = active.filter((r) => r.status === "active").length;
        const maxMentees = m.maxMentees ?? null;
        const hasCapacity = maxMentees === null ? true : activeCount < maxMentees;
        return {
          _id: m._id,
          name: m.name,
          avatarUrl: m.avatarUrl,
          bio: m.bio ?? null,
          designation: m.designation ?? null,
          regionalOffice: m.regionalOffice ?? null,
          province: m.province ?? null,
          expertiseTags: m.expertiseTags ?? [],
          interests: m.interests ?? [],
          activeMenteeCount: activeCount,
          maxMentees,
          hasCapacity,
          mentorStatus: m.mentorStatus ?? null,
        };
      })
    );

    hydrated.sort((a, b) => {
      const sa = MENTOR_STATUS_SORT[a.mentorStatus ?? ""] ?? 2;
      const sb = MENTOR_STATUS_SORT[b.mentorStatus ?? ""] ?? 2;
      if (sa !== sb) return sa - sb;
      return a.activeMenteeCount - b.activeMenteeCount;
    });

    return hydrated;
  },
});

export const getMentorProfile = query({
  args: { id: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.id);
    if (!m || m.role !== "mentor") return null;
    const active = await ctx.db
      .query("learnhub_mentoring_relationships")
      .withIndex("by_mentor", (q) => q.eq("mentorId", m._id))
      .collect();
    const activeCount = active.filter((r) => r.status === "active").length;
    const maxMentees = m.maxMentees ?? null;
    return {
      _id: m._id,
      name: m.name,
      avatarUrl: m.avatarUrl,
      bio: m.bio ?? null,
      designation: m.designation ?? null,
      regionalOffice: m.regionalOffice ?? null,
      province: m.province ?? null,
      expertiseTags: m.expertiseTags ?? [],
      interests: m.interests ?? [],
      activeMenteeCount: activeCount,
      maxMentees,
      hasCapacity: maxMentees === null ? true : activeCount < maxMentees,
      mentorStatus: m.mentorStatus ?? null,
    };
  },
});

// Returns the most recent relationship between this learner and this mentor,
// or null. The UI switches the CTA based on this: "Request" / "Pending" /
// "Active" / "Request again".
export const getMentorshipRequest = query({
  args: {
    menteeId: v.id("learnhub_users"),
    mentorId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("learnhub_mentoring_relationships")
      .withIndex("by_mentee", (q) => q.eq("menteeId", args.menteeId))
      .collect();
    const withMentor = rows.filter((r) => r.mentorId === args.mentorId);
    if (withMentor.length === 0) return null;
    withMentor.sort((a, b) => b.createdAt - a.createdAt);
    return withMentor[0];
  },
});

export const listMyMentorships = query({
  args: { menteeId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("learnhub_mentoring_relationships")
      .withIndex("by_mentee", (q) => q.eq("menteeId", args.menteeId))
      .order("desc")
      .collect();
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        mentor: await ctx.db.get(r.mentorId),
      }))
    );
  },
});

export const listIncomingRequests = query({
  args: { mentorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("learnhub_mentoring_relationships")
      .withIndex("by_mentor", (q) => q.eq("mentorId", args.mentorId))
      .order("desc")
      .collect();
    return Promise.all(
      rows
        .filter((r) => r.status === "requested" || r.status === "active")
        .map(async (r) => ({
          ...r,
          mentee: await ctx.db.get(r.menteeId),
        }))
    );
  },
});

// Submit a mentorship request. Validates:
//   - not self-request
//   - target is a verified mentor
//   - mentor has capacity (active < max)
//   - no existing requested/active row with this mentor for this learner
//   - note is non-empty (we want context, not anonymous spam)
export const requestMentorship = mutation({
  args: {
    menteeId: v.id("learnhub_users"),
    mentorId: v.id("learnhub_users"),
    requestNote: v.string(),
    goals: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.menteeId === args.mentorId) {
      throw new Error("SELF_REQUEST: cannot mentor yourself.");
    }
    const trimmed = args.requestNote.trim();
    if (trimmed.length < 10) {
      throw new Error("NOTE_TOO_SHORT: please write a short intro (10+ chars).");
    }

    const mentor = await ctx.db.get(args.mentorId);
    if (!mentor || mentor.role !== "mentor") {
      throw new Error("NOT_A_MENTOR: target user is not a mentor.");
    }
    if (mentor.mentorStatus !== "verified") {
      throw new Error("NOT_VERIFIED: this mentor isn't accepting requests yet.");
    }

    const existing = await ctx.db
      .query("learnhub_mentoring_relationships")
      .withIndex("by_mentor", (q) => q.eq("mentorId", args.mentorId))
      .collect();
    const activeCount = existing.filter((r) => r.status === "active").length;
    if (mentor.maxMentees != null && activeCount >= mentor.maxMentees) {
      throw new Error("AT_CAPACITY: this mentor is at their mentee limit.");
    }

    const dupe = existing.find(
      (r) =>
        r.menteeId === args.menteeId &&
        (r.status === "requested" || r.status === "active"),
    );
    if (dupe) {
      throw new Error("DUPLICATE: you already have a pending or active request.");
    }

    const now = Date.now();
    const goals = (args.goals ?? [])
      .map((g) => g.trim())
      .filter((g) => g.length > 0 && g.length <= 120)
      .slice(0, 5);

    return await ctx.db.insert("learnhub_mentoring_relationships", {
      mentorId: args.mentorId,
      menteeId: args.menteeId,
      status: "requested",
      requestNote: trimmed.slice(0, 800),
      goals,
      meetingNotes: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const respondToMentorshipRequest = mutation({
  args: {
    relationshipId: v.id("learnhub_mentoring_relationships"),
    mentorId: v.id("learnhub_users"),
    decision: v.union(v.literal("accept"), v.literal("decline")),
  },
  handler: async (ctx, args) => {
    const rel = await ctx.db.get(args.relationshipId);
    if (!rel) throw new Error("NOT_FOUND");
    if (rel.mentorId !== args.mentorId) {
      throw new Error("NOT_OWNER: only the target mentor can respond.");
    }
    if (rel.status !== "requested") {
      throw new Error(`BAD_STATE: request is already ${rel.status}.`);
    }

    if (args.decision === "decline") {
      await ctx.db.patch(rel._id, {
        status: "declined",
        updatedAt: Date.now(),
      });
      return { ok: true };
    }

    // Capacity recheck — another request may have filled the slot while this
    // one was pending in the inbox.
    const mentor = await ctx.db.get(rel.mentorId);
    if (mentor?.maxMentees != null) {
      const peers = await ctx.db
        .query("learnhub_mentoring_relationships")
        .withIndex("by_mentor", (q) => q.eq("mentorId", rel.mentorId))
        .collect();
      const activeCount = peers.filter((r) => r.status === "active").length;
      if (activeCount >= mentor.maxMentees) {
        throw new Error("AT_CAPACITY: you've reached your mentee limit.");
      }
    }

    await ctx.db.patch(rel._id, { status: "active", updatedAt: Date.now() });
    if (mentor) {
      const cached = mentor.currentMenteeCount ?? 0;
      await ctx.db.patch(rel.mentorId, { currentMenteeCount: cached + 1 });
    }

    // Reward the mentor for accepting a mentee. Idempotency key uses the
    // relationship id so a re-accept (which shouldn't be possible given the
    // BAD_STATE guard above) can never double-credit.
    await awardLearnHubXp(ctx, {
      userId: rel.mentorId,
      amount: 50,
      reason: "Accepted a mentee",
      sourceType: "mentor_acceptance",
      sourceId: rel._id,
      idempotencyKey: `mentor_acceptance:${rel._id}`,
    });

    // The mentee may have just earned the Mentor Magnet badge.
    await evaluateAndAwardForUser(ctx, rel.menteeId);
    return { ok: true };
  },
});

export const completeMentorship = mutation({
  args: {
    relationshipId: v.id("learnhub_mentoring_relationships"),
    callerId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const rel = await ctx.db.get(args.relationshipId);
    if (!rel) throw new Error("NOT_FOUND");
    if (rel.mentorId !== args.callerId && rel.menteeId !== args.callerId) {
      throw new Error("NOT_PARTY: only the mentor or mentee can close this.");
    }
    if (rel.status !== "active") {
      throw new Error(`BAD_STATE: cannot complete a ${rel.status} relationship.`);
    }
    await ctx.db.patch(rel._id, { status: "completed", updatedAt: Date.now() });
    const mentor = await ctx.db.get(rel.mentorId);
    if (mentor) {
      const cached = mentor.currentMenteeCount ?? 0;
      await ctx.db.patch(rel.mentorId, {
        currentMenteeCount: Math.max(0, cached - 1),
      });
    }
    return { ok: true };
  },
});
