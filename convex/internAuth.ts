import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "DICT_R5_INTERN_SALT_2024");
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

export const listAccounts = query({
  args: {},
  handler: async (ctx) => {
    const logins = await ctx.db.query("internLogins").take(100);
    return Promise.all(
      logins.map(async (l) => {
        const intern = await ctx.db.get(l.internId);
        return {
          id: l._id,
          email: l.email,
          isActive: l.isActive,
          createdAt: l.createdAt,
          lastLoginAt: l.lastLoginAt ?? null,
          internId: l.internId,
          internName: intern?.fullName ?? "Unknown",
          school: intern?.school ?? "",
        };
      })
    );
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("internLoginSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    const loginRecord = await ctx.db.get(session.internLoginId);
    if (!loginRecord || !loginRecord.isActive) return null;
    const intern = await ctx.db.get(loginRecord.internId);
    if (!intern) return null;
    return {
      id: loginRecord._id,
      internId: loginRecord.internId,
      email: loginRecord.email,
      internName: intern.fullName,
      school: intern.school,
      status: intern.status,
      totalHours: intern.totalHours,
      requiredHours: intern.requiredHours,
    };
  },
});

// ============================================================
// MUTATIONS
// ============================================================

export const createAccount = mutation({
  args: {
    internId: v.id("interns"),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("internLogins")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) throw new Error("An account already exists for this email");
    if (args.password.length < 6) throw new Error("Password must be at least 6 characters");

    const passwordHash = await hashPassword(args.password);
    const loginId = await ctx.db.insert("internLogins", {
      internId: args.internId,
      email,
      passwordHash,
      isActive: true,
      createdAt: Date.now(),
    });
    return loginId;
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const loginRecord = await ctx.db
      .query("internLogins")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();
    if (!loginRecord) throw new Error("Invalid email or password");
    if (!loginRecord.isActive) throw new Error("Your account has been disabled");

    const hash = await hashPassword(args.password);
    if (hash !== loginRecord.passwordHash) throw new Error("Invalid email or password");

    await ctx.db.patch(loginRecord._id, { lastLoginAt: Date.now() });
    const token = generateToken();
    await ctx.db.insert("internLoginSessions", {
      internLoginId: loginRecord._id,
      token,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
    const intern = await ctx.db.get(loginRecord.internId);
    return {
      token,
      intern: {
        id: loginRecord.internId,
        email: loginRecord.email,
        fullName: intern?.fullName ?? "Intern",
        school: intern?.school ?? "",
      },
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("internLoginSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { success: true };
  },
});

export const deactivateAccount = mutation({
  args: { loginId: v.id("internLogins") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.loginId, { isActive: false });
    return { success: true };
  },
});

export const getMyData = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("internLoginSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    const loginRecord = await ctx.db.get(session.internLoginId);
    if (!loginRecord || !loginRecord.isActive) return null;
    const intern = await ctx.db.get(loginRecord.internId);
    if (!intern) return null;

    const attendance = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern", (q) => q.eq("internId", intern._id))
      .order("desc")
      .take(30);

    const tasks = await ctx.db
      .query("internTasks")
      .withIndex("by_intern", (q) => q.eq("internId", intern._id))
      .order("desc")
      .take(30);

    let supervisorName = intern.supervisor ?? null;
    if (intern.supervisorId) {
      const sup = await ctx.db.get(intern.supervisorId);
      if (sup) supervisorName = sup.fullName;
    }

    return {
      id: intern._id,
      fullName: intern.fullName,
      school: intern.school,
      course: intern.course ?? null,
      department: intern.department ?? null,
      supervisor: supervisorName,
      startDate: intern.startDate,
      endDate: intern.endDate,
      requiredHours: intern.requiredHours,
      totalHours: intern.totalHours,
      status: intern.status,
      photoUrl: intern.photoUrl ?? null,
      attendance: attendance.map((a) => ({
        id: a._id,
        date: a.date,
        timeIn: a.timeIn ?? null,
        timeOut: a.timeOut ?? null,
        hours: a.hours ?? null,
        status: a.status,
        notes: a.notes ?? null,
      })),
      tasks: tasks.map((t) => ({
        id: t._id,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ?? null,
        completedAt: t.completedAt ?? null,
      })),
    };
  },
});

export const selfRegister = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const existingLogin = await ctx.db
      .query("internLogins")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingLogin) throw new Error("An account already exists for this email. Please sign in.");

    const intern = await ctx.db
      .query("interns")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!intern) throw new Error("No intern record found for this email. Please ask your admin to register you first.");

    const existingByIntern = await ctx.db
      .query("internLogins")
      .withIndex("by_intern", (q) => q.eq("internId", intern._id))
      .first();
    if (existingByIntern) throw new Error("This intern record already has an account. Contact your admin.");

    if (args.password.length < 6) throw new Error("Password must be at least 6 characters");

    const passwordHash = await hashPassword(args.password);
    const loginId = await ctx.db.insert("internLogins", {
      internId: intern._id,
      email,
      passwordHash,
      isActive: true,
      createdAt: Date.now(),
    });

    const token = generateToken();
    await ctx.db.insert("internLoginSessions", {
      internLoginId: loginId,
      token,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    return { token, intern: { id: intern._id, email, fullName: intern.fullName } };
  },
});

export const checkIn = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("internLoginSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Session expired. Please log in again.");
    const loginRecord = await ctx.db.get(session.internLoginId);
    if (!loginRecord || !loginRecord.isActive) throw new Error("Account is disabled.");

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const pad = (n: number) => String(n).padStart(2, "0");
    const timeStr = `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;

    const existing = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern_date", (q) =>
        q.eq("internId", loginRecord.internId).eq("date", today)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("internAttendance", {
        internId: loginRecord.internId,
        date: today,
        timeIn: timeStr,
        status: "PRESENT",
        createdAt: Date.now(),
      });
      return { action: "checked_in" as const, time: timeStr, hours: null };
    } else if (existing.timeIn && !existing.timeOut) {
      const inDate  = new Date(existing.timeIn);
      const outDate = new Date(timeStr);
      const hours   = Math.round((outDate.getTime() - inDate.getTime()) / 36000) / 100;
      await ctx.db.patch(existing._id, { timeOut: timeStr, hours });
      const intern = await ctx.db.get(loginRecord.internId);
      if (intern) {
        await ctx.db.patch(loginRecord.internId, {
          totalHours: intern.totalHours + hours,
          updatedAt: Date.now(),
        });
      }
      return { action: "checked_out" as const, time: timeStr, hours };
    } else {
      throw new Error("Attendance already complete for today.");
    }
  },
});

export const resetPassword = mutation({
  args: {
    loginId: v.id("internLogins"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    const passwordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(args.loginId, { passwordHash });
    return { success: true };
  },
});
