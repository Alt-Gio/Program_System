// ============================================================
// DICT Region V – Program Management System
// Types & Project Definitions
// ============================================================

// ---- Participant Breakdown --------------------------------

export interface ParticipantGroup {
  male: number;
  female: number;
}

export interface ParticipantBreakdown {
  nga: ParticipantGroup;
  lgu: ParticipantGroup;
  suc: ParticipantGroup;
  others: ParticipantGroup & { label?: string };
}

export function totalParticipants(p: ParticipantBreakdown): number {
  return (
    p.nga.male + p.nga.female +
    p.lgu.male + p.lgu.female +
    p.suc.male + p.suc.female +
    p.others.male + p.others.female
  );
}

// ---- Activity Status ------------------------------------

export type ActivityStatus = "Draft" | "Submitted" | "Validated" | "Reported";
export type ModeOfConduct = "On-Site" | "Online" | "Hybrid" | "Face-to-Face" | "On-Site/Face-to-Face";
export type SyncDirection = "import" | "export";

// ---- Project Types (drives dynamic form) ----------------

export type ProjectType =
  | "eGovPH"
  | "eLGU"
  | "FreeWiFi"
  | "GovNet"
  | "NBP"
  | "Cybersecurity"
  | "PNPKI"
  | "DRRM"
  | "ILCDB"
  | "IIDB";

// ---- Project Definitions --------------------------------

export interface HighlightField {
  key: string;
  label: string;
  icon?: string;
  format?: "number" | "text" | "list" | "date";
  source?: "participants" | "extraFields" | "activity" | "computed";
  computeFn?: (activity: any) => string | number;
}

export interface ProjectDefinition {
  code: string;
  name: string;
  shortName: string;
  description: string;
  division: string;
  projectType: ProjectType;
  targetSectors: string[];
  modeOptions: ModeOfConduct[];
  requirementNote?: string;
  color: string;
  icon: string;
  extraFieldSchema: ExtraFieldDef[];
  sheetsColumnMap: Record<string, string>;
  highlightFields?: HighlightField[];
}

export interface ExtraFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "url" | "textarea";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  group?: string;
}

// ============================================================
// PROJECT REGISTRY – all DICT Region V programs
// ============================================================

export const DICT_PROJECTS: ProjectDefinition[] = [

  // ----------------------------------------------------------
  {
    code: "EGOV",
    name: "eGovPH Mobile Application",
    shortName: "eGovPH",
    description: "One-stop-shop mobile application for National and Local Government Services",
    division: "ILCDB",
    projectType: "eGovPH",
    targetSectors: ["All Sector", "NGA", "LGU", "SUC", "Private", "Communities"],
    modeOptions: ["On-Site", "Online", "Hybrid", "Face-to-Face"],
    requirementNote: "Government-Issued ID for online verification process",
    color: "#1a56db",
    icon: "Monitor",
    extraFieldSchema: [
      { key: "program", label: "Program", type: "text", required: true, group: "Classification" },
      { key: "promotionalActivity", label: "Promotional Activity / Caravan", type: "select",
        options: ["Yes", "No"], group: "Classification" },
      { key: "conducedMentorship", label: "Conducted Mentorship", type: "select",
        options: ["Yes", "No"], group: "Classification" },
      { key: "egovDownloads", label: "No. of App Downloads (Cumulative)", type: "number", group: "Metrics" },
    ],
    sheetsColumnMap: {
      month: "Month (Do not Edit)",
      province: "Province",
      program: "Program",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner (LGU/NGA/Private)",
      startDate: "Start Date 1/1/2025",
      endDate: "End Date 1/1/2025",
      modeOfConduct: "Mode of Conduct",
      personnelRaw: "DICT Personnel Involve",
      status: "Status (Don't Edit)",
      remarks: "Remarks",
    },
    highlightFields: [
      { key: "participants", label: "Total Participants", icon: "Users", format: "number", source: "computed" },
      { key: "egovDownloads", label: "App Downloads", icon: "Download", format: "number", source: "extraFields" },
      { key: "program", label: "Program Type", icon: "Tag", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "ELGU",
    name: "Electronic Local Government Unit",
    shortName: "eLGU",
    description: "Digitize LGU services to enable online applications, permits, and payments",
    division: "ILCDB",
    projectType: "eLGU",
    targetSectors: ["Local Government Units"],
    modeOptions: ["On-Site", "Face-to-Face", "Online"],
    requirementNote: "Letter of Intent",
    color: "#0e9f6e",
    icon: "Building2",
    extraFieldSchema: [
      { key: "operationalSystems", label: "No. of Operational eLGU Systems", type: "number", group: "Metrics" },
      { key: "trainingCount", label: "No. of Training / Orientation / Testing", type: "number", group: "Metrics" },
      { key: "technicalAssistance", label: "No. of Technical Assistance", type: "number", group: "Metrics" },
      { key: "systemName", label: "System Name / Module", type: "text", group: "System Details" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      lgu: "LGU/Municipality Name",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner (LGU/NGA/Private)",
      startDate: "Start Date",
      endDate: "End Date",
      modeOfConduct: "Mode of Conduct",
      personnelRaw: "DICT Personnel Involve",
      status: "Status",
      remarks: "Remarks",
    },
    highlightFields: [
      { key: "venue", label: "Venue/Location", icon: "MapPin", format: "text", source: "activity" },
      { key: "operationalSystems", label: "Operational Systems", icon: "Server", format: "number", source: "extraFields" },
      { key: "systemName", label: "System/Module", icon: "Code", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "WIFI",
    name: "Free WiFi for All",
    shortName: "Free WiFi",
    description: "Expand public internet access with free, reliable Wi-Fi in schools, hospitals, libraries, and transport hubs",
    division: "DICT Proper",
    projectType: "FreeWiFi",
    targetSectors: ["LGU/Municipalities", "Brgy/LGUs", "NGA", "SUC", "Elementary and Secondary High Schools"],
    modeOptions: ["On-Site", "Face-to-Face"],
    color: "#7e3af2",
    icon: "Wifi",
    extraFieldSchema: [
      { key: "noOfSites", label: "No. of Sites", type: "number", group: "Site Data" },
      { key: "noOfLocations", label: "No. of Locations", type: "number", group: "Site Data" },
      { key: "siteType", label: "Site Type", type: "select",
        options: ["School", "Hospital", "Library", "Transport Hub", "Barangay Hall", "Plaza", "Other"],
        group: "Site Data" },
      { key: "simsDistributed", label: "No. of SIMs Distributed", type: "number", group: "SIM Data" },
      { key: "simTarget", label: "SIM Target", type: "number", group: "SIM Data" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      lgu: "LGU/Municipality Name",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner",
      startDate: "Start Date",
      endDate: "End Date",
      modeOfConduct: "Mode",
      personnelRaw: "DICT Personnel Involve",
      noOfSites: "No. of Sites",
      simsDistributed: "No. of SIMs Distributed",
    },
    highlightFields: [
      { key: "noOfSites", label: "No. of Sites", icon: "Wifi", format: "number", source: "extraFields" },
      { key: "simsDistributed", label: "SIMs Distributed", icon: "HardDrive", format: "number", source: "extraFields" },
      { key: "siteType", label: "Site Type", icon: "MapPin", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "GOVNET",
    name: "Government Network",
    shortName: "GovNet",
    description: "Fast, reliable, and secure internal connectivity for all national government agencies",
    division: "DICT Proper",
    projectType: "GovNet",
    targetSectors: ["NGA", "LGU", "SUC", "Public School"],
    modeOptions: ["On-Site", "Face-to-Face"],
    requirementNote: "Request Letter",
    color: "#c27803",
    icon: "Network",
    extraFieldSchema: [
      { key: "noOfSitesMaintained", label: "No. of GovNet Sites Maintained", type: "number", group: "Site Data" },
      { key: "connectionType", label: "Connection Type", type: "select",
        options: ["Fiber", "Wireless", "Satellite", "Leased Line"], group: "Site Data" },
      { key: "bandwidthMbps", label: "Bandwidth (Mbps)", type: "number", group: "Site Data" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      lgu: "LGU/Municipality Name",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner",
      startDate: "Start Date",
      endDate: "End Date",
      personnelRaw: "DICT Personnel Involve",
    },
    highlightFields: [
      { key: "noOfSitesMaintained", label: "Sites Maintained", icon: "Network", format: "number", source: "extraFields" },
      { key: "bandwidthMbps", label: "Bandwidth (Mbps)", icon: "TrendingUp", format: "number", source: "extraFields" },
      { key: "connectionType", label: "Connection Type", icon: "Wifi", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "NBP",
    name: "National Broadband Program",
    shortName: "NBP",
    description: "Bridge the digital divide by deploying broadband connectivity through fiber optic cables and wireless technologies",
    division: "DICT Proper",
    projectType: "NBP",
    targetSectors: ["NGA", "LGU", "Educational Institutions", "Public Health Facilities",
      "Financial Institutions", "Remote and Underserved Communities"],
    modeOptions: ["On-Site", "Face-to-Face"],
    color: "#e02424",
    icon: "Globe",
    extraFieldSchema: [
      { key: "ongoingSites", label: "No. of Ongoing Implementation Sites", type: "number", group: "Site Data" },
      { key: "nfbPhase", label: "NFB Phase", type: "select", options: ["Phase 1", "Phase 2", "Phase 3"], group: "Site Data" },
      { key: "assistanceType", label: "Type of Assistance", type: "text", group: "Site Data" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner",
      startDate: "Start Date",
      endDate: "End Date",
      personnelRaw: "DICT Personnel Involve",
    },
    highlightFields: [
      { key: "ongoingSites", label: "Ongoing Sites", icon: "Globe", format: "number", source: "extraFields" },
      { key: "nfbPhase", label: "NFB Phase", icon: "TrendingUp", format: "text", source: "extraFields" },
      { key: "assistanceType", label: "Assistance Type", icon: "Tag", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "CYBER",
    name: "Cybersecurity",
    shortName: "Cybersecurity",
    description: "Raise awareness of cyber threats and promote cybersecurity best practices",
    division: "ILCDB",
    projectType: "Cybersecurity",
    targetSectors: ["NGA", "LGU", "PWD", "PDL", "Students", "Out-of-School Youth",
      "MSMEs", "Senior Citizens", "Parents", "Private Sector", "Women", "Communities"],
    modeOptions: ["On-Site", "Face-to-Face", "Online", "Hybrid"],
    requirementNote: "Request Letter",
    color: "#ff5a1f",
    icon: "Shield",
    extraFieldSchema: [
      { key: "noOfActivities", label: "No. of Cybersecurity Activities", type: "number", group: "Metrics" },
      { key: "noOfParticipants", label: "No. of Participants (Cumulative)", type: "number", group: "Metrics" },
      { key: "awarenessType", label: "Awareness Type", type: "select",
        options: ["Awareness Campaign", "Training", "Seminar", "Workshop", "Info Drive"], group: "Activity Details" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      lgu: "LGU/Municipality Name",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner (LGU/NGA/Private)",
      startDate: "Start Date",
      endDate: "End Date",
      modeOfConduct: "Mode of Conduct",
      personnelRaw: "DICT Personnel Involve",
      afterActivityReport: "After Activity Report",
      fbPostingLink: "Link of FB Posting (if available)",
      rawPhotosLink: "Raw Photos & Testimonials",
    },
    highlightFields: [
      { key: "participants", label: "Total Participants", icon: "Users", format: "number", source: "computed" },
      { key: "noOfActivities", label: "Cyber Activities", icon: "Shield", format: "number", source: "extraFields" },
      { key: "awarenessType", label: "Awareness Type", icon: "Tag", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "PNPKI",
    name: "Philippine National PKI",
    shortName: "PNPKI",
    description: "Public Key Infrastructure – Protecting communication between citizens and governmental organizations",
    division: "ILCDB",
    projectType: "PNPKI",
    targetSectors: ["NGA", "LGU", "Private Sector"],
    modeOptions: ["On-Site", "Face-to-Face", "Online", "Hybrid"],
    requirementNote: "Request Letter",
    color: "#1c64f2",
    icon: "Key",
    extraFieldSchema: [
      { key: "orientationsCount", label: "No. of Orientations / Engagements", type: "number", group: "Metrics" },
      { key: "applicationsProcessed", label: "No. of Processed PNPKI Applications", type: "number", group: "Metrics" },
      { key: "technicalAssistance", label: "No. of Technical Assistance", type: "number", group: "Metrics" },
      { key: "applicationType", label: "Application Type", type: "select",
        options: ["New", "Renewal", "Revocation"], group: "Application" },
      { key: "applicantOrg", label: "Applicant Organization", type: "text", group: "Application" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner",
      startDate: "Start Date",
      endDate: "End Date",
      modeOfConduct: "Mode of Conduct",
      personnelRaw: "DICT Personnel Involve",
    },
    highlightFields: [
      { key: "applicationsProcessed", label: "Applications Processed", icon: "Key", format: "number", source: "extraFields" },
      { key: "orientationsCount", label: "Orientations/Engagements", icon: "Users", format: "number", source: "extraFields" },
      { key: "applicationType", label: "Application Type", icon: "Tag", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "DRRM",
    name: "Disaster Risk Reduction and Management",
    shortName: "DRRM",
    description: "Ensure continuous communication services during disasters and emergencies",
    division: "DICT Proper",
    projectType: "DRRM",
    targetSectors: ["All Sector"],
    modeOptions: ["On-Site", "Face-to-Face"],
    requirementNote: "Request Letter",
    color: "#e3a008",
    icon: "AlertTriangle",
    extraFieldSchema: [
      { key: "exerciseType", label: "Exercise / Drill Type", type: "text", group: "Activity Details" },
      { key: "equipmentEvaluated", label: "Equipment Evaluated", type: "textarea", group: "Activity Details" },
      { key: "communicationProject", label: "Communication Project", type: "text",
        placeholder: "e.g. PDRF Communication Exercise REACH", group: "Activity Details" },
      { key: "simsDistributed", label: "No. of SIMs Distributed", type: "number", group: "Metrics" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      lgu: "LGU/Municipality Name",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner",
      startDate: "Start Date",
      endDate: "End Date",
      personnelRaw: "DICT Personnel Involve",
    },
    highlightFields: [
      { key: "simsDistributed", label: "SIMs Distributed", icon: "HardDrive", format: "number", source: "extraFields" },
      { key: "exerciseType", label: "Exercise/Drill Type", icon: "AlertTriangle", format: "text", source: "extraFields" },
      { key: "communicationProject", label: "Communication Project", icon: "Tag", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "ILCDB",
    name: "ICT Literacy and Competency Development Bureau",
    shortName: "ILCDB",
    description: "Promote digital literacy and develop ICT skills across students, workforce, and communities",
    division: "ILCDB",
    projectType: "ILCDB",
    targetSectors: ["NGA", "LGU", "PWD", "PDL", "Students", "Out-of-School Youth",
      "MSMEs", "Senior Citizens", "Private Sector", "Women", "Communities"],
    modeOptions: ["On-Site", "Face-to-Face", "Online", "Hybrid"],
    requirementNote: "Request Letter",
    color: "#046c4e",
    icon: "GraduationCap",
    extraFieldSchema: [
      { key: "subProgram", label: "Sub-Program", type: "select",
        options: ["Project Click", "SPARK", "DTC (Digital Transformation Centers)", "F2F Info Session", "Other"],
        group: "Program" },
      { key: "noOfTrainees", label: "No. of Trainees", type: "number", group: "Metrics" },
      { key: "trainingDuration", label: "Duration (hours/days)", type: "text", group: "Metrics" },
      { key: "courseTitle", label: "Course / Module Title", type: "text", group: "Training Details" },
      { key: "certificationIssued", label: "Certificates Issued", type: "number", group: "Training Details" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      lgu: "LGU/Municipality Name",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner (LGU/NGA/Private)",
      startDate: "Start Date",
      endDate: "End Date",
      modeOfConduct: "Mode of Conduct",
      personnelRaw: "DICT Personnel Involve",
      afterActivityReport: "After Activity Report",
      fbPostingLink: "Link of FB Posting (if available)",
    },
    highlightFields: [
      { key: "noOfTrainees", label: "No. of Trainees", icon: "Users", format: "number", source: "extraFields" },
      { key: "certificationIssued", label: "Certificates Issued", icon: "GraduationCap", format: "number", source: "extraFields" },
      { key: "subProgram", label: "Sub-Program", icon: "Tag", format: "text", source: "extraFields" },
    ],
  },

  // ----------------------------------------------------------
  {
    code: "IIDB",
    name: "ICT Industry and Development Bureau",
    shortName: "IIDB",
    description: "Promote growth and competitiveness of the ICT industry; attract investments and create ICT-related jobs",
    division: "IIDB",
    projectType: "IIDB",
    targetSectors: ["NDA", "MSMEs", "Freelancing Industry", "Startup Industry",
      "Academe / HEIs", "LGU", "IT-BPM Industry", "Civil Society", "Students",
      "Emerging Tech Industry", "Other Private Stakeholders"],
    modeOptions: ["On-Site", "Face-to-Face"],
    color: "#5521b5",
    icon: "TrendingUp",
    extraFieldSchema: [
      { key: "partnershipType", label: "Partnership Type", type: "select",
        options: ["MOA", "MOU", "Partnership", "Collaboration", "Other"], group: "Partnership" },
      { key: "noOfPartnerships", label: "No. of Partnerships Developed/Supported", type: "number", group: "Metrics" },
      { key: "emergingTech", label: "Emerging Technology Capability Development", type: "text", group: "Metrics" },
      { key: "ictRoadmapImpl", label: "ICT Roadmap Implementation", type: "number", group: "Metrics" },
      { key: "conferenceType", label: "ICT Conference Type", type: "text", group: "Event Details" },
    ],
    sheetsColumnMap: {
      month: "Month",
      province: "Province",
      activityTitle: "Activity Title",
      venue: "Venue",
      partnerOrganizations: "Name of Partner",
      startDate: "Start Date",
      endDate: "End Date",
      personnelRaw: "DICT Personnel Involve",
    },
    highlightFields: [
      { key: "noOfPartnerships", label: "Partnerships Developed", icon: "TrendingUp", format: "number", source: "extraFields" },
      { key: "ictRoadmapImpl", label: "ICT Roadmap Implementation", icon: "MapPin", format: "number", source: "extraFields" },
      { key: "partnershipType", label: "Partnership Type", icon: "Tag", format: "text", source: "extraFields" },
    ],
  },
];

// ---- Helper: get project by code -------------------------

export function getProjectByCode(code: string): ProjectDefinition | undefined {
  return DICT_PROJECTS.find(p => p.code === code);
}

// ---- Bicol Region Provinces ------------------------------

export const BICOL_PROVINCES = [
  { name: "Albay",            code: "ALB", lat: 13.1775, lng: 123.6279 },
  { name: "Camarines Norte",  code: "CAN", lat: 14.1389, lng: 122.7632 },
  { name: "Camarines Sur",    code: "CAS", lat: 13.6252, lng: 123.1855 },
  { name: "Catanduanes",      code: "CAT", lat: 13.7089, lng: 124.2422 },
  { name: "Masbate",          code: "MAS", lat: 12.3696, lng: 123.6158 },
  { name: "Sorsogon",         code: "SOR", lat: 12.9735, lng: 124.0037 },
] as const;

// ---- FY Options ------------------------------------------

export const FISCAL_YEARS = ["FY 2024", "FY 2025", "FY 2026", "FY 2027"];
export const CURRENT_FY = "FY 2025";
export const CURRENT_YEAR = 2025;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ---- Report Formats -------------------------------------

export type ReportFormat = "pdf" | "xlsx" | "google_sheets";

export interface ReportFilters {
  projectCode?: string;
  provinceCode?: string;
  fy?: string;
  monthFrom?: number;
  monthTo?: number;
  status?: ActivityStatus;
}

// ---- Google Sheets Import Result ------------------------

export interface SheetsImportResult {
  success: boolean;
  rowsImported: number;
  rowsSkipped: number;
  errors: Array<{ row: number; message: string }>;
  activityIds: string[];
}

// ---- Status helpers -------------------------------------

export const STATUS_OPTIONS: ActivityStatus[] = ["Draft", "Submitted", "Validated", "Reported"];

export function getStatusColor(status: string): string {
  switch (status) {
    case "Reported":   return "bg-green-100 text-green-800 border-green-200";
    case "Validated":  return "bg-blue-100 text-blue-800 border-blue-200";
    case "Submitted":  return "bg-amber-100 text-amber-800 border-amber-200";
    case "Draft":      return "bg-gray-100 text-gray-600 border-gray-200";
    default:           return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

// keep old export name for backwards compat
export type ProjectCode = string;
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type ProvinceCode = "ALB" | "CAN" | "CAS" | "CAT" | "MAS" | "SOR";

