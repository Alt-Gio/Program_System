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
