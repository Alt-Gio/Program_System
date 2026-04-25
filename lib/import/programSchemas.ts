export type FieldType = "text" | "number" | "date" | "select" | "email" | "phone";

export type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
  options?: string[];
  maxLength?: number;
  pattern?: RegExp;
};

export type ProgramMeta = {
  color: string;
  soft: string;
  label: string;
  dot: string;
};

export const PROGRAM_META: Record<string, ProgramMeta> = {
  eGovPH:        { color: "#3B82F6", soft: "#DBEAFE", label: "eGovPH",        dot: "🔵" },
  eLGU:          { color: "#10B981", soft: "#D1FAE5", label: "eLGU",          dot: "🟢" },
  "Free WiFi":   { color: "#8B5CF6", soft: "#EDE9FE", label: "Free WiFi",     dot: "🟣" },
  GovNet:        { color: "#F59E0B", soft: "#FEF3C7", label: "GovNet",        dot: "🟡" },
  NBP:           { color: "#EF4444", soft: "#FEE2E2", label: "NBP",           dot: "🔴" },
  Cybersecurity: { color: "#F97316", soft: "#FFEDD5", label: "Cybersecurity", dot: "🟠" },
  PNPKI:         { color: "#6366F1", soft: "#E0E7FF", label: "PNPKI",         dot: "🔵" },
  DRRM:          { color: "#EAB308", soft: "#FEF9C3", label: "DRRM",          dot: "🟡" },
  ILCDB:         { color: "#22C55E", soft: "#DCFCE7", label: "ILCDB",         dot: "🟢" },
  IIDB:          { color: "#A855F7", soft: "#F3E8FF", label: "IIDB",          dot: "🟣" },
};

export const PROGRAM_LIST = Object.keys(PROGRAM_META);

export const PROGRAM_SCHEMAS: Record<string, FieldDef[]> = {
  eGovPH: [
    { key: "activityTitle", label: "Activity Title",      required: true,  type: "text" },
    { key: "date",          label: "Date",                required: true,  type: "date" },
    { key: "venue",         label: "Venue",               required: true,  type: "text" },
    { key: "region",        label: "Region",              required: true,  type: "text" },
    { key: "province",      label: "Province",            required: false, type: "text" },
    { key: "municipality",  label: "Municipality",        required: false, type: "text" },
    { key: "participants",  label: "No. of Participants", required: true,  type: "number" },
    { key: "male",          label: "Male",                required: false, type: "number" },
    { key: "female",        label: "Female",              required: false, type: "number" },
    { key: "remarks",       label: "Remarks",             required: false, type: "text" },
  ],
  eLGU: [
    { key: "activityTitle", label: "Activity Title", required: true,  type: "text" },
    { key: "lguName",       label: "LGU Name",       required: true,  type: "text" },
    { key: "date",          label: "Date",           required: true,  type: "date" },
    { key: "venue",         label: "Venue",          required: false, type: "text" },
    { key: "participants",  label: "Participants",   required: true,  type: "number" },
    { key: "lguLevel",      label: "LGU Level",      required: false, type: "select",
      options: ["Barangay", "Municipal", "City", "Provincial"] },
    { key: "remarks",       label: "Remarks",        required: false, type: "text" },
  ],
  "Free WiFi": [
    { key: "siteName",     label: "Site Name",         required: true,  type: "text" },
    { key: "location",     label: "Location",          required: true,  type: "text" },
    { key: "province",     label: "Province",          required: true,  type: "text" },
    { key: "municipality", label: "Municipality",      required: true,  type: "text" },
    { key: "installDate",  label: "Installation Date", required: false, type: "date" },
    { key: "status",       label: "Status",            required: true,  type: "select",
      options: ["Active", "Inactive", "For Repair", "Pending"] },
    { key: "bandwidth",    label: "Bandwidth (Mbps)",  required: false, type: "number" },
    { key: "remarks",      label: "Remarks",           required: false, type: "text" },
  ],
  GovNet: [
    { key: "agencyName",     label: "Agency Name",      required: true,  type: "text" },
    { key: "connectionType", label: "Connection Type",  required: false, type: "select",
      options: ["Fiber", "Wireless", "Satellite", "VPN"] },
    { key: "province",       label: "Province",         required: true,  type: "text" },
    { key: "municipality",   label: "Municipality",     required: false, type: "text" },
    { key: "bandwidth",      label: "Bandwidth (Mbps)", required: false, type: "number" },
    { key: "status",         label: "Status",           required: true,  type: "select",
      options: ["Connected", "Pending", "Disconnected"] },
    { key: "dateConnected",  label: "Date Connected",   required: false, type: "date" },
    { key: "remarks",        label: "Remarks",          required: false, type: "text" },
  ],
  NBP: [
    { key: "activityTitle",     label: "Activity Title",     required: true,  type: "text" },
    { key: "date",              label: "Date",               required: true,  type: "date" },
    { key: "venue",             label: "Venue",              required: true,  type: "text" },
    { key: "targetBeneficiary", label: "Target Beneficiary", required: true,  type: "text" },
    { key: "participants",      label: "Participants",       required: true,  type: "number" },
    { key: "province",          label: "Province",           required: false, type: "text" },
    { key: "remarks",           label: "Remarks",            required: false, type: "text" },
  ],
  Cybersecurity: [
    { key: "activityTitle", label: "Activity Title", required: true,  type: "text" },
    { key: "date",          label: "Date",           required: true,  type: "date" },
    { key: "venue",         label: "Venue",          required: false, type: "text" },
    { key: "targetSector",  label: "Target Sector",  required: false, type: "text" },
    { key: "participants",  label: "Participants",   required: true,  type: "number" },
    { key: "trainingType",  label: "Training Type",  required: false, type: "select",
      options: ["Awareness", "Technical", "Workshop", "Seminar"] },
    { key: "remarks",       label: "Remarks",        required: false, type: "text" },
  ],
  PNPKI: [
    { key: "activityTitle",       label: "Activity Title",       required: true,  type: "text" },
    { key: "date",                label: "Date",                 required: true,  type: "date" },
    { key: "agency",              label: "Agency",               required: true,  type: "text" },
    { key: "certificatesIssued",  label: "Certificates Issued",  required: false, type: "number" },
    { key: "participants",        label: "Participants",         required: true,  type: "number" },
    { key: "remarks",             label: "Remarks",              required: false, type: "text" },
  ],
  DRRM: [
    { key: "activityTitle", label: "Activity Title",      required: true,  type: "text" },
    { key: "date",          label: "Date",                required: true,  type: "date" },
    { key: "province",      label: "Province",            required: true,  type: "text" },
    { key: "municipality",  label: "Municipality",        required: false, type: "text" },
    { key: "targetAgency",  label: "Target Agency",       required: false, type: "text" },
    { key: "participants",  label: "Participants",        required: true,  type: "number" },
    { key: "disasterType",  label: "Disaster Type Focus", required: false, type: "text" },
    { key: "remarks",       label: "Remarks",             required: false, type: "text" },
  ],
  ILCDB: [
    { key: "activityTitle",    label: "Activity Title",    required: true,  type: "text" },
    { key: "trainingProgram",  label: "Training Program",  required: true,  type: "select",
      options: ["SPARK", "DWIA", "Project CLICK", "Tech4ED", "Other"] },
    { key: "date",             label: "Date",              required: true,  type: "date" },
    { key: "venue",            label: "Venue",             required: true,  type: "text" },
    { key: "province",         label: "Province",          required: false, type: "text" },
    { key: "municipality",     label: "Municipality",      required: false, type: "text" },
    { key: "participants",     label: "Participants",      required: true,  type: "number" },
    { key: "male",             label: "Male",              required: false, type: "number" },
    { key: "female",           label: "Female",            required: false, type: "number" },
    { key: "sector",           label: "Sector",            required: false, type: "text" },
    { key: "remarks",          label: "Remarks",           required: false, type: "text" },
  ],
  IIDB: [
    { key: "activityTitle",   label: "Activity Title",   required: true,  type: "text" },
    { key: "date",            label: "Date",             required: true,  type: "date" },
    { key: "venue",           label: "Venue",            required: false, type: "text" },
    { key: "industryPartner", label: "Industry Partner", required: false, type: "text" },
    { key: "participants",    label: "Participants",     required: true,  type: "number" },
    { key: "projectType",     label: "Project Type",     required: false, type: "text" },
    { key: "remarks",         label: "Remarks",          required: false, type: "text" },
  ],
};

// Key fields used to build the duplicate fingerprint per program
export const DEDUP_KEYS: Record<string, string[]> = {
  eGovPH:        ["activityTitle", "date", "venue"],
  eLGU:          ["activityTitle", "date", "lguName"],
  "Free WiFi":   ["siteName", "municipality", "province"],
  GovNet:        ["agencyName", "municipality"],
  NBP:           ["activityTitle", "date", "venue"],
  Cybersecurity: ["activityTitle", "date"],
  PNPKI:         ["activityTitle", "date", "agency"],
  DRRM:          ["activityTitle", "date", "municipality"],
  ILCDB:         ["activityTitle", "date", "venue", "trainingProgram"],
  IIDB:          ["activityTitle", "date"],
};
