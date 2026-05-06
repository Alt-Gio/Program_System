// Role metadata shared across the login carousel, overlay, and callback pages.
// The hue values are oklch so per-role washes stay perceptually matched.

export type RoleKey = "student" | "mentor" | "intern" | "supervisor" | "admin" | "manager";

export type AuthType = "google" | "password";

export interface RoleMeta {
  key: RoleKey;
  label: string;           // "STUDENT PORTAL"
  short: string;           // "Student"
  headline: string;        // "Learn at your"
  headlineAccent: string;  // "pace"
  description: string;
  icon: "book" | "compass" | "sprout" | "shield" | "lock" | "sitemap";
  hue: string;             // oklch - used for the panel wash + accents
  soft: string;            // rgba for soft backgrounds
  authType: AuthType;
  landing: string;
  oauthUrl?: string;       // only when different from /api/auth/google
  hidden?: boolean;        // admin/manager hidden until unlocked
}

export const ROLES: Record<RoleKey, RoleMeta> = {
  student: {
    key: "student",
    label: "STUDENT PORTAL",
    short: "Student",
    headline: "Learn at your",
    headlineAccent: "pace",
    description: "Access courses, earn certificates, join the DICT-V learning community.",
    icon: "book",
    hue: "oklch(72% 0.18 40)",
    soft: "rgba(249, 115, 22, 0.12)",
    authType: "google",
    landing: "/learnhub/feed",
    oauthUrl: "/api/learnhub/auth/google",
  },
  mentor: {
    key: "mentor",
    label: "MENTOR PORTAL",
    short: "Mentor",
    headline: "Guide the next",
    headlineAccent: "generation",
    description: "Create courses, host webinars, and mentor learners across Region V.",
    icon: "compass",
    hue: "oklch(70% 0.17 255)",
    soft: "rgba(91, 108, 255, 0.12)",
    authType: "google",
    landing: "/learnhub/feed",
    oauthUrl: "/api/learnhub/auth/google",
  },
  intern: {
    key: "intern",
    label: "INTERN PORTAL",
    short: "Intern",
    headline: "Begin your",
    headlineAccent: "journey",
    description: "Submit reports, track hours, and grow within an accredited program.",
    icon: "sprout",
    hue: "oklch(72% 0.17 160)",
    soft: "rgba(16, 185, 129, 0.12)",
    authType: "google",
    landing: "/intern-portal",
  },
  supervisor: {
    key: "supervisor",
    label: "SUPERVISOR PORTAL",
    short: "Supervisor",
    headline: "Oversee field",
    headlineAccent: "operations",
    description: "Approve interns, validate hours, and certify program completion.",
    icon: "shield",
    hue: "oklch(72% 0.14 210)",
    soft: "rgba(14, 165, 233, 0.12)",
    authType: "google",
    landing: "/supervisor",
  },
  admin: {
    key: "admin",
    label: "ADMIN PORTAL",
    short: "Admin",
    headline: "Restricted",
    headlineAccent: "access",
    description: "System-level controls. Credentials issued by DICT-V Information Office.",
    icon: "lock",
    hue: "oklch(66% 0.22 10)",
    soft: "rgba(244, 63, 94, 0.12)",
    authType: "password",
    landing: "/dtc-admin",
    hidden: true,
  },
  manager: {
    key: "manager",
    label: "MANAGER PORTAL",
    short: "Manager",
    headline: "Operations",
    headlineAccent: "console",
    description: "Program oversight, reporting, and inter-agency coordination.",
    icon: "sitemap",
    hue: "oklch(72% 0.15 230)",
    soft: "rgba(59, 130, 246, 0.12)",
    authType: "password",
    landing: "/dashboard",
    hidden: true,
  },
};

export const SLIDES: Array<{
  id: string;
  label: string;
  subLabel: string;
  left: RoleKey;
  right: RoleKey;
  classified?: boolean;
}> = [
  { id: "public",    label: "PUBLIC PORTALS",   subLabel: "Learners & Educators",     left: "student", right: "mentor"     },
  { id: "field",     label: "FIELD OPERATIONS", subLabel: "Programs & Mentorship",    left: "intern",  right: "supervisor" },
  { id: "system",    label: "SYSTEM ACCESS",    subLabel: "Authorized Personnel Only", left: "admin",   right: "manager",    classified: true },
];
