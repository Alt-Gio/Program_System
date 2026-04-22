import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const VALID_ROLES = ["intern", "supervisor", "manager", "admin"] as const;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requireAdmin(ctx: any, sessionToken: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", sessionToken))
    .first();
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get(session.userId);
  if (!user || !user.isActive || user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}

/** Admin: create an invite for a new user. Returns the token to email. */
export const create = mutation({
  args: {
    sessionToken: v.string(),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.sessionToken);

    const email = args.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email format");
    }
    if (!(VALID_ROLES as readonly string[]).includes(args.role)) {
      throw new Error("Invalid role");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingUser) throw new Error("A user with this email already exists");

    // Invalidate prior unused invites for this email
    const priors = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const p of priors) {
      if (!p.usedAt) await ctx.db.delete(p._id);
    }

    const token = generateToken();
    const inviteId = await ctx.db.insert("invites", {
      email,
      token,
      role: args.role,
      createdBy: admin._id,
      expiresAt: Date.now() + INVITE_TTL_MS,
      createdAt: Date.now(),
    });

    return { inviteId, token, email, role: args.role };
  },
});

/** Public: look up an invite by token (used by /accept-invite page). */
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!invite) return null;
    return {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      used: !!invite.usedAt,
      expired: invite.expiresAt < Date.now(),
    };
  },
});

/** Admin: list all invites (most recent first). */
export const list = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const all = await ctx.db.query("invites").collect();
    all.sort((a, b) => b.createdAt - a.createdAt);
    const now = Date.now();
    return all.map((i) => ({
      id: i._id,
      email: i.email,
      role: i.role,
      token: i.token,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      usedAt: i.usedAt,
      status: i.usedAt
        ? ("used" as const)
        : i.expiresAt < now
          ? ("expired" as const)
          : ("pending" as const),
    }));
  },
});

/** Admin: fetch a single invite by id (used by the resend endpoint). */
export const getForAdmin = query({
  args: {
    sessionToken: v.string(),
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return null;
    return {
      id: invite._id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
    };
  },
});

/** Admin: extend an invite's expiry back to 7 days from now (used on resend). */
export const touchExpiry = mutation({
  args: {
    sessionToken: v.string(),
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.usedAt) throw new Error("Cannot resend a used invite");
    await ctx.db.patch(args.inviteId, {
      expiresAt: Date.now() + INVITE_TTL_MS,
    });
    return { success: true };
  },
});

/** Admin: revoke (delete) an unused invite. */
export const revoke = mutation({
  args: {
    sessionToken: v.string(),
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.usedAt) throw new Error("Cannot revoke a used invite");
    await ctx.db.delete(args.inviteId);
    return { success: true };
  },
});
