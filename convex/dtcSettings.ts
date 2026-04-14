import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Get All Settings ─────────────────────────────────────────────────────────
export const getAll = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("dtcSettings").collect();
    
    // Convert to key-value object
    const settingsObj: Record<string, string> = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });

    // Return with defaults
    return {
      wifiSsid: settingsObj.wifiSsid || "DICT-DTC-Free",
      wifiPassword: settingsObj.wifiPassword || "",
      wifiNote: settingsObj.wifiNote || "Free public WiFi",
      accessCode: settingsObj.accessCode || "1234",
      officeOpen: settingsObj.officeOpen || "08:00",
      officeClose: settingsObj.officeClose || "17:00",
      bgImageUrl: settingsObj.bgImageUrl || "",
      interactiveBannerUrl: settingsObj.interactiveBannerUrl || "",
    };
  },
});

// ─── Update Setting ───────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    updatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dtcSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
    } else {
      await ctx.db.insert("dtcSettings", {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
    }

    return { success: true };
  },
});

// ─── Bulk Update Settings ─────────────────────────────────────────────────────
export const bulkUpdate = mutation({
  args: {
    settings: v.object({
      wifiSsid: v.optional(v.string()),
      wifiPassword: v.optional(v.string()),
      wifiNote: v.optional(v.string()),
      accessCode: v.optional(v.string()),
      officeOpen: v.optional(v.string()),
      officeClose: v.optional(v.string()),
      bgImageUrl: v.optional(v.string()),
      interactiveBannerUrl: v.optional(v.string()),
    }),
    updatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    for (const [key, value] of Object.entries(args.settings)) {
      if (value !== undefined) {
        const existing = await ctx.db
          .query("dtcSettings")
          .withIndex("by_key", (q) => q.eq("key", key))
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, {
            value,
            updatedAt: Date.now(),
            updatedBy: args.updatedBy,
          });
        } else {
          await ctx.db.insert("dtcSettings", {
            key,
            value,
            updatedAt: Date.now(),
            updatedBy: args.updatedBy,
          });
        }
      }
    }

    return { success: true };
  },
});
