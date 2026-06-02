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

/** Distinct positions already in use — feeds the Position combobox on the
 *  attendance/register page (pick an existing one or type a new one). */
export const listPositions = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("personnel").collect();
    const set = new Set<string>();
    for (const p of all) if (p.position?.trim()) set.add(p.position.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  },
});

/**
 * Upsert a staff member from the attendance/register flow. Matches an existing
 * personnel row by normalized full name; updates position/division/email when
 * found, otherwise inserts. Returns the personnel `_id` so the caller can
 * enroll the face under it — that id is what `listWithStatus` joins on.
 */
export const upsertStaff = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    position: v.string(),
    division: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = normalizeName(`${args.firstName} ${args.lastName}`);
    const all = await ctx.db.query("personnel").collect();
    const existing = all.find(
      (p) => normalizeName(`${p.firstName} ${p.lastName}`) === target,
    );
    if (existing) {
      await ctx.db.patch(existing._id, {
        position: args.position || existing.position,
        division: args.division || existing.division,
        email: args.email ?? existing.email,
        isActive: true,
      });
      return existing._id;
    }
    return await ctx.db.insert("personnel", {
      firstName: args.firstName,
      lastName: args.lastName,
      position: args.position,
      division: args.division,
      email: args.email,
      isActive: true,
    });
  },
});

/**
 * Per-person attendance "follow-ups": recent recognized time-in/out events.
 * Matches on the personnel id (events enrolled under it) AND, as a fallback,
 * on normalized name across a recent 60-day window — so legacy name-only
 * enrollments still surface.
 */
export const attendanceHistory = query({
  args: { id: v.id("personnel"), limit: v.optional(v.number()) },
  handler: async (ctx, { id, limit }) => {
    const person = await ctx.db.get(id);
    if (!person) return [];
    const lim = limit ?? 20;

    const byId = await ctx.db
      .query("face_attendance")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .take(lim * 2);

    const today = new Date().toISOString().split("T")[0];
    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000)
      .toISOString()
      .split("T")[0];
    const recent = await ctx.db
      .query("face_attendance")
      .withIndex("by_date", (q) => q.gte("date", since).lte("date", today))
      .collect();
    const target = normalizeName(`${person.firstName} ${person.lastName}`);
    const byName = recent.filter((r) => normalizeName(r.name) === target);

    const merged = new Map<string, (typeof byId)[number]>();
    for (const r of [...byId, ...byName]) merged.set(r._id, r);

    return Array.from(merged.values())
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, lim);
  },
});

/**
 * Resolve an opaque recognized userId (from the face server) to a personnel
 * record. Used by the kiosk to (a) decide whether to capture a photo and
 * (b) enrich the greeting. `normalizeId` returns null for non-personnel ids
 * (guests, user_accounts ids, "manual-..." strings) so this never throws.
 */
export const personnelPhotoStatus = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Uniform shape (no discriminated union) so the client can read fields freely.
    const empty = {
      isPersonnel: false, hasPhoto: false,
      firstName: "", lastName: "", position: "", division: "",
    };
    const id = ctx.db.normalizeId("personnel", userId);
    if (!id) return empty;
    const p = await ctx.db.get(id);
    if (!p) return empty;
    return {
      isPersonnel: true,
      hasPhoto: !!p.photoStorageId,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      division: p.division,
    };
  },
});

/**
 * Auto-fill a personnel display photo from a kiosk capture — ONLY when the
 * person has no photo yet, so a deliberately uploaded photo is never
 * overwritten. No-ops safely for non-personnel ids.
 */
export const setPhotoIfMissing = mutation({
  args: { userId: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { userId, storageId }) => {
    const id = ctx.db.normalizeId("personnel", userId);
    if (!id) return { updated: false as const, reason: "not_personnel" };
    const person = await ctx.db.get(id);
    if (!person) return { updated: false as const, reason: "not_found" };
    if (person.photoStorageId) {
      // Don't overwrite a curated photo; discard the just-uploaded blob.
      await ctx.storage.delete(storageId);
      return { updated: false as const, reason: "has_photo" };
    }
    await ctx.db.patch(id, { photoStorageId: storageId });
    return { updated: true as const };
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
