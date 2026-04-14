import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Add an image to an activity
 */
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
      driveId: args.driveId,
      caption: args.caption,
      uploadedAt: Date.now(),
    };

    const existingImages = activity.images || [];
    const updatedImages = [...existingImages, newImage];

    await ctx.db.patch(args.activityId, {
      images: updatedImages,
    });

    return { success: true, image: newImage };
  },
});

/**
 * Remove an image from an activity
 */
export const removeImage = mutation({
  args: {
    activityId: v.id("activities"),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");

    const existingImages = activity.images || [];
    const updatedImages = existingImages.filter((img) => img.url !== args.imageUrl);

    await ctx.db.patch(args.activityId, {
      images: updatedImages,
    });

    return { success: true };
  },
});

/**
 * Update image caption
 */
export const updateImageCaption = mutation({
  args: {
    activityId: v.id("activities"),
    imageUrl: v.string(),
    caption: v.string(),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");

    const existingImages = activity.images || [];
    const updatedImages = existingImages.map((img) =>
      img.url === args.imageUrl ? { ...img, caption: args.caption } : img
    );

    await ctx.db.patch(args.activityId, {
      images: updatedImages,
    });

    return { success: true };
  },
});

/**
 * Get all images for an activity
 */
export const getActivityImages = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) return [];
    return activity.images || [];
  },
});
