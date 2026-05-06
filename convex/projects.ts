import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { isActive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const projects = await ctx.db.query("projects").collect();
    return args.isActive !== undefined
      ? projects.filter((p) => p.isActive === args.isActive)
      : projects;
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").collect();
    if (existing.length > 0) return { seeded: false, count: existing.length };

    const projectData = [
      { code: "EGOV", name: "eGovPH Mobile Application", shortName: "eGovPH",
        description: "One-stop-shop mobile application for National and Local Government Services",
        division: "ILCDB", projectType: "eGovPH",
        targetSectors: ["All Sector", "NGA", "LGU", "SUC", "Private", "Communities"],
        modeOptions: ["On-Site", "Online", "Hybrid", "Face-to-Face"],
        requirementNote: "Government-Issued ID", color: "#1a56db", icon: "Monitor", isActive: true },
      { code: "ELGU", name: "Electronic Local Government Unit", shortName: "eLGU",
        description: "Digitize LGU services to enable online applications, permits, and payments",
        division: "ILCDB", projectType: "eLGU",
        targetSectors: ["Local Government Units"],
        modeOptions: ["On-Site", "Face-to-Face", "Online"],
        requirementNote: "Letter of Intent", color: "#0e9f6e", icon: "Building2", isActive: true },
      { code: "WIFI", name: "Free WiFi for All", shortName: "Free WiFi",
        description: "Expand public internet access with free, reliable Wi-Fi",
        division: "DICT Proper", projectType: "FreeWiFi",
        targetSectors: ["LGU/Municipalities", "Brgy/LGUs", "NGA", "SUC"],
        modeOptions: ["On-Site", "Face-to-Face"],
        color: "#7e3af2", icon: "Wifi", isActive: true },
      { code: "GOVNET", name: "Government Network", shortName: "GovNet",
        description: "Fast, reliable, and secure internal connectivity for government agencies",
        division: "DICT Proper", projectType: "GovNet",
        targetSectors: ["NGA", "LGU", "SUC", "Public School"],
        modeOptions: ["On-Site", "Face-to-Face"],
        requirementNote: "Request Letter", color: "#c27803", icon: "Network", isActive: true },
      { code: "NBP", name: "National Broadband Program", shortName: "NBP",
        description: "Bridge the digital divide by deploying broadband connectivity",
        division: "DICT Proper", projectType: "NBP",
        targetSectors: ["NGA", "LGU", "Educational Institutions", "Remote Communities"],
        modeOptions: ["On-Site", "Face-to-Face"],
        color: "#e02424", icon: "Globe", isActive: true },
      { code: "CYBER", name: "Cybersecurity", shortName: "Cybersecurity",
        description: "Raise awareness of cyber threats and promote cybersecurity best practices",
        division: "ILCDB", projectType: "Cybersecurity",
        targetSectors: ["NGA", "LGU", "Students", "MSMEs", "Communities"],
        modeOptions: ["On-Site", "Face-to-Face", "Online", "Hybrid"],
        requirementNote: "Request Letter", color: "#ff5a1f", icon: "Shield", isActive: true },
      { code: "PNPKI", name: "Philippine National PKI", shortName: "PNPKI",
        description: "Public Key Infrastructure for secure government communication",
        division: "ILCDB", projectType: "PNPKI",
        targetSectors: ["NGA", "LGU", "Private Sector"],
        modeOptions: ["On-Site", "Face-to-Face", "Online", "Hybrid"],
        requirementNote: "Request Letter", color: "#1c64f2", icon: "Key", isActive: true },
      { code: "DRRM", name: "Disaster Risk Reduction and Management", shortName: "DRRM",
        description: "Ensure continuous communication services during disasters",
        division: "DICT Proper", projectType: "DRRM",
        targetSectors: ["All Sector"],
        modeOptions: ["On-Site", "Face-to-Face"],
        requirementNote: "Request Letter", color: "#e3a008", icon: "AlertTriangle", isActive: true },
      { code: "ILCDB", name: "ICT Literacy and Competency Development", shortName: "ILCDB",
        description: "Promote digital literacy and develop ICT skills",
        division: "ILCDB", projectType: "ILCDB",
        targetSectors: ["NGA", "LGU", "Students", "Out-of-School Youth", "MSMEs", "Women"],
        modeOptions: ["On-Site", "Face-to-Face", "Online", "Hybrid"],
        requirementNote: "Request Letter", color: "#046c4e", icon: "GraduationCap", isActive: true },
      { code: "IIDB", name: "ICT Industry and Development Bureau", shortName: "IIDB",
        description: "Promote growth and competitiveness of the ICT industry",
        division: "IIDB", projectType: "IIDB",
        targetSectors: ["MSMEs", "Startups", "Academe", "LGU", "IT-BPM Industry"],
        modeOptions: ["On-Site", "Face-to-Face"],
        color: "#5521b5", icon: "TrendingUp", isActive: true },
    ];

    for (const p of projectData) {
      await ctx.db.insert("projects", p);
    }
    return { seeded: true, count: projectData.length };
  },
});

// ── CRUD for the Programs settings page ──────────────────────────
// These mirror the schema in convex/schema.ts → `projects`. They are
// intentionally additive — `list` / `getByCode` / `seed` above keep
// working unchanged.
//
// NOTE: Not gated on admin yet to match the existing pattern in this
// file (`seed` is also ungated). Add an `await requireAdmin(ctx)` here
// once the Settings page is restricted to admins via middleware/session.

const projectFields = {
  code:            v.string(),
  name:            v.string(),
  shortName:       v.string(),
  description:     v.string(),
  division:        v.string(),
  projectType:     v.string(),
  targetSectors:   v.array(v.string()),
  modeOptions:     v.array(v.string()),
  requirementNote: v.optional(v.string()),
  color:           v.string(),
  icon:            v.optional(v.string()),
  isActive:        v.boolean(),
  driveId:         v.optional(v.string()),
  fyTarget: v.optional(v.object({
    fy:     v.string(),
    metric: v.string(),
    value:  v.number(),
  })),
};

export const create = mutation({
  args: projectFields,
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    if (!code) throw new Error("Code is required.");

    // Uniqueness — code is the natural key (used by sheet sync,
    // dedup, sidebar routing).
    const dup = await ctx.db
      .query("projects")
      .withIndex("by_code", q => q.eq("code", code))
      .first();
    if (dup) throw new Error(`A program with code "${code}" already exists.`);

    return await ctx.db.insert("projects", { ...args, code });
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    code:            v.optional(v.string()),
    name:            v.optional(v.string()),
    shortName:       v.optional(v.string()),
    description:     v.optional(v.string()),
    division:        v.optional(v.string()),
    projectType:     v.optional(v.string()),
    targetSectors:   v.optional(v.array(v.string())),
    modeOptions:     v.optional(v.array(v.string())),
    requirementNote: v.optional(v.string()),
    color:           v.optional(v.string()),
    icon:            v.optional(v.string()),
    isActive:        v.optional(v.boolean()),
    driveId:         v.optional(v.string()),
    fyTarget: v.optional(v.object({
      fy:     v.string(),
      metric: v.string(),
      value:  v.number(),
    })),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Program not found.");

    // If code is changing, enforce uniqueness against the new value.
    if (patch.code !== undefined) {
      const newCode = patch.code.trim().toUpperCase();
      if (!newCode) throw new Error("Code cannot be empty.");
      if (newCode !== existing.code) {
        const dup = await ctx.db
          .query("projects")
          .withIndex("by_code", q => q.eq("code", newCode))
          .first();
        if (dup) throw new Error(`A program with code "${newCode}" already exists.`);
      }
      patch.code = newCode;
    }

    // Strip undefined entries so we don't overwrite with `undefined`.
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(id, clean);
    return { success: true };
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Program not found.");

    // Soft-cascade: drop any sheet sync connections tied to this
    // project so we don't leave orphans pointing at a missing
    // projectId. Activities are NOT auto-deleted — the operator
    // should make that choice from the Database Sync card.
    const conns = await ctx.db
      .query("sheetsConnections")
      .withIndex("by_project", q => q.eq("projectId", id))
      .collect();
    for (const c of conns) await ctx.db.delete(c._id);

    // Cascade-delete program media (logo + highlights) along with
    // their storage blobs — these are 1:1 owned by the program and
    // would otherwise orphan in storage forever.
    if (existing.logoStorageId) {
      try { await ctx.storage.delete(existing.logoStorageId as any); }
      catch { /* tolerate already-gone */ }
    }
    const highlights = await ctx.db
      .query("programHighlights")
      .withIndex("by_project", q => q.eq("projectId", id))
      .collect();
    for (const h of highlights) {
      try { await ctx.storage.delete(h.storageId as any); }
      catch { /* tolerate */ }
      await ctx.db.delete(h._id);
    }

    await ctx.db.delete(id);
    return {
      success: true,
      removedConnections: conns.length,
      removedHighlights: highlights.length,
    };
  },
});
