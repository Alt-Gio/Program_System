import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
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

type WorkCtx = QueryCtx | MutationCtx;
type OpportunityDoc = Doc<"learnhub_work_opportunities">;
type LearnhubUserDoc = Doc<"learnhub_users">;
type CertificateDoc = Doc<"learnhub_certificates">;
type EligibilityStatus = "eligible" | "borderline" | "not_eligible";

function isVerifiedMentor(actor: LearnhubUserDoc) {
  return actor.role === "mentor" && actor.mentorStatus === "verified";
}

function canCreateOpportunity(actor: LearnhubUserDoc) {
  return actor.role === "admin" || actor.role === "org_partner" || isVerifiedMentor(actor);
}

function requireOpportunityCreator(actor: LearnhubUserDoc) {
  if (!canCreateOpportunity(actor)) {
    throw new Error("Forbidden: only admins, verified mentors, and org partners can create opportunities");
  }
}

function requireOpportunityManager(actor: LearnhubUserDoc, opp: OpportunityDoc) {
  if (actor.role === "admin") return;
  if (opp.orgId === actor._id && (actor.role === "org_partner" || isVerifiedMentor(actor))) return;
  throw new Error("Forbidden: not your opportunity");
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function hasToken(tokens: Set<string>, requirement: string) {
  const needle = normalizeToken(requirement);
  if (!needle) return true;
  return Array.from(tokens).some((token) => token.includes(needle) || needle.includes(token));
}

async function getStudentCertificates(ctx: WorkCtx, studentId: Id<"learnhub_users">) {
  return await ctx.db
    .query("learnhub_certificates")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
}

function computeOpportunityMatch(
  opp: OpportunityDoc,
  student: LearnhubUserDoc,
  certificates: CertificateDoc[]
): {
  eligibilityStatus: EligibilityStatus;
  matchScore: number;
  missingRequirements: string[];
} {
  const minXp = opp.minXp ?? 0;
  const requiredSkills = opp.requiredSkills ?? opp.skills ?? [];
  const preferredSkills = opp.preferredSkills ?? [];
  const requiredCertTypes = opp.requiredCertTypes ?? [];
  const eligibilityMode = opp.eligibilityMode ?? "guided";
  const profileTokens = new Set(
    [
      ...(student.expertiseTags ?? []),
      ...(student.interests ?? []),
      student.programType,
      student.programBatch,
      student.school,
      student.organization,
    ]
      .filter((v): v is string => Boolean(v))
      .map(normalizeToken)
  );
  const certTokens = new Set(
    certificates
      .flatMap((cert) => [cert.programType, cert.courseTitle, cert.certType])
      .filter((v): v is string => Boolean(v))
      .map(normalizeToken)
  );
  const missingRequirements: string[] = [];
  const xpOk = student.xpPoints >= minXp;
  if (!xpOk) missingRequirements.push(`${minXp} XP minimum`);
  const matchedRequiredSkills = requiredSkills.filter((skill) => hasToken(profileTokens, skill));
  for (const skill of requiredSkills) {
    if (!hasToken(profileTokens, skill)) missingRequirements.push(`Skill: ${skill}`);
  }
  const matchedPreferredSkills = preferredSkills.filter((skill) => hasToken(profileTokens, skill));
  const matchedCerts = requiredCertTypes.filter((cert) => hasToken(certTokens, cert) || hasToken(profileTokens, cert));
  for (const cert of requiredCertTypes) {
    if (!hasToken(certTokens, cert) && !hasToken(profileTokens, cert)) missingRequirements.push(`Certificate: ${cert}`);
  }
  const xpScore = minXp === 0 ? 30 : Math.min(30, Math.round((student.xpPoints / minXp) * 30));
  const requiredSkillScore = requiredSkills.length === 0 ? 25 : Math.round((matchedRequiredSkills.length / requiredSkills.length) * 25);
  const certScore = requiredCertTypes.length === 0 ? 25 : Math.round((matchedCerts.length / requiredCertTypes.length) * 25);
  const preferredScore = preferredSkills.length === 0 ? 20 : Math.round((matchedPreferredSkills.length / preferredSkills.length) * 20);
  const matchScore = Math.max(0, Math.min(100, xpScore + requiredSkillScore + certScore + preferredScore));
  const eligibilityStatus: EligibilityStatus =
    missingRequirements.length === 0
      ? "eligible"
      : eligibilityMode === "strict" || matchScore < 45
        ? "not_eligible"
        : "borderline";
  return { eligibilityStatus, matchScore, missingRequirements };
}

async function getExistingApplication(
  ctx: WorkCtx,
  opportunityId: Id<"learnhub_work_opportunities">,
  studentId: Id<"learnhub_users">
) {
  return await ctx.db
    .query("learnhub_work_applications")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .filter((q) => q.eq(q.field("opportunityId"), opportunityId))
    .unique();
}

async function getPendingReferral(
  ctx: WorkCtx,
  opportunityId: Id<"learnhub_work_opportunities">,
  studentId: Id<"learnhub_users">
) {
  return await ctx.db
    .query("learnhub_work_referrals")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .filter((q) =>
      q.and(
        q.eq(q.field("opportunityId"), opportunityId),
        q.eq(q.field("status"), "pending")
      )
    )
    .unique();
}

async function createApplication(
  ctx: MutationCtx,
  args: {
    opportunityId: Id<"learnhub_work_opportunities">;
    studentId: Id<"learnhub_users">;
    note?: string;
    reasoningNote?: string;
    referralId?: Id<"learnhub_work_referrals">;
    allowRequirementOverride?: boolean;
  }
) {
  const existing = await getExistingApplication(ctx, args.opportunityId, args.studentId);
  if (existing) return existing._id;
  const opp = await ctx.db.get(args.opportunityId);
  if (!opp) throw new Error("Opportunity not found");
  if (opp.status !== "open") throw new Error("Opportunity is not open");
  if (opp.deadline < Date.now()) throw new Error("Applications are closed");
  if ((opp.filledSlots ?? 0) >= opp.slots) throw new Error("All slots are filled");
  const student = await ctx.db.get(args.studentId);
  if (!student) throw new Error("Student not found");
  if (student.role !== "student") throw new Error("Only students can apply");
  const certificates = await getStudentCertificates(ctx, args.studentId);
  const match = computeOpportunityMatch(opp, student, certificates);
  const reasoningNote = args.reasoningNote?.trim() || args.note?.trim();
  if (match.eligibilityStatus !== "eligible" && !reasoningNote && !args.allowRequirementOverride) {
    throw new Error("A short reasoning note is required for review queue applications");
  }
  if (match.eligibilityStatus === "not_eligible" && (opp.eligibilityMode ?? "guided") === "strict" && !args.allowRequirementOverride) {
    throw new Error("This opportunity requires all minimum requirements before applying");
  }
  const now = Date.now();
  return await ctx.db.insert("learnhub_work_applications", {
    opportunityId: args.opportunityId,
    studentId: args.studentId,
    status: match.eligibilityStatus === "eligible" ? "applied" : "under_review",
    eligibilityStatus: match.eligibilityStatus,
    matchScore: match.matchScore,
    missingRequirements: match.missingRequirements,
    createdAt: now,
    updatedAt: now,
    ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    ...(reasoningNote ? { reasoningNote } : {}),
    ...(args.referralId ? { referralId: args.referralId } : {}),
  });
}

export const listOpenOpportunities = query({
  args: {
    workType: v.optional(v.union(v.literal("remote"), v.literal("hybrid"), v.literal("onsite"))),
    payType: v.optional(v.union(v.literal("volunteer"), v.literal("stipend"), v.literal("paid"))),
    studentId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const q = ctx.db.query("learnhub_work_opportunities").withIndex("by_status", (q) => q.eq("status", "open"));
    const results = await q.collect();
    const student = args.studentId ? await ctx.db.get(args.studentId) : null;
    const certificates = student ? await getStudentCertificates(ctx, student._id) : [];
    const filtered = results
      .filter((o) => (!args.workType || o.workType === args.workType) && (!args.payType || o.payType === args.payType))
      .sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      filtered.map(async (opp) => {
        const existingApplication = student ? await getExistingApplication(ctx, opp._id, student._id) : null;
        const pendingReferral = student ? await getPendingReferral(ctx, opp._id, student._id) : null;
        return {
          ...opp,
          match: student ? computeOpportunityMatch(opp, student, certificates) : null,
          myApplication: existingApplication,
          pendingReferral,
        };
      })
    );
  },
});

export const getOpportunity = query({
  args: { id: v.id("learnhub_work_opportunities") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const listOrgOpportunities = query({
  args: {
    orgId: v.optional(v.id("learnhub_users")),
    actorId: v.optional(v.id("learnhub_users")),
  },
  handler: async (ctx, args) => {
    const actor = args.actorId ? await ctx.db.get(args.actorId) : null;
    if (actor?.role === "admin") {
      return await ctx.db
        .query("learnhub_work_opportunities")
        .order("desc")
        .collect();
    }
    const orgId = args.orgId ?? args.actorId;
    if (!orgId) return [];
    return await ctx.db
      .query("learnhub_work_opportunities")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
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
    minXp: v.optional(v.number()),
    requiredSkills: v.optional(v.array(v.string())),
    preferredSkills: v.optional(v.array(v.string())),
    eligibilityMode: v.optional(v.union(v.literal("open"), v.literal("guided"), v.literal("strict"))),
    reviewInstructions: v.optional(v.string()),
    applicationQuestions: v.optional(v.array(v.object({
      id: v.string(),
      label: v.string(),
      required: v.boolean(),
    }))),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["mentor", "org_partner", "admin"]);
    requireOpportunityCreator(actor);
    if (args.slots < 1) throw new Error("Slots must be at least 1");
    if (args.deadline < Date.now()) throw new Error("Deadline must be in the future");
    if ((args.minXp ?? 0) < 0) throw new Error("Minimum XP cannot be negative");

    const { actorId: _ignored, ...rest } = args;
    void _ignored;
    const opportunityId = await ctx.db.insert("learnhub_work_opportunities", {
      title: rest.title,
      description: rest.description,
      requiredCertTypes: rest.requiredCertTypes,
      workType: rest.workType,
      payType: rest.payType,
      slots: rest.slots,
      deadline: rest.deadline,
      duration: rest.duration,
      orgId: actor._id,
      orgName: actor.name,
      status: "open",
      createdAt: Date.now(),
      ...(rest.orgLogoUrl ? { orgLogoUrl: rest.orgLogoUrl } : {}),
      ...(rest.payAmount ? { payAmount: rest.payAmount } : {}),
      ...(rest.minXp !== undefined ? { minXp: rest.minXp } : {}),
      ...(rest.requiredSkills ? { requiredSkills: rest.requiredSkills } : {}),
      ...(rest.preferredSkills ? { preferredSkills: rest.preferredSkills } : {}),
      ...(rest.eligibilityMode ? { eligibilityMode: rest.eligibilityMode } : {}),
      ...(rest.reviewInstructions ? { reviewInstructions: rest.reviewInstructions } : {}),
      ...(rest.applicationQuestions ? { applicationQuestions: rest.applicationQuestions } : {}),
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
    const actor = await requireActor(ctx, args.actorId, ["mentor", "org_partner", "admin"]);
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Opportunity not found");
    requireOpportunityManager(actor, opp);
    await ctx.db.patch(args.opportunityId, { status: "closed" });
  },
});

export const applyForOpportunity = mutation({
  args: {
    opportunityId: v.id("learnhub_work_opportunities"),
    studentId: v.id("learnhub_users"),
    actorId: v.id("learnhub_users"),
    note: v.optional(v.string()),
    reasoningNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["student"]);
    if (actor._id !== args.studentId) {
      throw new Error("Forbidden: can only apply for yourself");
    }
    return await createApplication(ctx, {
      opportunityId: args.opportunityId,
      studentId: args.studentId,
      note: args.note,
      reasoningNote: args.reasoningNote,
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
    const sorted = apps.sort((a, b) => {
      const scoreDelta = (b.matchScore ?? 0) - (a.matchScore ?? 0);
      return scoreDelta !== 0 ? scoreDelta : b.createdAt - a.createdAt;
    });
    return Promise.all(
      sorted.map(async (a) => ({
        ...a,
        student: await ctx.db.get(a.studentId),
        endorsedByUser: a.endorsedBy ? await ctx.db.get(a.endorsedBy) : null,
        referral: a.referralId ? await ctx.db.get(a.referralId) : null,
      }))
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
    const actor = await requireActor(ctx, args.actorId, ["mentor", "org_partner", "admin"]);
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const opp = await ctx.db.get(app.opportunityId);
    if (!opp) throw new Error("Opportunity not found");
    requireOpportunityManager(actor, opp);

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
    if (!isVerifiedMentor(mentor) && mentor.role !== "admin") {
      throw new Error("Forbidden: only verified mentors or admins can endorse");
    }
    await ctx.db.patch(args.applicationId, {
      mentorEndorsement: true,
      endorsedBy: args.mentorId,
      updatedAt: Date.now(),
    });
  },
});
export const referStudentToOpportunity = mutation({
  args: {
    opportunityId: v.id("learnhub_work_opportunities"),
    studentId: v.id("learnhub_users"),
    actorId: v.id("learnhub_users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["mentor", "org_partner", "admin"]);
    if (!isVerifiedMentor(actor) && actor.role !== "admin" && actor.role !== "org_partner") {
      throw new Error("Forbidden: only admins, verified mentors, and org partners can refer students");
    }
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Opportunity not found");
    if (actor.role === "org_partner") requireOpportunityManager(actor, opp);
    const student = await ctx.db.get(args.studentId);
    if (!student || student.role !== "student") throw new Error("Student not found");
    const existingApplication = await getExistingApplication(ctx, args.opportunityId, args.studentId);
    if (existingApplication) return existingApplication._id;
    const existingReferral = await getPendingReferral(ctx, args.opportunityId, args.studentId);
    if (existingReferral) return existingReferral._id;
    return await ctx.db.insert("learnhub_work_referrals", {
      opportunityId: args.opportunityId,
      studentId: args.studentId,
      referredBy: args.actorId,
      status: "pending",
      createdAt: Date.now(),
      ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    });
  },
});

export const acceptOpportunityReferral = mutation({
  args: {
    referralId: v.id("learnhub_work_referrals"),
    actorId: v.id("learnhub_users"),
    reasoningNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx, args.actorId, ["student"]);
    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    if (referral.studentId !== actor._id) throw new Error("Forbidden: not your referral");
    if (referral.status !== "pending") throw new Error("Referral is not pending");
    const applicationId = await createApplication(ctx, {
      opportunityId: referral.opportunityId,
      studentId: referral.studentId,
      reasoningNote: args.reasoningNote ?? referral.note,
      referralId: referral._id,
      allowRequirementOverride: true,
    });
    await ctx.db.patch(referral._id, {
      status: "accepted",
      acceptedAt: Date.now(),
    });
    return applicationId;
  },
});
