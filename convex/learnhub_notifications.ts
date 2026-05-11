// NOTE: intentionally NOT marked `"use node"`. We only need `fetch`,
// which Convex's default V8 action runtime supports natively.

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

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
