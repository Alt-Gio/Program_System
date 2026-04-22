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
 * Verify an OTP for (contact, purpose).
 *
 * Idempotent within the 10-minute TTL: the first call marks the code verified
 * and returns success; subsequent calls with the same code/contact/purpose
 * also return success as long as the code hasn't expired. This lets the
 * accept-invite UI do a "check code" round before the final "create user"
 * round without the second check failing because the first already flagged
 * the code as used.
 *
 * A code can still only be consumed for *its* purpose, and still cannot be
 * used after it expires or is deleted, so replay risk is bounded by the TTL.
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
      (r) => r.purpose === args.purpose && r.code === args.code,
    );

    if (!match) return { success: false, error: "Invalid code" } as const;
    if (match.expiresAt < Date.now()) {
      await ctx.db.delete(match._id);
      return { success: false, error: "Code expired" } as const;
    }

    if (!match.verified) {
      await ctx.db.patch(match._id, { verified: true });
    }
    return { success: true } as const;
  },
});
