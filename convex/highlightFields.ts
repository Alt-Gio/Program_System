import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get highlight fields configuration for a project
export const getProjectHighlightFields = query({
  args: { projectCode: v.string() },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("projectHighlightFields")
      .withIndex("by_project_code", (q) => q.eq("projectCode", args.projectCode))
      .first();
    
    return config;
  },
});

// Get all highlight fields configurations
export const getAllHighlightFields = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db.query("projectHighlightFields").collect();
    return configs;
  },
});

// Save/update highlight fields configuration
export const saveHighlightFields = mutation({
  args: {
    projectCode: v.string(),
    fields: v.array(v.object({
      key: v.string(),
      label: v.string(),
      icon: v.optional(v.string()),
      format: v.string(),
      source: v.string(),
      enabled: v.boolean(),
      order: v.number(),
    })),
    updatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projectHighlightFields")
      .withIndex("by_project_code", (q) => q.eq("projectCode", args.projectCode))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fields: args.fields,
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("projectHighlightFields", {
        projectCode: args.projectCode,
        fields: args.fields,
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
      return id;
    }
  },
});

// Get available fields for a project (from schema)
export const getAvailableFields = query({
  args: { projectCode: v.string() },
  handler: async (ctx, args) => {
    // This returns the available fields that can be highlighted
    // Based on the project's extraFieldSchema and standard activity fields
    
    const standardFields = [
      { key: "participants", label: "Total Participants", source: "computed", format: "number" },
      { key: "venue", label: "Venue/Location", source: "activity", format: "text" },
      { key: "activityTitle", label: "Activity Title", source: "activity", format: "text" },
      { key: "modeOfConduct", label: "Mode of Conduct", source: "activity", format: "text" },
      { key: "partnerOrganizations", label: "Partner Organizations", source: "activity", format: "text" },
    ];

    // Project-specific fields would be added based on extraFieldSchema
    // For now, return standard fields + common extra fields
    const projectSpecificFields: any[] = [];
    
    if (args.projectCode === "EGOV") {
      projectSpecificFields.push(
        { key: "program", label: "Program Type", source: "extraFields", format: "text" },
        { key: "egovDownloads", label: "App Downloads", source: "extraFields", format: "number" },
        { key: "promotionalActivity", label: "Promotional Activity", source: "extraFields", format: "text" },
      );
    } else if (args.projectCode === "ELGU") {
      projectSpecificFields.push(
        { key: "operationalSystems", label: "Operational Systems", source: "extraFields", format: "number" },
        { key: "systemName", label: "System/Module Name", source: "extraFields", format: "text" },
        { key: "trainingCount", label: "Training Count", source: "extraFields", format: "number" },
      );
    } else if (args.projectCode === "WIFI") {
      projectSpecificFields.push(
        { key: "wifiSitesInstalled", label: "WiFi Sites Installed", source: "extraFields", format: "number" },
        { key: "beneficiaries", label: "Estimated Beneficiaries", source: "extraFields", format: "number" },
      );
    }

    return [...standardFields, ...projectSpecificFields];
  },
});
