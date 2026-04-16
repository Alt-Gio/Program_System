import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "DICT_R5_SUPERVISOR_SALT_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  return (
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2)
  );
}

// ============================================================
// QUERIES
// ============================================================

export const getMyProfile = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("supervisorSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!session) throw new Error("Invalid or expired session");
    if (session.expiresAt < Date.now()) throw new Error("Session expired");

    const supervisor = await ctx.db.get(session.supervisorId);
    if (!supervisor) throw new Error("Supervisor not found");

    return {
      id: supervisor._id,
      fullName: supervisor.fullName,
      email: supervisor.email,
      department: supervisor.department ?? null,
      phone: supervisor.phone ?? null,
      role: supervisor.role,
      status: supervisor.status,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const supervisors = await ctx.db.query("supervisors").order("desc").take(100);
    return supervisors.map((s) => ({
      id: s._id,
      email: s.email,
      fullName: s.fullName,
      phone: s.phone ?? null,
      department: s.department ?? null,
      role: s.role,
      status: s.status,
      invitedBy: s.invitedBy ?? null,
      createdAt: s.createdAt,
      lastLoginAt: s.lastLoginAt ?? null,
    }));
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("supervisorSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    const supervisor = await ctx.db.get(session.supervisorId);
    if (!supervisor || supervisor.status !== "active") return null;
    return {
      id: supervisor._id,
      email: supervisor.email,
      fullName: supervisor.fullName,
      department: supervisor.department ?? null,
      role: supervisor.role,
    };
  },
});

export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    const invites = await ctx.db.query("supervisorInvites").order("desc").take(50);
    return invites.map((i) => ({
      id: i._id,
      email: i.email,
      createdBy: i.createdBy,
      used: i.used,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    }));
  },
});

export const verifyInvite = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("supervisorInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!invite) return { valid: false, error: "Invalid invite link" };
    if (invite.used) return { valid: false, error: "This invite has already been used" };
    if (invite.expiresAt < Date.now()) return { valid: false, error: "Invite link has expired" };
    return { valid: true, email: invite.email };
  },
});

// ============================================================
// MUTATIONS
// ============================================================

export const createInvite = mutation({
  args: {
    email: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const alreadySupervisor = await ctx.db
      .query("supervisors")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (alreadySupervisor) throw new Error("A supervisor account already exists for this email");

    const existing = await ctx.db
      .query("supervisorInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing && !existing.used && existing.expiresAt > Date.now()) {
      return { id: existing._id, token: existing.token };
    }

    const token = generateToken();
    const id = await ctx.db.insert("supervisorInvites", {
      email,
      token,
      createdBy: args.createdBy,
      used: false,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
    return { id, token };
  },
});

export const register = mutation({
  args: {
    token: v.string(),
    fullName: v.string(),
    password: v.string(),
    phone: v.optional(v.string()),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("supervisorInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!invite || invite.used || invite.expiresAt < Date.now()) {
      throw new Error("Invalid or expired invite link");
    }
    if (args.password.length < 6) throw new Error("Password must be at least 6 characters");

    const existing = await ctx.db
      .query("supervisors")
      .withIndex("by_email", (q) => q.eq("email", invite.email))
      .first();
    if (existing) throw new Error("Account already exists for this email");

    const passwordHash = await hashPassword(args.password);
    const supervisorId = await ctx.db.insert("supervisors", {
      email: invite.email,
      passwordHash,
      fullName: args.fullName.trim(),
      phone: args.phone,
      department: args.department,
      role: "supervisor",
      status: "active",
      invitedBy: invite.createdBy,
      createdAt: Date.now(),
    });

    await ctx.db.patch(invite._id, { used: true, usedAt: Date.now() });

    const sessionToken = generateToken();
    await ctx.db.insert("supervisorSessions", {
      supervisorId,
      token: sessionToken,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
    return { token: sessionToken };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const supervisor = await ctx.db
      .query("supervisors")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();
    if (!supervisor) throw new Error("Invalid email or password");
    if (supervisor.status !== "active") throw new Error("Your account has been disabled");

    const hash = await hashPassword(args.password);
    if (hash !== supervisor.passwordHash) throw new Error("Invalid email or password");

    await ctx.db.patch(supervisor._id, { lastLoginAt: Date.now() });
    const token = generateToken();
    await ctx.db.insert("supervisorSessions", {
      supervisorId: supervisor._id,
      token,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
    return {
      token,
      supervisor: {
        id: supervisor._id,
        email: supervisor.email,
        fullName: supervisor.fullName,
        department: supervisor.department ?? null,
        role: supervisor.role,
      },
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("supervisorSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { success: true };
  },
});

export const deactivate = mutation({
  args: { supervisorId: v.id("supervisors") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.supervisorId, { status: "inactive" });
    return { success: true };
  },
});

export const activate = mutation({
  args: { supervisorId: v.id("supervisors") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.supervisorId, { status: "active" });
    return { success: true };
  },
});

export const assignIntern = mutation({
  args: {
    internId: v.id("interns"),
    supervisorId: v.optional(v.id("supervisors")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.internId, {
      supervisorId: args.supervisorId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
