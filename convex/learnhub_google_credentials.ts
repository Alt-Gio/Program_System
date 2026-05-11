import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Public query: returns NON-SENSITIVE metadata only. The encrypted token
// ciphertexts must never reach the client. UIs use this to decide whether
// to show "Connect Google Calendar" vs "Disconnect".
export const getForUser = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("learnhub_google_credentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!row) return null;
    return {
      scopes: row.scopes,
      expiresAt: row.expiresAt,
      updatedAt: row.updatedAt,
    };
  },
});

// Server-only-by-convention: returns the full encrypted row. Called from
// Next.js API routes via ConvexHttpClient. Public technically (Convex's
// `query` is the only RPC kind it can call from HTTP), but useless to
// attackers without LH_TOKEN_ENCRYPTION_KEY. NEVER call this from
// browser-rendered React.
export const serverGet = query({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnhub_google_credentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    userId: v.id("learnhub_users"),
    accessTokenEnc: v.string(),
    refreshTokenEnc: v.string(),
    expiresAt: v.number(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_google_credentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessTokenEnc: args.accessTokenEnc,
        refreshTokenEnc: args.refreshTokenEnc,
        expiresAt: args.expiresAt,
        scopes: args.scopes,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("learnhub_google_credentials", {
      ...args,
      updatedAt: now,
    });
  },
});

// Server-only-by-convention: used by the token-refresh helper when Google
// returns a refreshed access token but the refresh token stays the same.
export const patchAccess = mutation({
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

export const disconnect = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_google_credentials")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
