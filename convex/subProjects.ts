import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const create = mutation({
  args: {
    parentProjectId: v.id("projects"),
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subProjectId = await ctx.db.insert("subProjects", {
      parentProjectId: args.parentProjectId,
      code: args.code,
      name: args.name,
      description: args.description,
      isActive: true,
    });
    return subProjectId;
  },
});

export const update = mutation({
  args: {
    id: v.id("subProjects"),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("subProjects") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subProjects")
      .withIndex("by_parent", (q) => q.eq("parentProjectId", args.projectId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("subProjects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
