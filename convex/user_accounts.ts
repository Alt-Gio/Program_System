import { defineTable } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============================================================
// USER ACCOUNTS — tabs 2 & 4 of /personnel
// Spread into convex/schema.ts via `...userAccountTables`.
// NOTE: this is an additive layer for the /personnel page.
// It does not replace the existing `users` authentication table.
// ============================================================

export const userAccountTables = {
  user_accounts: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("supervisor"),
      v.literal("mentor"),
      v.literal("intern"),
      v.literal("readonly"),
    ),
    program: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("pending"),
    ),
    lastLoginAt: v.optional(v.number()),
    invitedAt: v.number(),
    invitedBy: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    inviteToken: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_status", ["status"])
    .index("by_invite_token", ["inviteToken"]),

  user_login_log: defineTable({
    userId: v.id("user_accounts"),
    loginAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_time", ["loginAt"]),
};

// ------------------------------------------------------------
// QUERIES
// ------------------------------------------------------------

export const listUserAccounts = query({
  args: {
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { role, status, search }) => {
    const all = await ctx.db.query("user_accounts").order("desc").collect();
    const q = search?.trim().toLowerCase();
    return all.filter((u) => {
      if (role && u.role !== role) return false;
      if (status && u.status !== status) return false;
      if (q) {
        const hit =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.program ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  },
});

export const getUserLoginLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const logs = await ctx.db
      .query("user_login_log")
      .withIndex("by_time")
      .order("desc")
      .take(limit ?? 50);
    return Promise.all(
      logs.map(async (l) => {
        const user = await ctx.db.get(l.userId);
        return {
          ...l,
          userName: user?.name ?? "(unknown)",
          userRole: user?.role ?? "unknown",
        };
      }),
    );
  },
});

export const countsByStatus = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("user_accounts").collect();
    return {
      total: all.length,
      active: all.filter((u) => u.status === "active").length,
      inactive: all.filter((u) => u.status === "inactive").length,
      pending: all.filter((u) => u.status === "pending").length,
    };
  },
});

// ------------------------------------------------------------
// MUTATIONS
// ------------------------------------------------------------

function makeToken(): string {
  // simple random token — fine for invite links; not for auth secrets
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export const inviteUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("supervisor"),
      v.literal("mentor"),
      v.literal("intern"),
      v.literal("readonly"),
    ),
    program: v.optional(v.string()),
    invitedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("user_accounts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) {
      throw new Error(`A user with email ${args.email} already exists.`);
    }
    const token = makeToken();
    const id = await ctx.db.insert("user_accounts", {
      ...args,
      status: "pending",
      invitedAt: Date.now(),
      inviteToken: token,
    });
    return { id, token };
  },
});

export const setRole = mutation({
  args: {
    id: v.id("user_accounts"),
    role: v.union(
      v.literal("admin"),
      v.literal("supervisor"),
      v.literal("mentor"),
      v.literal("intern"),
      v.literal("readonly"),
    ),
    program: v.optional(v.string()),
  },
  handler: async (ctx, { id, role, program }) => {
    await ctx.db.patch(id, { role, program });
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("user_accounts"),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("pending"),
    ),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});

export const recordLogin = mutation({
  args: {
    id: v.id("user_accounts"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { id, ipAddress, userAgent }) => {
    const now = Date.now();
    await ctx.db.patch(id, { lastLoginAt: now, status: "active" });
    await ctx.db.insert("user_login_log", {
      userId: id,
      loginAt: now,
      ipAddress,
      userAgent,
    });
  },
});

export const deleteUserAccount = mutation({
  args: { id: v.id("user_accounts") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
