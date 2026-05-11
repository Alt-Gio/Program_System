import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

type LhUser = Doc<"learnhub_users">;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getQuarterRange(quarter: string, year: number) {
  const ranges: Record<string, { start: number; end: number }> = {
    Q1: { start: new Date(`${year}-01-01`).getTime(), end: new Date(`${year}-03-31T23:59:59`).getTime() },
    Q2: { start: new Date(`${year}-04-01`).getTime(), end: new Date(`${year}-06-30T23:59:59`).getTime() },
    Q3: { start: new Date(`${year}-07-01`).getTime(), end: new Date(`${year}-09-30T23:59:59`).getTime() },
    Q4: { start: new Date(`${year}-10-01`).getTime(), end: new Date(`${year}-12-31T23:59:59`).getTime() },
  };
  return ranges[quarter] ?? ranges.Q1;
}

const PROVINCE_MAP: Record<string, string> = {
  // Camarines Sur
  "Naga": "Camarines Sur", "Pili": "Camarines Sur", "Iriga": "Camarines Sur",
  "Libmanan": "Camarines Sur", "Sipocot": "Camarines Sur", "Goa": "Camarines Sur",
  // Albay
  "Legazpi": "Albay", "Daraga": "Albay", "Ligao": "Albay", "Tabaco": "Albay",
  // Sorsogon
  "Sorsogon City": "Sorsogon", "Bulan": "Sorsogon", "Donsol": "Sorsogon",
  // Masbate
  "Masbate City": "Masbate", "Cataingan": "Masbate", "Aroroy": "Masbate",
  // Catanduanes
  "Virac": "Catanduanes", "Bato": "Catanduanes",
  // Camarines Norte
  "Daet": "Camarines Norte", "Mercedes": "Camarines Norte",
};

const PROVINCES = ["Camarines Sur", "Albay", "Sorsogon", "Masbate", "Catanduanes", "Camarines Norte"];

// ── Main Report Query ─────────────────────────────────────────────────────────

export const getQuarterlyReport = query({
  args: {
    mentorId: v.id("learnhub_users"),
    quarter: v.string(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const { start, end } = getQuarterRange(args.quarter, args.year);

    const events = await ctx.db
      .query("learnhub_events")
      .withIndex("by_creator", (q) => q.eq("createdBy", args.mentorId))
      .collect();

    const quarterEvents = events.filter(
      (e) => e.startTime >= start && e.startTime <= end
    );

    const registrantRows = await Promise.all(
      quarterEvents.map((e) =>
        ctx.db
          .query("learnhub_event_registrants")
          .withIndex("by_event", (q) => q.eq("eventId", e._id))
          .collect()
      )
    );
    const allRegistrants = registrantRows.flat();

    const uniqueStudentIds = Array.from(new Set(allRegistrants.map((r) => r.userId)));
    const students = (
      (await Promise.all(uniqueStudentIds.map((id) => ctx.db.get(id)))) as Array<LhUser | null>
    ).filter((s): s is LhUser => s !== null);

    // Modality breakdown
    const online = quarterEvents.filter((e) => e.type === "meet" || e.type === "webinar").length;
    const faceTo = quarterEvents.filter((e) => e.type === "onsite").length;
    const hybrid = quarterEvents.filter((e) => e.type === "hybrid").length;

    // Province distribution
    const provinceCount: Record<string, number> = {};
    for (const province of PROVINCES) provinceCount[province] = 0;
    for (const s of students) {
      if (!s) continue;
      const prov = s.province ?? (s.municipality ? PROVINCE_MAP[s.municipality] : undefined);
      if (prov && prov in provinceCount) provinceCount[prov]++;
    }

    // Gender
    const genderCount = { female: 0, male: 0, prefer_not_to_say: 0, unknown: 0 };
    for (const s of students) {
      if (!s) continue;
      const g = s.gender ?? "unknown";
      if (g in genderCount) (genderCount as Record<string, number>)[g]++;
      else genderCount.unknown++;
    }

    // Sector
    const sectorCount: Record<string, number> = { gov_workforce: 0, education: 0, vulnerable: 0, private: 0, other: 0 };
    for (const s of students) {
      if (!s) continue;
      const sec = s.sector ?? "other";
      if (sec in sectorCount) sectorCount[sec]++;
    }

    // Vulnerable groups
    const vulnerableCount: Record<string, number> = { pdl: 0, als: 0, arb: 0, senior: 0, pwd: 0, ip: 0, other_vulnerable: 0 };
    for (const s of students) {
      if (!s || s.sector !== "vulnerable") continue;
      const vg = s.vulnerableGroup ?? "other_vulnerable";
      if (vg in vulnerableCount) vulnerableCount[vg]++;
      else vulnerableCount.other_vulnerable++;
    }

    // Campaign sections
    const campaigns: Record<string, { events: typeof quarterEvents; studentCount: number }> = {};
    for (const e of quarterEvents) {
      if (!e.campaignTag) continue;
      if (!campaigns[e.campaignTag]) campaigns[e.campaignTag] = { events: [], studentCount: 0 };
      campaigns[e.campaignTag].events.push(e);
    }
    for (const [tag, camp] of Object.entries(campaigns)) {
      const campEventIds = new Set(camp.events.map((e) => e._id));
      const campStudentIds = new Set(
        allRegistrants.filter((r) => campEventIds.has(r.eventId)).map((r) => r.userId)
      );
      campaigns[tag].studentCount = campStudentIds.size;
    }

    // Category performance
    const categoryCount: Record<string, number> = {};
    for (const e of quarterEvents) {
      const cat = e.category ?? "Uncategorized";
      const regCount = allRegistrants.filter((r) => r.eventId === e._id).length;
      categoryCount[cat] = (categoryCount[cat] ?? 0) + regCount;
    }

    // Training modules list
    const modules = quarterEvents.map((e, i) => ({
      index: i + 1,
      title: e.title,
      type: e.type,
      category: e.category,
      campaignTag: e.campaignTag,
      registrantCount: allRegistrants.filter((r) => r.eventId === e._id).length,
    }));

    const coveredProvinces = PROVINCES.filter((p) => provinceCount[p] > 0);

    return {
      totalTrainings: quarterEvents.length,
      totalBeneficiaries: uniqueStudentIds.length,
      provinceCoverage: Math.round((coveredProvinces.length / PROVINCES.length) * 100),
      coveredProvinces,
      modalityBreakdown: { online, faceToFace: faceTo, hybrid },
      provinceDistribution: PROVINCES.map((p) => ({ province: p, count: provinceCount[p] })),
      trainingModules: modules,
      genderBreakdown: genderCount,
      sectorBreakdown: sectorCount,
      vulnerableGroups: vulnerableCount,
      categoryPerformance: Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      campaigns: Object.entries(campaigns).map(([tag, c]) => ({
        tag,
        eventCount: c.events.length,
        studentCount: c.studentCount,
      })),
    };
  },
});

// ── Save / Load cached report ─────────────────────────────────────────────────

export const saveReport = mutation({
  args: {
    mentorId: v.id("learnhub_users"),
    quarter: v.string(),
    year: v.number(),
    reportData: v.any(),
    status: v.union(v.literal("draft"), v.literal("final_review"), v.literal("published")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnhub_quarterly_reports")
      .withIndex("by_mentor", (q) => q.eq("mentorId", args.mentorId))
      .filter((q) => q.and(q.eq(q.field("quarter"), args.quarter), q.eq(q.field("year"), args.year)))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { reportData: args.reportData, status: args.status, generatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("learnhub_quarterly_reports", {
      mentorId: args.mentorId,
      quarter: args.quarter,
      year: args.year,
      reportData: args.reportData,
      status: args.status,
      generatedAt: Date.now(),
    });
  },
});

export const getSavedReport = query({
  args: { mentorId: v.id("learnhub_users"), quarter: v.string(), year: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query("learnhub_quarterly_reports")
      .withIndex("by_mentor", (q) => q.eq("mentorId", args.mentorId))
      .filter((q) => q.and(q.eq(q.field("quarter"), args.quarter), q.eq(q.field("year"), args.year)))
      .unique(),
});

export const listMentorReports = query({
  args: { mentorId: v.id("learnhub_users") },
  handler: async (ctx, args) =>
    ctx.db
      .query("learnhub_quarterly_reports")
      .withIndex("by_mentor", (q) => q.eq("mentorId", args.mentorId))
      .order("desc")
      .collect(),
});
