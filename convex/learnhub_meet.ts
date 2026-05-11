// NOTE: V8 runtime — `fetch` is available natively.
// This module owns the lifecycle of Meet posts: "starting soon" bell,
// isLive promotion at scheduledAt, and the back-to-false flip when the
// duration window has passed. Scheduling happens from
// convex/learnhub_posts.ts:createPost.

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { api, internal } from "./_generated/api";

// ── Internal queries / mutations ────────────────────────────────────

export const _getPost = internalQuery({
  args: { postId: v.id("learnhub_posts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.postId);
  },
});

export const markLive = internalMutation({
  args: { postId: v.id("learnhub_posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post || post.type !== "meet") return;
    const m = (post.metadata ?? {}) as Record<string, unknown>;
    await ctx.db.patch(args.postId, {
      metadata: { ...m, isLive: true },
      updatedAt: Date.now(),
    });
  },
});

export const markEnded = internalMutation({
  args: { postId: v.id("learnhub_posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post || post.type !== "meet") return;
    const m = (post.metadata ?? {}) as Record<string, unknown>;
    await ctx.db.patch(args.postId, {
      metadata: { ...m, isLive: false },
      updatedAt: Date.now(),
    });
  },
});

// ── Fan-out: "Starting soon" bell + push 15 minutes before ──────────

export const notifyStartingSoon = internalAction({
  args: { postId: v.id("learnhub_posts") },
  handler: async (ctx, args) => {
    const post = await ctx.runQuery(internal.learnhub_meet._getPost, {
      postId: args.postId,
    });
    if (!post || post.type !== "meet") return;
    const m = (post.metadata ?? {}) as Record<string, unknown>;
    const meetLink = (m.meetLink as string) ?? "/learnhub/calendar";

    const baseUrl = process.env.LH_INTERNAL_URL;
    const secret = process.env.LH_FORMS_WEBHOOK_SECRET;
    if (!baseUrl || !secret) {
      console.warn("[learnhub_meet] LH_INTERNAL_URL or LH_FORMS_WEBHOOK_SECRET not set — skipping fan-out");
      return;
    }

    const students = await ctx.runQuery(
      internal.learnhub_users.listStudentsForNotification,
      {}
    );

    const title = `Starting soon: ${post.content?.slice(0, 60) ?? "Meeting"}`;
    const body = "Join in 15 minutes";

    await Promise.allSettled(
      students.map((s) =>
        fetch(`${baseUrl}/api/learnhub/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-learnhub-secret": secret,
          },
          body: JSON.stringify({
            userId: s._id,
            event: "meet_starting",
            title,
            body,
            targetRoute: meetLink,
            data: { postId: args.postId },
          }),
        }).catch((err) => {
          console.error(`[learnhub_meet] send failed for ${s._id}:`, err);
        })
      )
    );
  },
});

// Combined helper: schedule the three lifecycle hooks for a new Meet post.
// Called from createPost in convex/learnhub_posts.ts.
export const scheduleLifecycle = internalAction({
  args: {
    postId: v.id("learnhub_posts"),
    scheduledAt: v.number(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const startingSoonAt = args.scheduledAt - 15 * 60_000;
    const endAt = args.scheduledAt + args.durationMinutes * 60_000;

    if (startingSoonAt > now) {
      await ctx.scheduler.runAt(
        startingSoonAt,
        internal.learnhub_meet.notifyStartingSoon,
        { postId: args.postId }
      );
    }
    if (args.scheduledAt > now) {
      await ctx.scheduler.runAt(
        args.scheduledAt,
        internal.learnhub_meet.markLive,
        { postId: args.postId }
      );
    }
    if (endAt > now) {
      await ctx.scheduler.runAt(
        endAt,
        internal.learnhub_meet.markEnded,
        { postId: args.postId }
      );
    }
  },
});

// Silence unused-import warning for `api` until callers grow.
void api;
