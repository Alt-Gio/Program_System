import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================
// ROLE DEFINITIONS
// ============================================================

export const ROLES = ["intern", "supervisor", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "DICT_R5_SALT_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Resolve session → user, or null. Shared by queries & mutations. */
async function resolveSession(ctx: QueryCtx, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || !user.isActive) return null;
  return { session, user };
}

// ============================================================
// QUERIES
// ============================================================

/** Get current user by session token. Returns null if invalid/expired. */
export const getCurrentUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    if (!result) return null;
    const { user } = result;
    return {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      googleEmail: user.googleEmail,
    };
  },
});

/** Check if session belongs to an admin. */
export const isAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    return result?.user.role === "admin";
  },
});

/** Check if session belongs to a role in an allowed list. */
export const hasRole = query({
  args: { token: v.string(), allowed: v.array(v.string()) },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    if (!result) return false;
    return args.allowed.includes(result.user.role);
  },
});

/** List all users (admin only). */
export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    if (!result || result.user.role !== "admin") {
      throw new Error("Admin access required");
    }
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      id: u._id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      googleEmail: u.googleEmail,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    }));
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Bootstrap: create the very first admin user.
 * Only works when the users table is empty. After that, use invites.
 */
export const bootstrapFirstAdmin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").collect();
    if (existing.length > 0) {
      throw new Error("Bootstrap not allowed: users already exist");
    }

    const email = args.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email format");
    }
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const passwordHash = await hashPassword(args.password);
    const userId = await ctx.db.insert("users", {
      email,
      passwordHash,
      fullName: args.fullName,
      role: "admin",
      isActive: true,
      createdAt: Date.now(),
    });

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: Date.now() + SESSION_TTL_MS,
      createdAt: Date.now(),
    });

    return { token, role: "admin" as const, userId };
  },
});

/** Sign in with email + password. Returns session token + user. */
export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) throw new Error("Invalid email or password");
    if (!user.isActive) throw new Error("Account is disabled");

    const ok = await verifyPassword(args.password, user.passwordHash);
    if (!ok) throw new Error("Invalid email or password");

    await ctx.db.patch(user._id, { lastLoginAt: Date.now() });

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt: Date.now() + SESSION_TTL_MS,
      createdAt: Date.now(),
    });

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  },
});

/** Sign out — delete session row. */
export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { success: true };
  },
});

/**
 * Internal helper used by invites.redeem — creates a user given an
 * already-validated invite. Not exposed as a standalone registration path.
 */
export const _createUserFromInvite = mutation({
  args: {
    inviteToken: v.string(),
    password: v.string(),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.inviteToken))
      .first();

    if (!invite) throw new Error("Invalid invite");
    if (invite.usedAt) throw new Error("Invite already used");
    if (invite.expiresAt < Date.now()) throw new Error("Invite expired");
    if (!isValidRole(invite.role)) throw new Error("Invite has invalid role");
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const email = invite.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) throw new Error("Email already registered");

    const passwordHash = await hashPassword(args.password);
    const userId = await ctx.db.insert("users", {
      email,
      passwordHash,
      fullName: args.fullName,
      role: invite.role,
      isActive: true,
      createdAt: Date.now(),
    });

    await ctx.db.patch(invite._id, {
      usedAt: Date.now(),
      usedByUserId: userId,
    });

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: Date.now() + SESSION_TTL_MS,
      createdAt: Date.now(),
    });

    return {
      token,
      user: {
        id: userId,
        email,
        fullName: args.fullName,
        role: invite.role,
      },
    };
  },
});

/** Admin: update a user's Google email (for Sheets sync). */
export const updateGoogleEmail = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    googleEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    if (!result || result.user.role !== "admin") {
      throw new Error("Admin access required");
    }
    await ctx.db.patch(args.userId, { googleEmail: args.googleEmail });
    return { success: true };
  },
});

/** Admin: change a user's role. */
export const setUserRole = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    if (!result || result.user.role !== "admin") {
      throw new Error("Admin access required");
    }
    if (!isValidRole(args.role)) throw new Error("Invalid role");
    await ctx.db.patch(args.userId, { role: args.role });
    return { success: true };
  },
});

/** Admin: deactivate/reactivate a user. */
export const setUserActive = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    if (!result || result.user.role !== "admin") {
      throw new Error("Admin access required");
    }
    await ctx.db.patch(args.userId, { isActive: args.isActive });
    if (!args.isActive) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const s of sessions) await ctx.db.delete(s._id);
    }
    return { success: true };
  },
});

/** Change own password. */
export const changePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await resolveSession(ctx, args.token);
    if (!result) throw new Error("Not authenticated");
    const ok = await verifyPassword(args.currentPassword, result.user.passwordHash);
    if (!ok) throw new Error("Current password is incorrect");
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const passwordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(result.user._id, { passwordHash });
    return { success: true };
  },
});

// ============================================================
// LEGACY ALIASES — kept so existing callers keep working during
// the transition. New code should use signIn / signOut.
// ============================================================

export const login = signIn;
export const logout = signOut;

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
  },
  handler: async (_ctx, _args) => {
    throw new Error(
      "Self-registration is disabled. Accounts are created via admin-issued invites."
    );
  },
});

/** Clean up expired sessions (run periodically via cron). */
export const cleanupSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();
    for (const s of expired) await ctx.db.delete(s._id);
    return { deleted: expired.length };
  },
});

/**
 * Sign in an existing DICT user who authenticated via Google OAuth.
 * Looks up by googleId first; falls back to email for auto-linking.
 * Returns session token + user info.
 */
export const signInWithGoogle = mutation({
  args: {
    googleId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // 1. Look up by googleId (fastest path)
    let user = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .first();

    // 2. Auto-link: same email already exists without googleId
    if (!user) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (byEmail && !byEmail.googleId) {
        await ctx.db.patch(byEmail._id, {
          googleId: args.googleId,
          googleEmail: email,
          lastLoginAt: Date.now(),
        });
        user = { ...byEmail, googleId: args.googleId, googleEmail: email };
      }
    }

    if (!user) return null; // No account — caller redirects to /login/register/[role]
    if (!user.isActive) throw new Error("Account is disabled");

    await ctx.db.patch(user._id, { lastLoginAt: Date.now() });

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt: Date.now() + SESSION_TTL_MS,
      createdAt: Date.now(),
    });

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  },
});

/**
 * Create a new DICT user from Google OAuth (self-registration).
 * Only allowed for intern and supervisor roles.
 */
export const registerWithGoogle = mutation({
  args: {
    googleId: v.string(),
    email: v.string(),
    fullName: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("intern"), v.literal("supervisor")),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) throw new Error("An account with this email already exists.");

    const userId = await ctx.db.insert("users", {
      email,
      passwordHash: "",
      fullName: args.fullName,
      role: args.role,
      googleId: args.googleId,
      googleEmail: email,
      isActive: true,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: Date.now() + SESSION_TTL_MS,
      createdAt: Date.now(),
    });

    return {
      token,
      user: {
        id: userId,
        email,
        fullName: args.fullName,
        role: args.role,
      },
    };
  },
});

/** DEV ONLY — wipe all users and sessions so bootstrapFirstAdmin can run again. */
export const dangerClearUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users) await ctx.db.delete(u._id);
    const sessions = await ctx.db.query("sessions").collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    return { usersDeleted: users.length, sessionsDeleted: sessions.length };
  },
});
