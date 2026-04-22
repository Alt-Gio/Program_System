import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const listActivities = query({
  args: {
    projectId: v.optional(v.id("projects")),
    provinceId: v.optional(v.id("provinces")),
    year: v.optional(v.number()),
    month: v.optional(v.number()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let results;
    if (args.projectId && args.provinceId) {
      results = await ctx.db
        .query("activities")
        .withIndex("by_project_province", (i) =>
          i.eq("projectId", args.projectId!).eq("provinceId", args.provinceId!)
        )
        .order("desc")
        .collect();
    } else if (args.projectId) {
      results = await ctx.db
        .query("activities")
        .withIndex("by_project", (i) => i.eq("projectId", args.projectId!))
        .order("desc")
        .collect();
    } else if (args.provinceId) {
      results = await ctx.db
        .query("activities")
        .withIndex("by_province", (i) => i.eq("provinceId", args.provinceId!))
        .order("desc")
        .collect();
    } else {
      results = await ctx.db.query("activities").order("desc").collect();
    }
    if (args.year) results = results.filter(a => a.year === args.year);
    if (args.month) results = results.filter(a => a.month === args.month);
    if (args.status) results = results.filter(a => a.status === args.status);
    return args.limit ? results.slice(0, args.limit) : results;
  },
});

export const getActivity = query({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.id);
    if (!activity) return null;
    const project = await ctx.db.get(activity.projectId);
    const province = await ctx.db.get(activity.provinceId);
    const lgu = activity.lguId ? await ctx.db.get(activity.lguId) : null;
    return { ...activity, project, province, lgu };
  },
});

export const projectStats = query({
  args: { projectId: v.id("projects"), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_project", (i) => i.eq("projectId", args.projectId))
      .collect();
    const filtered = args.year ? activities.filter(a => a.year === args.year) : activities;
    const totalParticipants = filtered.reduce((sum, a) => {
      const p = a.participants;
      return sum + p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
        p.suc.male + p.suc.female + p.others.male + p.others.female;
    }, 0);
    const byProvince: Record<string, { count: number; participants: number }> = {};
    for (const a of filtered) {
      const key = a.provinceId;
      if (!byProvince[key]) byProvince[key] = { count: 0, participants: 0 };
      byProvince[key].count++;
      const p = a.participants;
      byProvince[key].participants += p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
        p.suc.male + p.suc.female + p.others.male + p.others.female;
    }
    const byMonth: Record<number, number> = {};
    for (const a of filtered) { byMonth[a.month] = (byMonth[a.month] || 0) + 1; }
    return {
      totalActivities: filtered.length,
      totalParticipants,
      byStatus: {
        draft: filtered.filter(a => a.status === "Draft").length,
        submitted: filtered.filter(a => a.status === "Submitted").length,
        validated: filtered.filter(a => a.status === "Validated").length,
        reported: filtered.filter(a => a.status === "Reported").length,
      },
      byProvince,
      byMonth,
    };
  },
});

export const dashboardSummary = query({
  args: { 
    year: v.optional(v.union(v.number(), v.literal("all"))),
    provinceId: v.optional(v.id("provinces")),
    month: v.optional(v.number()),
    projectCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const projects = await ctx.db.query("projects").collect();
    let allActivities = await ctx.db.query("activities").collect();
    
    // Apply filters
    if (args.year && args.year !== "all") {
      allActivities = allActivities.filter(a => a.year === args.year);
    }
    if (args.provinceId) {
      allActivities = allActivities.filter(a => a.provinceId === args.provinceId);
    }
    if (args.month && args.month > 0) {
      allActivities = allActivities.filter(a => a.month === args.month);
    }
    if (args.projectCode) {
      const project = projects.find(p => p.code === args.projectCode);
      if (project) {
        allActivities = allActivities.filter(a => a.projectId === project._id);
      }
    }
    
    const filtered = allActivities;
    const summary = await Promise.all(
      projects.map(async (p) => {
        const acts = filtered.filter(a => a.projectId === p._id);
        const participants = acts.reduce((sum, a) => {
          const pt = a.participants;
          return sum + pt.nga.male + pt.nga.female + pt.lgu.male + pt.lgu.female +
            pt.suc.male + pt.suc.female + pt.others.male + pt.others.female;
        }, 0);
        return {
          projectId: p._id,
          code: p.code,
          name: p.name,
          shortName: p.shortName,
          color: p.color,
          icon: p.icon,
          totalActivities: acts.length,
          totalParticipants: participants,
          byStatus: {
            draft: acts.filter(a => a.status === "Draft").length,
            submitted: acts.filter(a => a.status === "Submitted").length,
            validated: acts.filter(a => a.status === "Validated").length,
            reported: acts.filter(a => a.status === "Reported").length,
          },
          provinces: [...new Set(acts.map(a => a.provinceId))].length,
        };
      })
    );
    const totalParticipants = filtered.reduce((sum, a) => {
      const p = a.participants;
      return sum + p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
        p.suc.male + p.suc.female + p.others.male + p.others.female;
    }, 0);
    const totalMale = filtered.reduce((sum, a) => {
      return sum + a.participants.nga.male + a.participants.lgu.male +
        a.participants.suc.male + a.participants.others.male;
    }, 0);
    const byMonth: Record<number, number> = {};
    for (const a of filtered) {
      byMonth[a.month] = (byMonth[a.month] || 0) + 1;
    }
    return {
      year: args.year === "all" ? "all" : (args.year ?? new Date().getFullYear()),
      totalActivities: filtered.length,
      totalParticipants,
      totalMale,
      totalFemale: totalParticipants - totalMale,
      totalProjects: projects.length,
      byStatus: {
        draft: filtered.filter(a => a.status === "Draft").length,
        submitted: filtered.filter(a => a.status === "Submitted").length,
        validated: filtered.filter(a => a.status === "Validated").length,
        reported: filtered.filter(a => a.status === "Reported").length,
      },
      byMonth,
      summary,
    };
  },
});

export const activitiesForMap = query({
  args: { projectId: v.optional(v.id("projects")), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let activities = await ctx.db.query("activities").collect();
    if (args.projectId) activities = activities.filter(a => a.projectId === args.projectId);
    if (args.year) activities = activities.filter(a => a.year === args.year);
    const result = await Promise.all(
      activities.map(async (a) => {
        const lgu = a.lguId ? await ctx.db.get(a.lguId) : null;
        const province = await ctx.db.get(a.provinceId);
        const project = await ctx.db.get(a.projectId);
        const coords = lgu?.coordinates ?? province?.coordinates;
        if (!coords) return null;
        return {
          id: a._id, lat: coords.lat, lng: coords.lng,
          activityTitle: a.activityTitle, projectCode: project?.code,
          projectColor: project?.color, province: province?.name,
          lgu: lgu?.name, date: a.startDate, status: a.status,
        };
      })
    );
    return result.filter(Boolean);
  },
});

export const createActivity = mutation({
  args: {
    projectId: v.id("projects"),
    provinceId: v.id("provinces"),
    lguId: v.optional(v.id("lgus")),
    barangay: v.optional(v.string()),
    month: v.number(),
    year: v.number(),
    activityTitle: v.string(),
    venue: v.string(),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    partnerOrganizations: v.array(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    modeOfConduct: v.string(),
    personnelIds: v.array(v.id("personnel")),
    personnelRaw: v.optional(v.string()),
    participants: v.object({
      nga: v.object({ male: v.number(), female: v.number() }),
      lgu: v.object({ male: v.number(), female: v.number() }),
      suc: v.object({ male: v.number(), female: v.number() }),
      others: v.object({ male: v.number(), female: v.number(), label: v.optional(v.string()) }),
    }),
    images: v.optional(v.array(v.object({
      url: v.string(),
      driveId: v.optional(v.string()),
      caption: v.optional(v.string()),
      uploadedAt: v.number(),
    }))),
    afterActivityReport: v.optional(v.string()),
    fbPostingLink: v.optional(v.string()),
    rawPhotosLink: v.optional(v.string()),
    testimonialsLink: v.optional(v.string()),
    driveFolderLink: v.optional(v.string()),
    remarks: v.optional(v.string()),
    extraFields: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", { ...args, status: "Draft", syncedToSheets: false });
  },
});

export const updateActivity = mutation({
  args: {
    id: v.id("activities"),
    activityTitle: v.optional(v.string()),
    venue: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    partnerOrganizations: v.optional(v.array(v.string())),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    modeOfConduct: v.optional(v.string()),
    personnelRaw: v.optional(v.string()),
    participants: v.optional(v.object({
      nga: v.object({ male: v.number(), female: v.number() }),
      lgu: v.object({ male: v.number(), female: v.number() }),
      suc: v.object({ male: v.number(), female: v.number() }),
      others: v.object({ male: v.number(), female: v.number(), label: v.optional(v.string()) }),
    })),
    afterActivityReport: v.optional(v.string()),
    fbPostingLink: v.optional(v.string()),
    rawPhotosLink: v.optional(v.string()),
    testimonialsLink: v.optional(v.string()),
    remarks: v.optional(v.string()),
    extraFields: v.optional(v.string()),
    status: v.optional(v.string()),
    updatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, { ...patch, syncedToSheets: false });
    return id;
  },
});

export const updateActivityStatus = mutation({
  args: { id: v.id("activities"), status: v.string(), updatedBy: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status, updatedBy: args.updatedBy });
  },
});

export const deleteActivity = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

export const deleteAllActivities = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("activities").collect();
    for (const a of all) {
      await ctx.db.delete(a._id);
    }
    return { deleted: all.length };
  },
});

// Groups activities by LGU within a province — used for LGU-level map drill-down
export const activitiesByLGU = query({
  args: {
    provinceId: v.id("provinces"),
    projectId: v.optional(v.id("projects")),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let activities = await ctx.db
      .query("activities")
      .withIndex("by_province", (i) => i.eq("provinceId", args.provinceId))
      .collect();
    if (args.projectId) activities = activities.filter(a => a.projectId === args.projectId);
    if (args.year) activities = activities.filter(a => a.year === args.year);

    const lguMap: Record<string, { count: number; participants: number; barangays: string[] }> = {};
    for (const a of activities) {
      const key = a.lguId ?? "__unknown__";
      if (!lguMap[key]) lguMap[key] = { count: 0, participants: 0, barangays: [] };
      lguMap[key].count++;
      const p = a.participants;
      lguMap[key].participants += p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
        p.suc.male + p.suc.female + p.others.male + p.others.female;
      if (a.extraFields) {
        try {
          const ef = JSON.parse(a.extraFields);
          if (ef.barangay && !lguMap[key].barangays.includes(ef.barangay)) {
            lguMap[key].barangays.push(ef.barangay);
          }
        } catch {}
      }
    }

    const results = [];
    for (const [lguId, stats] of Object.entries(lguMap)) {
      if (lguId === "__unknown__") continue;
      const lgu = await ctx.db.get(lguId as Id<"lgus">);
      if (!lgu?.coordinates) continue;
      results.push({
        lguId,
        lguName: lgu.name,
        lguType: lgu.type,
        lat: lgu.coordinates.lat,
        lng: lgu.coordinates.lng,
        activityCount: stats.count,
        participantCount: stats.participants,
        barangays: stats.barangays,
      });
    }
    return results;
  },
});

// Returns barangay-level breakdown for a province/LGU — used for sidebar panel
export const activitiesBarangayBreakdown = query({
  args: {
    provinceId: v.id("provinces"),
    lguId: v.optional(v.id("lgus")),
    projectId: v.optional(v.id("projects")),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let activities = await ctx.db
      .query("activities")
      .withIndex("by_province", (i) => i.eq("provinceId", args.provinceId))
      .collect();
    if (args.lguId) activities = activities.filter(a => a.lguId === args.lguId);
    if (args.projectId) activities = activities.filter(a => a.projectId === args.projectId);
    if (args.year) activities = activities.filter(a => a.year === args.year);

    const bmap: Record<string, { count: number; participants: number; titles: string[] }> = {};
    for (const a of activities) {
      let brgy = "";
      if (a.extraFields) {
        try { const ef = JSON.parse(a.extraFields); brgy = ef.barangay ?? ""; } catch {}
      }
      const key = brgy || "(No barangay)";
      if (!bmap[key]) bmap[key] = { count: 0, participants: 0, titles: [] };
      bmap[key].count++;
      const p = a.participants;
      bmap[key].participants += p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
        p.suc.male + p.suc.female + p.others.male + p.others.female;
      if (bmap[key].titles.length < 3) bmap[key].titles.push(a.activityTitle);
    }

    return Object.entries(bmap)
      .map(([barangay, s]) => ({
        barangay,
        activityCount: s.count,
        participantCount: s.participants,
        sampleTitles: s.titles,
      }))
      .sort((a, b) => b.activityCount - a.activityCount);
  },
});

export const activitiesByProvince = query({
  args: { projectId: v.optional(v.id("projects")), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let activities = await ctx.db.query("activities").collect();
    if (args.projectId) activities = activities.filter(a => a.projectId === args.projectId);
    if (args.year) activities = activities.filter(a => a.year === args.year);

    const provinceMap: Record<string, { count: number; participants: number; byProject: Record<string, number> }> = {};
    for (const a of activities) {
      const k = a.provinceId;
      if (!provinceMap[k]) provinceMap[k] = { count: 0, participants: 0, byProject: {} };
      provinceMap[k].count++;
      const p = a.participants;
      provinceMap[k].participants += p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
        p.suc.male + p.suc.female + p.others.male + p.others.female;
      const proj = await ctx.db.get(a.projectId);
      if (proj) provinceMap[k].byProject[proj.code] = (provinceMap[k].byProject[proj.code] ?? 0) + 1;
    }

    const result = [];
    for (const [provinceId, stats] of Object.entries(provinceMap)) {
      const province = await ctx.db.get(provinceId as Id<"provinces">);
      if (!province || !province.coordinates) continue;
      result.push({
        provinceId,
        provinceName: province.name,
        provinceCode: province.code,
        lat: province.coordinates.lat,
        lng: province.coordinates.lng,
        activityCount: stats.count,
        participantCount: stats.participants,
        byProject: stats.byProject,
      });
    }
    return result;
  },
});

export const lookerExport = query({
  args: {
    projectId: v.optional(v.id("projects")),
    provinceId: v.optional(v.id("provinces")),
    year: v.optional(v.number()),
    month: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let activities;
    if (args.projectId) {
      activities = await ctx.db.query("activities")
        .withIndex("by_project", i => i.eq("projectId", args.projectId!))
        .collect();
    } else if (args.provinceId) {
      activities = await ctx.db.query("activities")
        .withIndex("by_province", i => i.eq("provinceId", args.provinceId!))
        .collect();
    } else {
      activities = await ctx.db.query("activities").collect();
    }
    if (args.year) activities = activities.filter(a => a.year === args.year);
    if (args.month) activities = activities.filter(a => a.month === args.month);

    const MONTH_NAMES = ["January","February","March","April","May","June",
      "July","August","September","October","November","December"];

    return Promise.all(activities.map(async (a) => {
      const project = await ctx.db.get(a.projectId);
      const province = await ctx.db.get(a.provinceId);
      const lgu = a.lguId ? await ctx.db.get(a.lguId) : null;
      const p = a.participants;
      const totalMale = p.nga.male + p.lgu.male + p.suc.male + p.others.male;
      const totalFemale = p.nga.female + p.lgu.female + p.suc.female + p.others.female;
      const q = a.month <= 3 ? "Q1" : a.month <= 6 ? "Q2" : a.month <= 9 ? "Q3" : "Q4";
      return {
        record_id: a._id,
        year: a.year,
        month: a.month,
        month_name: MONTH_NAMES[a.month - 1] ?? "",
        quarter: q,
        project_code: project?.code ?? "",
        project_name: project?.name ?? "",
        project_short_name: project?.shortName ?? "",
        division: project?.division ?? "",
        province: province?.name ?? "",
        province_code: province?.code ?? "",
        lgu: lgu?.name ?? "",
        activity_title: a.activityTitle,
        venue: a.venue,
        start_date: a.startDate,
        end_date: a.endDate,
        mode_of_conduct: a.modeOfConduct,
        partner_organizations: (a.partnerOrganizations ?? []).join("; "),
        personnel: a.personnelRaw ?? "",
        status: a.status,
        nga_male: p.nga.male,
        nga_female: p.nga.female,
        lgu_male: p.lgu.male,
        lgu_female: p.lgu.female,
        suc_male: p.suc.male,
        suc_female: p.suc.female,
        others_male: p.others.male,
        others_female: p.others.female,
        others_label: p.others.label ?? "Others",
        total_male: totalMale,
        total_female: totalFemale,
        total_participants: totalMale + totalFemale,
        after_activity_report: a.afterActivityReport ?? "",
        fb_posting_link: a.fbPostingLink ?? "",
        raw_photos_link: a.rawPhotosLink ?? "",
        testimonials_link: a.testimonialsLink ?? "",
        remarks: a.remarks ?? "",
        imported_from: a.importedFrom ?? "manual",
      };
    }));
  },
});

export const bulkImportActivities = mutation({
  args: {
    projectId: v.id("projects"),
    activities: v.array(v.object({
      provinceId: v.id("provinces"),
      lguId: v.optional(v.id("lgus")),
      month: v.number(),
      year: v.number(),
      activityTitle: v.string(),
      venue: v.string(),
      partnerOrganizations: v.array(v.string()),
      startDate: v.string(),
      endDate: v.string(),
      modeOfConduct: v.string(),
      personnelRaw: v.optional(v.string()),
      participants: v.object({
        nga: v.object({ male: v.number(), female: v.number() }),
        lgu: v.object({ male: v.number(), female: v.number() }),
        suc: v.object({ male: v.number(), female: v.number() }),
        others: v.object({ male: v.number(), female: v.number(), label: v.optional(v.string()) }),
      }),
      remarks: v.optional(v.string()),
      extraFields: v.optional(v.string()),
    })),
    importedBy: v.string(),
    sheetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ids: string[] = [];
    const now = Date.now();
    for (const activity of args.activities) {
      const id = await ctx.db.insert("activities", {
        projectId: args.projectId, ...activity,
        personnelIds: [], status: "Submitted",
        createdBy: args.importedBy,
        importedFrom: "google_sheets", importedAt: now,
      });
      ids.push(id);
    }
    if (args.sheetId) {
      await ctx.db.insert("sheetsSyncLog", {
        projectId: args.projectId, sheetId: args.sheetId,
        sheetName: "Activities", syncDirection: "import",
        rowsAffected: ids.length, status: "success",
        syncedAt: now, syncedBy: args.importedBy,
      });
    }
    return { imported: ids.length, ids };
  },
});
