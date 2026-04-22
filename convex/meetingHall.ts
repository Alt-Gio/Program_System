import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Public Meeting Hall booking endpoint.
 *
 * `submit` is callable without a session — the /meeting-hall page is public.
 * The `clientId` argument is a stable UUID generated in the browser so that
 * replays from the offline queue / service-worker background sync do not
 * create duplicate rows.
 *
 * `list` / `review` are admin-gated and used by the DTC admin UI.
 */

const ALLOWED_TIME_SLOTS = [
  "8:00 AM – 12:00 PM (AM)",
  "1:00 PM – 5:00 PM (PM)",
  "8:00 AM – 5:00 PM (Full Day)",
];
const ALLOWED_ATTENDEES = ["1 – 15 pax", "16 – 30 pax", "31 – 50 pax"];
const ALLOWED_EVENT_TYPES = [
  "Training / Workshop",
  "Seminar / Conference",
  "Meeting / Huddle",
  "Orientation",
  "Other",
];

async function requireAdmin(ctx: any, sessionToken: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", sessionToken))
    .first();
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get(session.userId);
  if (!user || !user.isActive || (user.role !== "admin" && user.role !== "manager")) {
    throw new Error("Admin access required");
  }
  return user;
}

export const submit = mutation({
  args: {
    clientId: v.string(),
    fullName: v.string(),
    designation: v.optional(v.string()),
    agency: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    date: v.string(),
    timeSlot: v.string(),
    attendees: v.string(),
    eventType: v.string(),
    purpose: v.optional(v.string()),
    submittedOffline: v.optional(v.boolean()),
    userAgent: v.optional(v.string()),
    clientSubmittedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clientId = args.clientId.trim();
    if (!clientId || clientId.length > 128) {
      throw new Error("Invalid clientId");
    }

    const existing = await ctx.db
      .query("meetingHallBookings")
      .withIndex("by_clientId", (q) => q.eq("clientId", clientId))
      .first();
    if (existing) {
      return { ok: true, bookingId: existing._id, duplicate: true };
    }

    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }
    const fullName = args.fullName.trim();
    const agency = args.agency.trim();
    if (!fullName || !agency) {
      throw new Error("Missing required fields");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new Error("Invalid date");
    }
    if (!ALLOWED_TIME_SLOTS.includes(args.timeSlot)) {
      throw new Error("Invalid time slot");
    }
    if (!ALLOWED_ATTENDEES.includes(args.attendees)) {
      throw new Error("Invalid attendees range");
    }
    if (!ALLOWED_EVENT_TYPES.includes(args.eventType)) {
      throw new Error("Invalid event type");
    }

    const bookingId = await ctx.db.insert("meetingHallBookings", {
      clientId,
      fullName,
      designation: args.designation?.trim() || undefined,
      agency,
      email,
      phone: args.phone?.trim() || undefined,
      date: args.date,
      timeSlot: args.timeSlot,
      attendees: args.attendees,
      eventType: args.eventType,
      purpose: args.purpose?.trim() || undefined,
      status: "pending",
      submittedAt: args.clientSubmittedAt ?? Date.now(),
      submittedOffline: args.submittedOffline ?? false,
      userAgent: args.userAgent,
    });

    return { ok: true, bookingId, duplicate: false };
  },
});

export const list = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = args.status
      ? await ctx.db
          .query("meetingHallBookings")
          .withIndex("by_status", (q) => q.eq("status", args.status as string))
          .order("desc")
          .take(200)
      : await ctx.db
          .query("meetingHallBookings")
          .withIndex("by_submittedAt")
          .order("desc")
          .take(200);
    return rows;
  },
});

export const review = mutation({
  args: {
    sessionToken: v.string(),
    bookingId: v.id("meetingHallBookings"),
    status: v.string(), // "approved" | "rejected" | "cancelled" | "pending"
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reviewer = await requireAdmin(ctx, args.sessionToken);
    if (!["approved", "rejected", "cancelled", "pending"].includes(args.status)) {
      throw new Error("Invalid status");
    }
    await ctx.db.patch(args.bookingId, {
      status: args.status,
      reviewedBy: reviewer._id,
      reviewedAt: Date.now(),
      reviewNote: args.reviewNote?.trim() || undefined,
    });
    return { ok: true };
  },
});
