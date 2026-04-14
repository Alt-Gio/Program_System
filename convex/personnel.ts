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
