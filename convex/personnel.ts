import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { isActive: v.optional(v.boolean()), division: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let personnel = await ctx.db.query("personnel").collect();
    if (args.isActive !== undefined) personnel = personnel.filter(p => p.isActive === args.isActive);
    if (args.division) personnel = personnel.filter(p => p.division === args.division);
    return personnel.sort((a, b) => a.lastName.localeCompare(b.lastName));
  },
});

/** Normalize a full name for cross-table matching against face_attendance.name. */
function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

type PersonStatus = "present" | "traveling" | "absent";

/**
 * Personnel joined with today's face-recognition attendance — the data source
 * for the Staff Directory logbook.
 *
 * Status is auto-derived from each person's LATEST recognized event today:
 *   time_in  → "present", time_out → "traveling" (recognized leaving), none → "absent".
 * An admin override (statusOverride, only if statusOverrideDate === today) wins.
 */
export const listWithStatus = query({
  args: { isActive: v.optional(v.boolean()), division: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let personnel = await ctx.db.query("personnel").collect();
    if (args.isActive !== undefined) personnel = personnel.filter(p => p.isActive === args.isActive);
    if (args.division) personnel = personnel.filter(p => p.division === args.division);

    const today = new Date().toISOString().split("T")[0];
    const logs = await ctx.db
      .query("face_attendance")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    // Latest event today, keyed by userId AND by normalized name (two lookups).
    type Latest = { action: "time_in" | "time_out"; timestamp: string };
    const byUserId = new Map<string, Latest>();
    const byName = new Map<string, Latest>();
    for (const log of logs) {
      const cur = { action: log.action, timestamp: log.timestamp };
      const prevId = byUserId.get(log.userId);
      if (!prevId || log.timestamp > prevId.timestamp) byUserId.set(log.userId, cur);
      const nameKey = normalizeName(log.name);
      const prevName = byName.get(nameKey);
      if (!prevName || log.timestamp > prevName.timestamp) byName.set(nameKey, cur);
    }

    const result = await Promise.all(personnel.map(async (p) => {
      const latest =
        byUserId.get(p._id) ??
        byName.get(normalizeName(`${p.firstName} ${p.lastName}`));

      let status: PersonStatus =
        latest === undefined ? "absent"
          : latest.action === "time_in" ? "present"
          : "traveling";

      if (p.statusOverride && p.statusOverrideDate === today) {
        status = p.statusOverride;
      }

      const photoUrl = p.photoStorageId
        ? await ctx.storage.getUrl(p.photoStorageId)
        : null;

      return {
        ...p,
        status,
        lastAction: latest?.action ?? null,
        lastEventAt: latest?.timestamp ?? null,
        isOverridden: p.statusOverride !== undefined && p.statusOverrideDate === today,
        photoUrl,
      };
    }));

    return result.sort((a, b) => a.lastName.localeCompare(b.lastName));
  },
});

/** Attach (or replace) a personnel display photo. Deletes any previous one. */
export const setPhoto = mutation({
  args: { id: v.id("personnel"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    const person = await ctx.db.get(id);
    if (person?.photoStorageId) {
      await ctx.storage.delete(person.photoStorageId);
    }
    await ctx.db.patch(id, { photoStorageId: storageId });
    return { success: true };
  },
});

/** Remove a personnel display photo. */
export const removePhoto = mutation({
  args: { id: v.id("personnel") },
  handler: async (ctx, { id }) => {
    const person = await ctx.db.get(id);
    if (person?.photoStorageId) {
      await ctx.storage.delete(person.photoStorageId);
    }
    await ctx.db.patch(id, { photoStorageId: undefined });
    return { success: true };
  },
});

/** Admin manual status override for today. */
export const setStatus = mutation({
  args: {
    id: v.id("personnel"),
    status: v.union(v.literal("present"), v.literal("traveling"), v.literal("absent")),
  },
  handler: async (ctx, { id, status }) => {
    const today = new Date().toISOString().split("T")[0];
    await ctx.db.patch(id, { statusOverride: status, statusOverrideDate: today });
    return { success: true };
  },
});

/** Clear the override — status returns to auto-derived. */
export const clearStatusOverride = mutation({
  args: { id: v.id("personnel") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { statusOverride: undefined, statusOverrideDate: undefined });
    return { success: true };
  },
});

export const create = mutation({
  args: {
    firstName: v.string(), lastName: v.string(), position: v.string(),
    division: v.string(), email: v.optional(v.string()), isActive: v.boolean(),
  },
  handler: async (ctx, args) => ctx.db.insert("personnel", args),
});

export const update = mutation({
  args: {
    id: v.id("personnel"), firstName: v.optional(v.string()), lastName: v.optional(v.string()),
    position: v.optional(v.string()), division: v.optional(v.string()),
    email: v.optional(v.string()), isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    const filtered = Object.fromEntries(Object.entries(patch).filter(([,v]) => v !== undefined));
    await ctx.db.patch(id, filtered);
    return { success: true };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("personnel").collect();
    if (existing.length > 0) return { seeded: false, count: existing.length };
    const data = [
      { firstName: "Ramon", lastName: "Castro", position: "Director III", division: "Office of the Director", email: "rcastro@dict.gov.ph", isActive: true },
      { firstName: "Maria", lastName: "Santos", position: "Information Systems Analyst II", division: "ILCDB", email: "msantos@dict.gov.ph", isActive: true },
      { firstName: "Juan", lastName: "dela Cruz", position: "Information Technology Officer I", division: "DICT Proper", email: "jdelacruz@dict.gov.ph", isActive: true },
      { firstName: "Ana", lastName: "Reyes", position: "Information Systems Analyst I", division: "ILCDB", email: "areyes@dict.gov.ph", isActive: true },
      { firstName: "Pedro", lastName: "Gomez", position: "Information Technology Officer II", division: "IIDB", email: "pgomez@dict.gov.ph", isActive: true },
      { firstName: "Carlo", lastName: "Mendoza", position: "Information Systems Analyst II", division: "ILCDB", email: "cmendoza@dict.gov.ph", isActive: true },
      { firstName: "Luz", lastName: "Bautista", position: "Information Technology Officer I", division: "DICT Proper", email: "lbautista@dict.gov.ph", isActive: true },
      { firstName: "Rosa", lastName: "Lim", position: "Administrative Officer II", division: "Admin", email: "rlim@dict.gov.ph", isActive: true },
    ];
    for (const p of data) await ctx.db.insert("personnel", p);
    return { seeded: true, count: data.length };
  },
});
