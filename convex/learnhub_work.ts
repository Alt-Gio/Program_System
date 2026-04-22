import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listOpenOpportunities = query({
  args: {
    workType: v.optional(v.union(v.literal("remote"), v.literal("hybrid"), v.literal("onsite"))),
    payType: v.optional(v.union(v.literal("volunteer"), v.literal("stipend"), v.literal("paid"))),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("learnhub_work_opportunities").withIndex("by_status", (q) => q.eq("status", "open"));
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
    orgId: v.id("learnhub_users"),
    orgName: v.string(),
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
    const now = Date.now();
    return await ctx.db.insert("learnhub_work_opportunities", {
      ...args,
      status: "open",
      createdAt: now,
    });
  },
});

export const closeOpportunity = mutation({
  args: { opportunityId: v.id("learnhub_work_opportunities"), orgId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp || opp.orgId !== args.orgId) throw new Error("Not found or unauthorized");
    await ctx.db.patch(args.opportunityId, { status: "closed" });
  },
});

export const applyForOpportunity = mutation({
  args: {
    opportunityId: v.id("learnhub_work_opportunities"),
    studentId: v.id("learnhub_users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    status: v.union(
      v.literal("applied"),
      v.literal("under_review"),
      v.literal("accepted"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, { status: args.status, updatedAt: Date.now() });
  },
});

export const endorseApplication = mutation({
  args: {
    applicationId: v.id("learnhub_work_applications"),
    mentorId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      mentorEndorsement: true,
      endorsedBy: args.mentorId,
      updatedAt: Date.now(),
    });
  },
});
