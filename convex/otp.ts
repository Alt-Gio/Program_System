import { v } from "convex/values";
import { mutation } from "./_generated/server";

const OTP_TTL_MS = 10 * 60 * 1000;

function generateCode(): string {
  // 6-digit numeric code via CSPRNG
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/**
 * Issue a new OTP for (contact, purpose). Invalidates prior unverified codes
 * for the same pair, then stores and returns the fresh code so an action can
 * email it out. Keep this internal — the public surface is the action.
 */
export const issue = mutation({
  args: {
    contact: v.string(),
    purpose: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = args.contact.toLowerCase().trim();
    const existing = await ctx.db
      .query("otpCodes")
      .withIndex("by_contact", (q) => q.eq("contact", contact))
      .collect();
    for (const row of existing) {
      if (!row.verified && row.purpose === args.purpose) {
        await ctx.db.delete(row._id);
      }
    }

    const code = generateCode();
    await ctx.db.insert("otpCodes", {
      contact,
      contactType: "email",
      code,
      purpose: args.purpose,
      expiresAt: Date.now() + OTP_TTL_MS,
      verified: false,
      createdAt: Date.now(),
    });

    return { code, expiresAt: Date.now() + OTP_TTL_MS };
  },
});

/**
 * Verify an OTP for (contact, purpose). On success, marks it verified so it
 * cannot be reused. The caller is responsible for acting on the verification.
 */
export const verify = mutation({
  args: {
    contact: v.string(),
    purpose: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = args.contact.toLowerCase().trim();
    const rows = await ctx.db
      .query("otpCodes")
      .withIndex("by_contact", (q) => q.eq("contact", contact))
      .collect();

    const match = rows.find(
      (r) =>
        !r.verified &&
        r.purpose === args.purpose &&
        r.code === args.code
    );

    if (!match) return { success: false, error: "Invalid code" } as const;
    if (match.expiresAt < Date.now()) {
      await ctx.db.delete(match._id);
      return { success: false, error: "Code expired" } as const;
    }

    await ctx.db.patch(match._id, { verified: true });
    return { success: true } as const;
  },
});
