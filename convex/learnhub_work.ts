import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ── Auth helper ──────────────────────────────────────────────
// LearnHub doesn't wire ctx.auth.getUserIdentity(); every mutation
// trusts a passed actorId and we authorize by reading the user doc.
async function requireActor(
  ctx: MutationCtx,
  actorId: Id<"learnhub_users">,
  allowedRoles: ReadonlyArray<"student" | "mentor" | "org_partner" | "admin">
) {
  const actor = await ctx.db.get(actorId);
  if (!actor) throw new Error("Actor not found");
  if (!allowedRoles.includes(actor.role)) {
    throw new Error(`Forbidden: role "${actor.role}" cannot perform this action`);
  }
  return actor;
}

export const listOpenOpportunities = query({
  args: {
    workType: v.optional(v.union(v.literal("remote"), v.literal("hybrid"), v.literal("onsite"))),
    payType: v.optional(v.union(v.literal("volunteer"), v.literal("stipend"), v.literal("paid"))),
  },
  handler: async (ctx, args) => {
    const q = ctx.db.query("learnhub_work_opportunities").withIndex("by_status", (q) => q.eq("status", "open"));
    const results = await q.collect();
    return results
      .filter((o) => (!args.workType || o.workType === args.workType) && (!args.payType || o.payType === args.payType))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getOpportunity = query({
  args: { id: v.id("learnhub_work_opportunities") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const listOrgOpportunities = query({
  args: { orgId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_work_opportunities")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
  },
});

export const createOpportunity = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    orgLogoUrl: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    requiredCertTypes: v.array(v.string()),
    workType: v.union(v.literal("remote"), v.literal("hybrid"), v.literal("onsite")),
    payType: v.union(v.literal("volunteer"), v.literal("stipend"), v.literal("paid")),
    payAmount: v.optional(v.string()),
    slots: v.number(),
    deadline: v.number(),
    duration: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["org_partner", "admin"]);
    if (args.slots < 1) throw new Error("Slots must be at least 1");
    if (args.deadline < Date.now()) throw new Error("Deadline must be in the future");

    const { actorId: _ignored, ...rest } = args;
    void _ignored;
    const opportunityId = await ctx.db.insert("learnhub_work_opportunities", {
      ...rest,
      orgId: actor._id,
      orgName: actor.name,
      status: "open",
      createdAt: Date.now(),
    });

    // Fan out push/in-app notifications to students (best-effort, async)
    await ctx.scheduler.runAfter(
      0,
      internal.learnhub_notifications.notifyNewOpportunity,
      { opportunityId }
    );

    return opportunityId;
  },
});

export const closeOpportunity = mutation({
  args: {
    opportunityId: v.id("learnhub_work_opportunities"),
    actorId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["org_partner", "admin"]);
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Opportunity not found");
    if (opp.orgId !== actor._id && actor.role !== "admin") {
      throw new Error("Forbidden: not your opportunity");
    }
    await ctx.db.patch(args.opportunityId, { status: "closed" });
  },
});

export const applyForOpportunity = mutation({
  args: {
    opportunityId: v.id("learnhub_work_opportunities"),
    studentId: v.id("learnhub_users"),
    actorId: v.id("learnhub_users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["student"]);
    if (actor._id !== args.studentId) {
      throw new Error("Forbidden: can only apply for yourself");
    }
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Opportunity not found");
    if (opp.status !== "open") throw new Error("Opportunity is not open");
    if (opp.deadline < Date.now()) throw new Error("Applications are closed");
    if ((opp.filledSlots ?? 0) >= opp.slots) throw new Error("All slots are filled");

    const existing = await ctx.db
      .query("learnhub_work_applications")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .filter((q) => q.eq(q.field("opportunityId"), args.opportunityId))
      .unique();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("learnhub_work_applications", {
      opportunityId: args.opportunityId,
      studentId: args.studentId,
      note: args.note,
      status: "applied",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMyApplication = query({
  args: {
    opportunityId: v.id("learnhub_work_opportunities"),
    studentId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_work_applications")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .filter((q) => q.eq(q.field("opportunityId"), args.opportunityId))
      .unique();
  },
});

export const listApplicationsForOpportunity = query({
  args: { opportunityId: v.id("learnhub_work_opportunities") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("learnhub_work_applications")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .collect();
    return Promise.all(
      apps.map(async (a) => ({ ...a, student: await ctx.db.get(a.studentId) }))
    );
  },
});

export const updateApplicationStatus = mutation({
  args: {
    applicationId: v.id("learnhub_work_applications"),
    actorId: v.id("learnhub_users"),
    status: v.union(
      v.literal("applied"),
      v.literal("under_review"),
      v.literal("accepted"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["org_partner", "admin"]);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const opp = await ctx.db.get(app.opportunityId);
    if (!opp) throw new Error("Opportunity not found");
    if (opp.orgId !== actor._id && actor.role !== "admin") {
      throw new Error("Forbidden: not your opportunity");
    }

    const prevStatus = app.status;
    const patch: {
      status: typeof args.status;
      updatedAt: number;
      completedAt?: number;
    } = { status: args.status, updatedAt: Date.now() };

    // Increment filled-slot counter when transitioning into "accepted"
    if (args.status === "accepted" && prevStatus !== "accepted") {
      await ctx.db.patch(opp._id, {
        filledSlots: (opp.filledSlots ?? 0) + 1,
      });
    }

    // Completion rewards loop — idempotent via completedAt
    if (args.status === "completed" && !app.completedAt) {
      const student = await ctx.db.get(app.studentId);
      if (!student) throw new Error("Student not found");

      // Award XP inline (avoid ctx.runMutation TS circularity)
      await ctx.db.patch(student._id, {
        xpPoints: student.xpPoints + 200,
      });

      // Issue work_completion certificate inline
      const verificationId =
        "LH-" +
        new Date().getFullYear() +
        "-" +
        opp.orgName.toUpperCase().replace(/\s+/g, "").slice(0, 6) +
        "-" +
        Math.floor(Math.random() * 9000 + 1000);

      await ctx.db.insert("learnhub_certificates", {
        studentEmail: student.email,
        studentId: student._id,
        courseTitle: opp.title,
        programType: opp.orgName,
        issuedBy: opp.orgId,
        issuedByName: opp.orgName,
        certType: "work_completion",
        verificationId,
        status: "issued",
        issuedAt: Date.now(),
      });

      patch.completedAt = Date.now();
    }

    await ctx.db.patch(args.applicationId, patch);
  },
});

export const endorseApplication = mutation({
  args: {
    applicationId: v.id("learnhub_work_applications"),
    mentorId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    const mentor = await ctx.db.get(args.mentorId);
    if (!mentor) throw new Error("Mentor not found");
    const isVerifiedMentor =
      mentor.role === "mentor" && mentor.mentorStatus === "verified";
    if (!isVerifiedMentor && mentor.role !== "admin") {
      throw new Error("Forbidden: only verified mentors or admins can endorse");
    }
    await ctx.db.patch(args.applicationId, {
      mentorEndorsement: true,
      endorsedBy: args.mentorId,
      updatedAt: Date.now(),
    });
  },
});
