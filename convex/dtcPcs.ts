import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Get All PCs ──────────────────────────────────────────────────────────────
export const getAll = query({
  handler: async (ctx) => {
    const pcs = await ctx.db
      .query("dtcPcs")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get active logs for each PC
    const pcsWithLogs = await Promise.all(
      pcs.map(async (pc) => {
        const logs = await ctx.db
          .query("dtcLogs")
          .withIndex("by_pcId", (q) => q.eq("pcId", pc._id))
          .filter((q) => q.eq(q.field("timeOut"), undefined))
          .order("desc")
          .take(1);

        return {
          ...pc,
          logs: logs.map((log) => ({
            id: log._id,
            fullName: log.fullName,
            timeIn: log.timeIn,
            photoDataUrl: log.photoDataUrl,
            plannedDurationHours: log.plannedDurationHours,
          })),
        };
      })
    );

    return pcsWithLogs;
  },
});

// ─── Create PC ────────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    name: v.string(),
    ipAddress: v.string(),
    location: v.optional(v.string()),
    icon: v.optional(v.string()),
    gridCol: v.optional(v.number()),
    gridRow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pcId = await ctx.db.insert("dtcPcs", {
      ...args,
      status: "OFFLINE",
      lastSeen: undefined,
      isActive: true,
    });
    return pcId;
  },
});

// ─── Update PC ────────────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    id: v.id("dtcPcs"),
    name: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    location: v.optional(v.string()),
    status: v.optional(v.string()),
    icon: v.optional(v.string()),
    gridCol: v.optional(v.number()),
    gridRow: v.optional(v.number()),
    lastSeen: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return { success: true };
  },
});

// ─── Delete PC ────────────────────────────────────────────────────────────────
export const remove = mutation({
  args: { id: v.id("dtcPcs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
    return { success: true };
  },
});

// ─── Update PC Status (for ping) ──────────────────────────────────────────────
export const updateStatus = mutation({
  args: {
    ipAddress: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const pc = await ctx.db
      .query("dtcPcs")
      .withIndex("by_ipAddress", (q) => q.eq("ipAddress", args.ipAddress))
      .first();

    if (pc) {
      await ctx.db.patch(pc._id, {
        status: args.status,
        lastSeen: new Date().toISOString(),
      });
    }

    return { success: true };
  },
});
