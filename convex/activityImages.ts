import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const addImage = mutation({
  args: {
    activityId: v.id("activities"),
    url: v.string(),
    driveId: v.optional(v.string()),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");

    const newImage = {
      url: args.url,
      driveId: args.driveId || undefined,
      caption: args.caption,
      uploadedAt: Date.now(),
    };

    const existingImages = activity.images || [];
    await ctx.db.patch(args.activityId, {
      images: [...existingImages, newImage],
    });

    return newImage;
  },
});

export const removeImage = mutation({
  args: {
    activityId: v.id("activities"),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");

    const updatedImages = (activity.images || []).filter(
      (img) => img.url !== args.imageUrl
    );

    await ctx.db.patch(args.activityId, {
      images: updatedImages,
    });
  },
});

export const updateImageCaption = mutation({
  args: {
    activityId: v.id("activities"),
    imageUrl: v.string(),
    caption: v.string(),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");

    const updatedImages = (activity.images || []).map((img) =>
      img.url === args.imageUrl ? { ...img, caption: args.caption } : img
    );

    await ctx.db.patch(args.activityId, {
      images: updatedImages,
    });
  },
});

export const getActivityImages = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    return activity?.images || [];
  },
});

export const getRecentImagesForDashboard = query({
  args: {
    provinceId: v.optional(v.id("provinces")),
    year: v.optional(v.number()),
    month: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    let activities;

    if (args.provinceId) {
      activities = await ctx.db
        .query("activities")
        .withIndex("by_province", (q) => q.eq("provinceId", args.provinceId!))
        .filter((q) => q.neq(q.field("images"), undefined))
        .order("desc")
        .take(limit * 3);
    } else if (args.year && args.month) {
      activities = await ctx.db
        .query("activities")
        .withIndex("by_year_month", (q) => q.eq("year", args.year!).eq("month", args.month!))
        .filter((q) => q.neq(q.field("images"), undefined))
        .order("desc")
        .take(limit * 3);
    } else if (args.year) {
      activities = await ctx.db
        .query("activities")
        .filter((q) => q.and(
          q.eq(q.field("year"), args.year),
          q.neq(q.field("images"), undefined)
        ))
        .order("desc")
        .take(limit * 3);
    } else {
      activities = await ctx.db
        .query("activities")
        .filter((q) => q.neq(q.field("images"), undefined))
        .order("desc")
        .take(limit * 3);
    }

    const imagesWithContext = [];
    for (const activity of activities) {
      if (activity.images && activity.images.length > 0) {
        const project = await ctx.db.get(activity.projectId);
        const province = await ctx.db.get(activity.provinceId);
        
        for (const image of activity.images) {
          imagesWithContext.push({
            ...image,
            activityId: activity._id,
            activityTitle: activity.activityTitle,
            projectName: project?.shortName || project?.name,
            provinceName: province?.name,
            month: activity.month,
            year: activity.year,
            startDate: activity.startDate,
          });
          
          if (imagesWithContext.length >= limit) break;
        }
      }
      if (imagesWithContext.length >= limit) break;
    }

    return imagesWithContext;
  },
});
