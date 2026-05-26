// NOTE: intentionally NOT marked `"use node"`. We only need `fetch`,
// which Convex's default V8 action runtime supports natively.

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Shared helper: best-effort POST to the in-app/FCM notification webhook.
// Returns silently on any failure — callers should not depend on delivery
// for correctness, only for UX.
async function sendNotification(payload: {
  userId: string;
  event: string;
  title: string;
  body: string;
  targetRoute: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const baseUrl = process.env.LH_INTERNAL_URL;
  const secret = process.env.LH_FORMS_WEBHOOK_SECRET;
  if (!baseUrl || !secret) return;
  try {
    await fetch(`${baseUrl}/api/learnhub/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learnhub-secret": secret,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[learnhub_notifications] send failed for ${payload.userId}:`, err);
  }
}

// Fan out a "new opportunity posted" notification to all students.
// Triggered from learnhub_work.createOpportunity via ctx.scheduler.
//
// Each student gets:
//   • Firestore write (in-app bell, real-time via NotificationProvider)
//   • Conditional FCM push (handled inside /api/learnhub/notifications/send
//     based on the user's notifPrefs.pushEnabled and quiet hours)
//
// Best-effort: a single failed fetch must not abort the rest of the fan-out.
export const notifyNewOpportunity = internalAction({
  args: { opportunityId: v.id("learnhub_work_opportunities") },
  handler: async (ctx, args) => {
    const opp = await ctx.runQuery(api.learnhub_work.getOpportunity, {
      id: args.opportunityId,
    });
    if (!opp) return;

    const baseUrl = process.env.LH_INTERNAL_URL;
    const secret = process.env.LH_FORMS_WEBHOOK_SECRET;
    if (!baseUrl || !secret) {
      console.warn(
        "[learnhub_notifications] LH_INTERNAL_URL or LH_FORMS_WEBHOOK_SECRET not set — skipping fan-out"
      );
      return;
    }

    const students = await ctx.runQuery(
      internal.learnhub_users.listStudentsForNotification,
      {}
    );

    const title = `New opportunity: ${opp.title}`;
    const body = `${opp.orgName} is hiring (${opp.workType} · ${opp.payType})`;
    const targetRoute = "/learnhub/work";

    await Promise.allSettled(
      students.map((student) =>
        fetch(`${baseUrl}/api/learnhub/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-learnhub-secret": secret,
          },
          body: JSON.stringify({
            userId: student._id,
            event: "work_opportunity_posted",
            title,
            body,
            targetRoute,
            data: {
              opportunityId: opp._id,
              workType: opp.workType,
              payType: opp.payType,
            },
          }),
        }).catch((err) => {
          console.error(
            `[learnhub_notifications] send failed for ${student._id}:`,
            err
          );
        })
      )
    );
  },
});

// Fan out "mentor awaiting verification" to all coordinators + admins so
// the review queue isn't silently backlogged. Triggered from learnhub_users.createUser
// when a self-onboarded mentor finishes the wizard.
export const notifyMentorPendingVerification = internalAction({
  args: { mentorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const mentor = await ctx.runQuery(api.learnhub_users.getUser, {
      id: args.mentorId,
    });
    if (!mentor) return;
    const verifiers = await ctx.runQuery(
      internal.learnhub_users.listVerifiersForNotification,
      {},
    );
    const title = `New mentor awaiting verification`;
    const body = `${mentor.name} signed up as a mentor. Review their profile.`;
    const targetRoute = "/learnhub/org/mentors";
    await Promise.allSettled(
      verifiers.map((u) =>
        sendNotification({
          userId: u._id,
          event: "mentor_verification_pending",
          title,
          body,
          targetRoute,
          data: { mentorId: mentor._id },
        }),
      ),
    );
  },
});

// Notify the mentor when their verification is approved or rejected so they
// know whether they're now visible on the marketplace. Triggered from
// learnhub_mentors.reviewVerification. On approval, also kicks off the
// match-available fan-out so learners with overlapping interests find out.
// Rec #2 — when a mentor accepts, nudge BOTH parties to schedule a first
// call. Deep link pre-fills the calendar new-event modal with the other
// party as an attendee.
export const notifyMentorshipAccepted = internalAction({
  args: { relationshipId: v.id("learnhub_mentoring_relationships") },
  handler: async (ctx, args) => {
    const rel = await ctx.runQuery(internal.learnhub_mentors.getRelationship, {
      relationshipId: args.relationshipId,
    });
    if (!rel) return;
    const [mentor, mentee] = await Promise.all([
      ctx.runQuery(api.learnhub_users.getUser, { id: rel.mentorId }),
      ctx.runQuery(api.learnhub_users.getUser, { id: rel.menteeId }),
    ]);

    const buildRoute = (attendeeId: string) =>
      `/learnhub/calendar?newEvent=1&attendee=${attendeeId}&title=${encodeURIComponent("Mentorship session")}`;

    // Notify mentee — their request was accepted.
    if (mentee && mentor) {
      await sendNotification({
        userId: rel.menteeId,
        event: "mentorship_accepted",
        title: `${mentor.name} accepted your request`,
        body: "Tap to schedule your first call.",
        targetRoute: buildRoute(rel.mentorId),
        data: { relationshipId: args.relationshipId, otherUserId: rel.mentorId },
      });
    }
    // Notify mentor too — gentle "schedule first call" reminder.
    if (mentor && mentee) {
      await sendNotification({
        userId: rel.mentorId,
        event: "mentorship_accepted",
        title: `Schedule a first call with ${mentee.name}`,
        body: "Connect your Calendar to set a session and Meet link.",
        targetRoute: buildRoute(rel.menteeId),
        data: { relationshipId: args.relationshipId, otherUserId: rel.menteeId },
      });
    }
  },
});

// Phase 9.B — when a learner requests a mentor, fan a notification to the
// mentor so they know to act on it.
export const notifyMentorshipRequestReceived = internalAction({
  args: { relationshipId: v.id("learnhub_mentoring_relationships") },
  handler: async (ctx, args) => {
    const rel = await ctx.runQuery(internal.learnhub_mentors.getRelationship, {
      relationshipId: args.relationshipId,
    });
    if (!rel) return;
    const mentee = await ctx.runQuery(api.learnhub_users.getUser, {
      id: rel.menteeId,
    });
    const menteeName = mentee?.name ?? "A learner";
    const snippet = (rel.requestNote ?? "").slice(0, 120);
    await sendNotification({
      userId: rel.mentorId,
      event: "mentorship_request_received",
      title: `New mentorship request from ${menteeName}`,
      body: snippet || "Tap to review and accept or decline.",
      targetRoute: "/learnhub/mentor",
      data: { relationshipId: args.relationshipId },
    });
  },
});

export const notifyMentorVerificationResult = internalAction({
  args: {
    mentorId: v.id("learnhub_users"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mentor = await ctx.runQuery(api.learnhub_users.getUser, {
      id: args.mentorId,
    });
    if (!mentor) return;
    const approved = args.decision === "approved";
    const title = approved
      ? "You're verified — welcome to the marketplace"
      : "Your mentor application needs another look";
    const body = approved
      ? "Learners can now find you on /learnhub/mentors and send mentorship requests."
      : args.rejectionReason
        ? `Reason: ${args.rejectionReason}. You can update your profile and re-apply.`
        : "Update your profile and re-apply when ready.";
    await sendNotification({
      userId: mentor._id,
      event: approved ? "mentor_verified" : "mentor_verification_rejected",
      title,
      body,
      targetRoute: approved ? "/learnhub/mentors" : "/learnhub/mentor",
      data: { decision: args.decision },
    });

    if (approved) {
      await ctx.scheduler.runAfter(
        0,
        internal.learnhub_notifications.notifyMentorMatchAvailable,
        { mentorId: mentor._id },
      );
    }
  },
});

// When a mentor is freshly verified, nudge learners whose interests overlap
// the mentor's expertise. Uses normalized-string match so custom tags
// ("Veterinary Medicine") match the same way curated ones do.
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export const notifyMentorMatchAvailable = internalAction({
  args: { mentorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const mentor = await ctx.runQuery(api.learnhub_users.getUser, {
      id: args.mentorId,
    });
    if (!mentor) return;
    const mentorTags = new Set(
      [...(mentor.expertiseTags ?? []), ...(mentor.interests ?? [])]
        .map(normalize)
        .filter((t) => t.length > 0),
    );
    if (mentorTags.size === 0) return;

    const learners = await ctx.runQuery(
      internal.learnhub_users.listStudentsForNotification,
      {},
    );
    const matched = learners.filter((u) => {
      const tags = (u.interests ?? []).map(normalize);
      return tags.some((t) => mentorTags.has(t));
    });
    const title = `A mentor matching your interests just joined`;
    const body = `${mentor.name} is now verified and accepting mentees.`;
    await Promise.allSettled(
      matched.map((u) =>
        sendNotification({
          userId: u._id,
          event: "mentor_match_available",
          title,
          body,
          targetRoute: "/learnhub/mentors",
          data: { mentorId: mentor._id },
        }),
      ),
    );
  },
});

// Daily cron: surface users with ≥5 due flashcards so the spaced-repetition
// subsystem isn't invisible. Iterates students (≤500) and runs a per-user
// count query — fine at this scale; revisit with pagination if learner base
// grows past low thousands.
export const notifyFlashcardsDue = internalAction({
  args: {},
  handler: async (ctx) => {
    const learners = await ctx.runQuery(
      internal.learnhub_users.listStudentsForNotification,
      {},
    );
    const now = Date.now();
    for (const u of learners) {
      const dueCount = await ctx.runQuery(
        internal.learnhub_video_flow.countDueFlashcards,
        { userId: u._id, asOf: now },
      );
      if (dueCount < 5) continue;
      await sendNotification({
        userId: u._id,
        event: "flashcards_due",
        title: `${dueCount} flashcards due for review`,
        body: "Spend a few minutes to keep your spaced-repetition streak alive.",
        targetRoute: "/learnhub/learning-path",
        data: { dueCount },
      });
    }
  },
});

// Weekly digest (Sunday 09:00 UTC ≈ 17:00 PHT). Pulls last 7 days of
// activity per learner and sends one summary notification. Skips learners
// with zero activity all week — there's nothing to recap and we'd rather
// not spam a dormant account.
export const notifyWeeklyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const learners = await ctx.runQuery(
      internal.learnhub_users.listStudentsForNotification,
      {},
    );
    // 7 days ago in YYYY-MM-DD form so it matches xp_events.date.
    const sinceDate = new Date(Date.now() - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    for (const u of learners) {
      const summary = await ctx.runQuery(
        internal.learnhub_xp.weeklyDigestSummary,
        { userId: u._id, sinceDate },
      );
      if (summary.eventCount === 0) continue;
      const parts: string[] = [];
      if (summary.bySource.video_completion)
        parts.push(`${summary.bySource.video_completion} videos`);
      if (summary.bySource.flashcard_review)
        parts.push(`${summary.bySource.flashcard_review} flashcards`);
      if (summary.bySource.journal_habit)
        parts.push(`${summary.bySource.journal_habit} journals`);
      if (summary.bySource.work_completion)
        parts.push(`${summary.bySource.work_completion} work wins`);
      const headline = parts.length > 0
        ? parts.join(" · ")
        : `${summary.eventCount} activities`;
      const streakPart = (u.currentStreak ?? 0) > 0
        ? `Current streak: ${u.currentStreak} day${u.currentStreak === 1 ? "" : "s"}.`
        : "Pick a day this week to start a streak.";
      await sendNotification({
        userId: u._id,
        event: "weekly_digest",
        title: `Your week: ${summary.totalXp} XP earned`,
        body: `${headline}. ${streakPart}`,
        targetRoute: "/learnhub/today",
        data: { totalXp: summary.totalXp, eventCount: summary.eventCount },
      });

      // Rec #8 — also deliver as an email if the learner opted into the
      // weekly cadence. Daily-cadence subscribers are handled separately by
      // notifyDailyDigest. Best-effort: a Resend failure should not abort
      // the per-user loop.
      if (u.notifPrefs?.emailDigest === "weekly" && u.email) {
        try {
          const appUrl = process.env.LH_INTERNAL_URL ?? "";
          await ctx.runAction(internal.emails.sendLearnHubDigest, {
            to: u.email,
            learnerName: u.name ?? "there",
            cadence: "weekly",
            headline: `${summary.totalXp} XP earned this week`,
            summary: `You logged ${headline} across ${summary.eventCount} activit${summary.eventCount === 1 ? "y" : "ies"} in the last 7 days.`,
            streakLine: streakPart,
            targetUrl: `${appUrl.replace(/\/$/, "")}/learnhub/today`,
          });
        } catch (err) {
          console.error("[learnhub_notifications] weekly digest email failed for", u._id, err);
        }
      }
    }
  },
});

// Rec #8 — Daily digest for learners on the "daily" cadence. Mirrors the
// weekly handler's shape, but bounded to today's activity so the email is
// short and motivational rather than a full recap. Skips users with no
// activity yet today AND no current streak — there's literally nothing to
// say and we'd rather not annoy a dormant account.
export const notifyDailyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const learners = await ctx.runQuery(
      internal.learnhub_users.listStudentsForNotification,
      {},
    );
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const appUrl = process.env.LH_INTERNAL_URL ?? "";

    for (const u of learners) {
      if (u.notifPrefs?.emailDigest !== "daily") continue;
      if (!u.email) continue;

      const activeToday = await ctx.runQuery(
        internal.learnhub_xp.hasActivityToday,
        { userId: u._id, date: today },
      );
      const streak = u.currentStreak ?? 0;
      if (!activeToday && streak === 0) continue;

      const headline = activeToday
        ? `Streak protected · ${streak || 1} day${streak === 1 ? "" : "s"}`
        : `Your ${streak}-day streak is at risk`;
      const summaryText = activeToday
        ? `Nice — today's activity is logged. Keep momentum going with one more module, video, or journal entry.`
        : `You haven't logged anything today yet. Even a 5-minute review keeps your streak alive.`;
      const streakLine = activeToday
        ? `Current streak: ${streak} day${streak === 1 ? "" : "s"}. Longest: ${u.longestStreak ?? streak}.`
        : `Open a video, flashcard set, or journal entry before midnight PHT.`;

      try {
        await ctx.runAction(internal.emails.sendLearnHubDigest, {
          to: u.email,
          learnerName: u.name ?? "there",
          cadence: "daily",
          headline,
          summary: summaryText,
          streakLine,
          targetUrl: `${appUrl.replace(/\/$/, "")}/learnhub/today`,
        });
      } catch (err) {
        console.error("[learnhub_notifications] daily digest email failed for", u._id, err);
      }
    }
  },
});

// Daily cron: nudge users who haven't logged any XP today (no daily_login,
// journal entry, video completion, work win, etc.). Only nudges users who
// have a streak worth losing (currentStreak >= 2) so first-day users don't
// get unsolicited "you're going to break your streak" alarms.
export const notifyStreakAtRisk = internalAction({
  args: {},
  handler: async (ctx) => {
    const learners = await ctx.runQuery(
      internal.learnhub_users.listStudentsForNotification,
      {},
    );
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    for (const u of learners) {
      if ((u.currentStreak ?? 0) < 2) continue;
      const todaysActivity = await ctx.runQuery(
        internal.learnhub_xp.hasActivityToday,
        { userId: u._id, date: today },
      );
      if (todaysActivity) continue;
      await sendNotification({
        userId: u._id,
        event: "streak_at_risk",
        title: `Your ${u.currentStreak}-day streak is at risk`,
        body: "Open a video, journal entry, or habit log to keep it going.",
        targetRoute: "/learnhub/feed",
        data: { currentStreak: u.currentStreak },
      });
    }
  },
});
