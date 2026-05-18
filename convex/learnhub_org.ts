/**
 * Org Partner dashboard queries — overlays on top of learnhub_work and
 * learnhub_mentors. Centralised here so the route can pull a single
 * "summary" payload on mount instead of orchestrating four parallel
 * queries from the client.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

async function requireOrgManager(
  ctx: { db: { get: (id: Id<"learnhub_users">) => Promise<Doc<"learnhub_users"> | null> } },
  actorId: Id<"learnhub_users">,
): Promise<Doc<"learnhub_users">> {
  const actor = await ctx.db.get(actorId);
  if (!actor) throw new Error("FORBIDDEN: unknown actor");
  if (
    actor.role !== "org_partner" &&
    actor.role !== "coordinator" &&
    actor.role !== "admin"
  ) {
    throw new Error("FORBIDDEN: org_partner, coordinator, or admin only");
  }
  return actor;
}

// Bird's-eye view of what this Org Partner owns: their postings, applicant
// counts, pending mentor verifications, and active cohorts.
export const getOrgSummary = query({
  args: { orgId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return { forbidden: true as const };

    const opportunities = await ctx.db
      .query("learnhub_work_opportunities")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();

    // Hydrate each opportunity with applicant counts so the listing card
    // can show "12 applied" without a follow-up query per row.
    const opportunitiesWithStats = await Promise.all(
      opportunities.map(async (o) => {
        const apps = await ctx.db
          .query("learnhub_work_applications")
          .withIndex("by_opportunity", (q) => q.eq("opportunityId", o._id))
          .collect();
        return {
          id: o._id,
          title: o.title,
          status: o.status,
          workType: o.workType,
          payType: o.payType,
          slots: o.slots,
          filledSlots: o.filledSlots ?? 0,
          deadline: o.deadline,
          createdAt: o.createdAt,
          applicantCount: apps.length,
          acceptedCount: apps.filter(
            (a) => a.status === "accepted" || a.status === "in_progress" || a.status === "completed",
          ).length,
        };
      }),
    );

    // Pending mentor verifications. Loose org-scope today — surface every
    // "pending" entry to all org partners. Tighten once mentor verifications
    // carry an `orgId` field.
    const pendingVerifs = await ctx.db
      .query("learnhub_mentor_verifications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(50);
    const pendingMentors = await Promise.all(
      pendingVerifs.map(async (verif) => {
        const mentor = await ctx.db.get(verif.mentorId);
        return {
          verificationId: verif._id,
          mentor: mentor
            ? {
                id: mentor._id,
                name: mentor.name,
                avatarUrl: mentor.avatarUrl,
                designation: mentor.designation ?? null,
                regionalOffice: mentor.regionalOffice ?? null,
                expertiseTags: mentor.expertiseTags ?? [],
              }
            : null,
          submittedAt: verif.submittedAt,
          dictEmployeeId: verif.dictEmployeeId ?? null,
          designation: verif.designation ?? null,
          verificationDocUrl: verif.verificationDocUrl ?? null,
        };
      }),
    );

    // Cohorts the org touches. For now: every group of type "org" or
    // "program" the org partner created OR is admin of. Loose by design.
    const cohorts = await ctx.db
      .query("learnhub_groups")
      .filter((q) =>
        q.or(
          q.eq(q.field("createdBy"), args.orgId),
          q.eq(q.field("type"), "program"),
          q.eq(q.field("type"), "batch"),
        ),
      )
      .take(50);

    const totalApplicants = opportunitiesWithStats.reduce(
      (sum, o) => sum + o.applicantCount,
      0,
    );
    const openCount = opportunitiesWithStats.filter((o) => o.status === "open").length;

    return {
      forbidden: false as const,
      org: {
        id: org._id,
        name: org.name,
        avatarUrl: org.avatarUrl,
        organization: org.organization ?? null,
      },
      kpi: {
        totalOpportunities: opportunities.length,
        openOpportunities: openCount,
        totalApplicants,
        pendingMentors: pendingMentors.length,
        cohortCount: cohorts.length,
      },
      opportunities: opportunitiesWithStats,
      pendingMentors,
      cohorts: cohorts.map((c) => ({
        id: c._id,
        name: c.name,
        description: c.description,
        type: c.type,
        memberCount: c.memberCount,
        programType: c.programType ?? null,
        createdAt: c.createdAt,
      })),
    };
  },
});

// One-shot mentor approval. Wraps reviewVerification with role-checked
// helpers so the dashboard can call a single mutation.
export const verifyMentorApprove = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    verificationId: v.id("learnhub_mentor_verifications"),
  },
  handler: async (ctx, args) => {
    const actor = await requireOrgManager(ctx, args.actorId);
    const verif = await ctx.db.get(args.verificationId);
    if (!verif) throw new Error("Verification not found");
    if (verif.status !== "pending") {
      throw new Error("ALREADY_REVIEWED: verification already settled");
    }
    await ctx.db.patch(args.verificationId, {
      status: "approved",
      reviewedAt: Date.now(),
      reviewedBy: actor._id,
    });
    // Flip the mentor's status so they unlock mentor-only features.
    await ctx.db.patch(verif.mentorId, { mentorStatus: "verified" });
    return { ok: true };
  },
});

export const verifyMentorReject = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    verificationId: v.id("learnhub_mentor_verifications"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireOrgManager(ctx, args.actorId);
    const verif = await ctx.db.get(args.verificationId);
    if (!verif) throw new Error("Verification not found");
    await ctx.db.patch(args.verificationId, {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: actor._id,
      rejectionReason: args.reason ?? "Not eligible at this time.",
    });
    await ctx.db.patch(verif.mentorId, { mentorStatus: "rejected" });
    return { ok: true };
  },
});
