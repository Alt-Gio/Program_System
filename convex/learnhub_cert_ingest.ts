/**
 * V8-runtime half of cert-ingest. Hosts the queries + mutations that
 * the admin page and storage-URL helper rely on. The Node-runtime
 * actions (pollGmail, triggerManualPoll) live in
 * `convex/learnhub_cert_ingest_node.ts` with a `"use node"` directive
 * because they need node:crypto for AES-GCM token decryption.
 */

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const SOURCE_EMAIL_VALIDATOR = v.object({
  messageId: v.string(),
  senderEmail: v.string(),
  subject: v.string(),
  receivedAt: v.number(),
});

// ── Config queries / mutations ──────────────────────────────────────────

async function requireAdmin(
  ctx: { db: { get: (id: Id<"learnhub_users">) => Promise<Doc<"learnhub_users"> | null> } },
  actorId: Id<"learnhub_users">,
): Promise<Doc<"learnhub_users">> {
  const actor = await ctx.db.get(actorId);
  if (!actor) throw new Error("Actor not found");
  if (actor.role !== "admin" && actor.role !== "coordinator") {
    throw new Error("FORBIDDEN: cert-ingest config is admin/coordinator-only");
  }
  return actor;
}

export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("learnhub_cert_email_config")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    if (!active) return null;
    const enablingUser = await ctx.db.get(active.enabledByUserId);
    return {
      _id: active._id,
      senderEmail: active.senderEmail,
      programType: active.programType ?? null,
      enabledByUserId: active.enabledByUserId,
      enabledByName: enablingUser?.name ?? null,
      enabledByEmail: enablingUser?.email ?? null,
      lastPolledAt: active.lastPolledAt ?? null,
      historyId: active.historyId ?? null,
      isActive: active.isActive,
      updatedAt: active.updatedAt,
    };
  },
});

export const setConfig = mutation({
  args: {
    actorId: v.id("learnhub_users"),
    senderEmail: v.string(),
    programType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorId);
    const trimmed = args.senderEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error("senderEmail must look like an email address");
    }
    const existing = await ctx.db
      .query("learnhub_cert_email_config")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    for (const row of existing) {
      await ctx.db.patch(row._id, { isActive: false, updatedAt: Date.now() });
    }
    return await ctx.db.insert("learnhub_cert_email_config", {
      senderEmail: trimmed,
      programType: args.programType?.trim(),
      enabledByUserId: args.actorId,
      isActive: true,
      updatedAt: Date.now(),
    });
  },
});

export const disableConfig = mutation({
  args: { actorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorId);
    const active = await ctx.db
      .query("learnhub_cert_email_config")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    if (!active) return;
    await ctx.db.patch(active._id, { isActive: false, updatedAt: Date.now() });
  },
});

// ── Internal helpers (callable only by Node actions in the sibling file) ─

export const _getActiveConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("learnhub_cert_email_config")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
  },
});

export const _getCreds = internalQuery({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_google_credentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const _patchCredsAccess = internalMutation({
  args: {
    userId: v.id("learnhub_users"),
    accessTokenEnc: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_google_credentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      accessTokenEnc: args.accessTokenEnc,
      expiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });
  },
});

export const _findCertByMessage = internalQuery({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_certificates")
      .withIndex("by_source_message", (q) => q.eq("sourceEmail.messageId", args.messageId))
      .first();
  },
});

export const _insertIngestedCert = internalMutation({
  args: {
    studentEmail: v.string(),
    courseTitle: v.string(),
    programType: v.string(),
    issuedBy: v.id("learnhub_users"),
    issuedByName: v.string(),
    imageStorageId: v.id("_storage"),
    originalAttachmentName: v.optional(v.string()),
    sourceEmail: SOURCE_EMAIL_VALIDATOR,
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
      studentEmail: args.studentEmail.toLowerCase(),
      courseTitle: args.courseTitle,
      programType: args.programType,
      issuedBy: args.issuedBy,
      issuedByName: args.issuedByName,
      issuedAt: Date.now(),
      status: "issued",
      verificationId,
      certType: "learning",
      imageStorageId: args.imageStorageId,
      originalAttachmentName: args.originalAttachmentName,
      sourceEmail: args.sourceEmail,
    });
  },
});

export const _patchConfigCursor = internalMutation({
  args: {
    configId: v.id("learnhub_cert_email_config"),
    lastPolledAt: v.number(),
    historyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.configId, {
      lastPolledAt: args.lastPolledAt,
      historyId: args.historyId,
      updatedAt: Date.now(),
    });
  },
});

// Storage URL helper for the certificates page. Returns null if the
// storage row was deleted.
export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
