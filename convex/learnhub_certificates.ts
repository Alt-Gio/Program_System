import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getCertById = query({
  args: { certId: v.id("learnhub_certificates") },
  handler: async (ctx, args) => ctx.db.get(args.certId),
});

export const getCertByVerificationId = query({
  args: { verificationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_certificates")
      .withIndex("by_verification", (q) =>
        q.eq("verificationId", args.verificationId)
      )
      .unique();
  },
});

export const getCertsByStudent = query({
  args: { studentId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_certificates")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .collect();
  },
});

export const getCertsByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_certificates")
      .withIndex("by_email", (q) => q.eq("studentEmail", args.email))
      .collect();
  },
});

export const issueCertificate = mutation({
  args: {
    studentEmail: v.string(),
    studentId: v.optional(v.id("learnhub_users")),
    courseTitle: v.string(),
    programType: v.string(),
    issuedBy: v.id("learnhub_users"),
    issuedByName: v.string(),
    certType: v.union(v.literal("learning"), v.literal("work_completion")),
    driveFileId: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const verificationId =
      "LH-" +
      new Date().getFullYear() +
      "-" +
      args.programType.toUpperCase().replace(/\s+/g, "").slice(0, 6) +
      "-" +
      Math.floor(Math.random() * 9000 + 1000);

    return await ctx.db.insert("learnhub_certificates", {
      ...args,
      verificationId,
      status: "issued",
      issuedAt: Date.now(),
    });
  },
});

export const claimCertificate = mutation({
  args: {
    certId: v.id("learnhub_certificates"),
    studentId: v.id("learnhub_users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.certId, {
      studentId: args.studentId,
      status: "claimed",
    });
  },
});

export const updateCertDriveFile = mutation({
  args: {
    certId: v.id("learnhub_certificates"),
    driveFileId: v.string(),
    pdfUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.certId, {
      driveFileId: args.driveFileId,
      pdfUrl: args.pdfUrl,
    });
  },
});
