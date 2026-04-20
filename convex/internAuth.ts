import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
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
        checkInMethod: a.checkInMethod ?? null,
        faceConfidence: a.faceConfidence ?? null,
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

// Haversine distance in metres
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const checkIn = mutation({
  args: {
    token: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("internLoginSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Session expired. Please log in again.");
    const loginRecord = await ctx.db.get(session.internLoginId);
    if (!loginRecord || !loginRecord.isActive) throw new Error("Account is disabled.");

    // ── GPS geofence verification ──────────────────────────
    let geoVerified = false;
    let nearestFenceName: string | null = null;
    let distanceMeters: number | null = null;

    if (args.lat != null && args.lng != null) {
      const fences = await ctx.db
        .query("officeGeoFence")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      if (fences.length > 0) {
        for (const fence of fences) {
          const dist = haversineMeters(args.lat!, args.lng!, fence.lat, fence.lng);
          if (distanceMeters === null || dist < distanceMeters) {
            distanceMeters = dist;
            nearestFenceName = fence.name;
          }
          if (dist <= fence.radiusMeters) {
            geoVerified = true;
            break;
          }
        }
        // Block check-in if outside all fences (only when fences are configured)
        if (!geoVerified) {
          const distStr = distanceMeters != null ? `${Math.round(distanceMeters)}m` : "unknown";
          throw new Error(
            `Location check failed. You are ${distStr} away from "${nearestFenceName}". ` +
            `Move closer to the office and try again.`
          );
        }
      }
      // No fences configured → allow freely (geoVerified stays false = "unverified but allowed")
    }

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
      const attId = await ctx.db.insert("internAttendance", {
        internId: loginRecord.internId,
        date: today,
        timeIn: timeStr,
        status: "PRESENT",
        checkInLat: args.lat,
        checkInLng: args.lng,
        checkInAccuracy: args.accuracy,
        checkInAddress: args.address,
        checkInVerified: geoVerified,
        checkInMethod: "QR",
        syncedToSheets: false,
        createdAt: Date.now(),
      });

      const internDoc = await ctx.db.get(loginRecord.internId);
      await ctx.runMutation(internal.auditLog.logEntry, {
        type: "INTERN_CHECKIN",
        entityId: attId,
        userId: loginRecord.internId,
        userName: internDoc?.fullName ?? "Unknown",
        timestamp: timeStr,
        method: "QR",
      });

      return {
        action: "checked_in" as const,
        time: timeStr,
        hours: null,
        geoVerified,
        distanceMeters,
      };
    } else if (existing.timeIn && !existing.timeOut) {
      const inDate  = new Date(existing.timeIn);
      const outDate = new Date(timeStr);
      const hours   = Math.round((outDate.getTime() - inDate.getTime()) / 36000) / 100;
      await ctx.db.patch(existing._id, {
        timeOut: timeStr,
        hours,
        checkOutLat: args.lat,
        checkOutLng: args.lng,
        syncedToSheets: false,
      });
      const intern = await ctx.db.get(loginRecord.internId);
      if (intern) {
        await ctx.db.patch(loginRecord.internId, {
          totalHours: intern.totalHours + hours,
          updatedAt: Date.now(),
        });
      }

      await ctx.runMutation(internal.auditLog.logEntry, {
        type: "INTERN_CHECKOUT",
        entityId: existing._id,
        userId: loginRecord.internId,
        userName: intern?.fullName ?? "Unknown",
        timestamp: timeStr,
        method: "QR",
      });

      return {
        action: "checked_out" as const,
        time: timeStr,
        hours,
        geoVerified,
        distanceMeters,
      };
    } else {
      throw new Error("Attendance already complete for today.");
    }
  },
});

// ─── Face Recognition Check-In (called from Python CV station) ───────────────
export const faceCheckIn = mutation({
  args: {
    internId:      v.optional(v.id("interns")),
    internName:    v.optional(v.string()),
    action:        v.string(),           // "timeIn" | "timeOut"
    confidence:    v.optional(v.number()),
    isoTimestamp:  v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Resolve intern — prefer direct ID, fall back to name match
    let intern = null;
    if (args.internId) {
      intern = await ctx.db.get(args.internId);
    } else if (args.internName) {
      const all = await ctx.db.query("interns").collect();
      intern = all.find(
        i => i.fullName.toLowerCase() === args.internName!.toLowerCase()
      ) ?? null;
    }
    if (!intern) throw new Error("Intern not found");
    if (intern.status !== "ACTIVE") throw new Error(`${intern.fullName} is not an active intern`);

    // 2. Build timestamp from provided ISO string or server time
    const now   = args.isoTimestamp ? new Date(args.isoTimestamp) : new Date();
    const today = now.toISOString().slice(0, 10);
    const pad   = (n: number) => String(n).padStart(2, "0");
    const timeStr = `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;

    // 3. Find existing attendance record for today
    const existing = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern_date", q =>
        q.eq("internId", intern!._id).eq("date", today)
      )
      .first();

    // 4a. Check-In — no record yet for today
    if (!existing) {
      const attId = await ctx.db.insert("internAttendance", {
        internId:      intern._id,
        date:          today,
        timeIn:        timeStr,
        status:        "PRESENT",
        checkInMethod: "FACE_CV",
        faceConfidence: args.confidence,
        syncedToSheets: false,
        createdAt:     Date.now(),
      });

      await ctx.runMutation(internal.auditLog.logEntry, {
        type: "INTERN_CHECKIN",
        entityId: attId,
        userId: intern._id,
        userName: intern.fullName,
        timestamp: timeStr,
        method: "FACE_CV",
        confidence: args.confidence,
      });

      return { action: "checked_in" as const, time: timeStr, hours: null, internName: intern.fullName };
    }

    // 4b. Check-Out — open record exists
    if (existing.timeIn && !existing.timeOut) {
      const inDate  = new Date(existing.timeIn);
      const outDate = new Date(timeStr);
      const hours   = Math.round((outDate.getTime() - inDate.getTime()) / 36000) / 100;
      await ctx.db.patch(existing._id, { timeOut: timeStr, hours, syncedToSheets: false });
      await ctx.db.patch(intern._id, {
        totalHours: intern.totalHours + hours,
        updatedAt:  Date.now(),
      });

      await ctx.runMutation(internal.auditLog.logEntry, {
        type: "INTERN_CHECKOUT",
        entityId: existing._id,
        userId: intern._id,
        userName: intern.fullName,
        timestamp: timeStr,
        method: "FACE_CV",
        confidence: args.confidence,
      });

      return { action: "checked_out" as const, time: timeStr, hours, internName: intern.fullName };
    }

    throw new Error("Attendance already complete for today.");
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
