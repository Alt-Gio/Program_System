import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Form Queries ──────────────────────────────────────────────────────────────

export const getForm = query({
  args: { formId: v.id("learnhub_forms") },
  handler: async (ctx, args) => ctx.db.get(args.formId),
});

export const listFormsByCreator = query({
  args: { createdBy: v.id("learnhub_users") },
  handler: async (ctx, args) =>
    ctx.db
      .query("learnhub_forms")
      .withIndex("by_creator", (q) => q.eq("createdBy", args.createdBy))
      .order("desc")
      .collect(),
});

export const listSystemForms = query({
  args: {},
  handler: async (ctx) => {
    const forms = await ctx.db.query("learnhub_forms").collect();
    return forms.filter((f) => f.isSystem);
  },
});

// ── Form Mutations ────────────────────────────────────────────────────────────

export const createForm = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("learnhub_users"),
    formType: v.string(),
    isSystem: v.boolean(),
    isStepByStep: v.boolean(),
    showProgressBar: v.boolean(),
    allowMultipleSubmissions: v.boolean(),
    requireAuth: v.boolean(),
    passingScore: v.optional(v.number()),
    fields: v.array(v.object({
      id: v.string(),
      type: v.string(),
      label: v.string(),
      placeholder: v.optional(v.string()),
      helpText: v.optional(v.string()),
      required: v.boolean(),
      options: v.optional(v.array(v.string())),
      validation: v.optional(v.any()),
      conditions: v.optional(v.array(v.any())),
      points: v.optional(v.number()),
      correctAnswer: v.optional(v.string()),
    })),
    successMessage: v.optional(v.string()),
    redirectAfterSubmit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("learnhub_forms", { ...args, createdAt: now, updatedAt: now });
  },
});

export const updateForm = mutation({
  args: {
    formId: v.id("learnhub_forms"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    fields: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      label: v.string(),
      placeholder: v.optional(v.string()),
      helpText: v.optional(v.string()),
      required: v.boolean(),
      options: v.optional(v.array(v.string())),
      validation: v.optional(v.any()),
      conditions: v.optional(v.array(v.any())),
      points: v.optional(v.number()),
      correctAnswer: v.optional(v.string()),
    }))),
    isStepByStep: v.optional(v.boolean()),
    showProgressBar: v.optional(v.boolean()),
    passingScore: v.optional(v.number()),
    successMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { formId, ...patch } = args;
    await ctx.db.patch(formId, { ...patch, updatedAt: Date.now() });
  },
});

export const deleteForm = mutation({
  args: { formId: v.id("learnhub_forms") },
  handler: async (ctx, args) => ctx.db.delete(args.formId),
});

// ── Submission Queries ────────────────────────────────────────────────────────

export const listSubmissions = query({
  args: { formId: v.id("learnhub_forms") },
  handler: async (ctx, args) =>
    ctx.db
      .query("learnhub_form_submissions")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .order("desc")
      .collect(),
});

export const listSubmissionsWithUsers = query({
  args: { formId: v.id("learnhub_forms") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("learnhub_form_submissions")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .order("desc")
      .collect();
    return Promise.all(
      subs.map(async (s) => ({
        ...s,
        user: s.submittedBy ? await ctx.db.get(s.submittedBy) : null,
      }))
    );
  },
});

export const getUserSubmission = query({
  args: { formId: v.id("learnhub_forms"), userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("learnhub_form_submissions")
      .withIndex("by_user", (q) => q.eq("submittedBy", args.userId))
      .collect();
    return subs.find((s) => s.formId === args.formId && !s.isPartial) ?? null;
  },
});

// ── Submission Mutations ──────────────────────────────────────────────────────

export const submitForm = mutation({
  args: {
    formId: v.id("learnhub_forms"),
    submittedBy: v.optional(v.id("learnhub_users")),
    submitterEmail: v.optional(v.string()),
    responses: v.array(v.object({ fieldId: v.string(), value: v.any() })),
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    passed: v.optional(v.boolean()),
    timeToComplete: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("learnhub_form_submissions", {
      ...args,
      isPartial: false,
      submittedAt: Date.now(),
    }),
});

export const savePartialSubmission = mutation({
  args: {
    formId: v.id("learnhub_forms"),
    submittedBy: v.optional(v.id("learnhub_users")),
    responses: v.array(v.object({ fieldId: v.string(), value: v.any() })),
  },
  handler: async (ctx, args) => {
    if (args.submittedBy) {
      const existing = await ctx.db
        .query("learnhub_form_submissions")
        .withIndex("by_user", (q) => q.eq("submittedBy", args.submittedBy!))
        .filter((q) => q.and(q.eq(q.field("formId"), args.formId), q.eq(q.field("isPartial"), true)))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { responses: args.responses });
        return existing._id;
      }
    }
    return ctx.db.insert("learnhub_form_submissions", {
      formId: args.formId,
      submittedBy: args.submittedBy,
      responses: args.responses,
      isPartial: true,
      submittedAt: Date.now(),
    });
  },
});

export const getSubmissionStats = query({
  args: { formId: v.id("learnhub_forms") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("learnhub_form_submissions")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .filter((q) => q.eq(q.field("isPartial"), false))
      .collect();

    const total = subs.length;
    const scored = subs.filter((s) => s.score !== undefined);
    const avgScore = scored.length > 0 ? scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length : null;
    const passRate = scored.length > 0 ? (scored.filter((s) => s.passed).length / scored.length) * 100 : null;

    return { total, avgScore, passRate };
  },
});
