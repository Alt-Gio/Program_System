import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Create OTP Code ──────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    contact: v.string(),
    contactType: v.string(),
    code: v.string(),
    purpose: v.string(),
  },
  handler: async (ctx, args) => {
    // Expire old codes for this contact
    const oldCodes = await ctx.db
      .query("otpCodes")
      .withIndex("by_contact", (q) => q.eq("contact", args.contact))
      .filter((q) => q.eq(q.field("verified"), false))
      .collect();

    for (const old of oldCodes) {
      await ctx.db.delete(old._id);
    }

    // Create new code (expires in 10 minutes)
    const id = await ctx.db.insert("otpCodes", {
      ...args,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
      createdAt: Date.now(),
    });

    return id;
  },
});

// ─── Verify OTP Code ──────────────────────────────────────────────────────────
export const verify = mutation({
  args: {
    contact: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const otp = await ctx.db
      .query("otpCodes")
      .withIndex("by_contact", (q) => q.eq("contact", args.contact))
      .filter((q) => q.eq(q.field("code"), args.code))
      .filter((q) => q.eq(q.field("verified"), false))
      .first();

    if (!otp) {
      return { success: false, error: "Invalid or expired code" };
    }

    if (otp.expiresAt < Date.now()) {
      await ctx.db.delete(otp._id);
      return { success: false, error: "Code expired" };
    }

    await ctx.db.patch(otp._id, { verified: true });
    return { success: true };
  },
});

// ─── Clean Expired Codes ──────────────────────────────────────────────────────
export const cleanExpired = mutation({
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("otpCodes")
      .withIndex("by_expiresAt")
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .collect();

    for (const code of expired) {
      await ctx.db.delete(code._id);
    }

    return { deleted: expired.length };
  },
});
