/**
 * Deployment-configurable org/branding strings for LearnHub.
 *
 * LearnHub ships configured for DICT Region V (ILCDB), but the codebase
 * should also serve other orgs. Every UI surface that wants to say "DICT
 * Region V", "ILCDB LearnHub", or list program names (SPARK/DWIA/etc.)
 * reads from this module instead of hardcoding the strings.
 *
 * Override per-deployment by setting the corresponding NEXT_PUBLIC_*
 * env vars in .env.local (or your hosting platform's env config).
 *
 * Note: this file is intentionally pure — no React, no Convex — so it
 * can be imported from server-side Convex functions and client components
 * alike.
 */

function envOr(key: string, fallback: string): string {
  const v = (process.env as Record<string, string | undefined>)[key];
  return v && v.trim().length > 0 ? v : fallback;
}

const programsRaw = envOr(
  "NEXT_PUBLIC_LEARNHUB_PROGRAMS",
  "SPARK,DWIA,Project CLICK,Tech4ED,EGOV"
);

const programs = programsRaw
  .split(",")
  .map((p) => p.trim())
  .filter((p) => p.length > 0);

/**
 * Default color palette for program chips/badges. Keyed by program name
 * (case-insensitive lookup via PROGRAM_COLORS[name] or programColor()).
 * Carried over from app/learnhub/(lh-main)/certificates/page.tsx so the
 * visual identity stays consistent after the refactor.
 */
const DEFAULT_PROGRAM_COLORS: Record<string, string> = {
  SPARK: "#5b6cff",
  DWIA: "#22d3a0",
  "Project CLICK": "#ff8c42",
  Tech4ED: "#ff5f6d",
  EGOV: "#1a56db",
  "eGov PH": "#1a56db",
};

export const ORG_CONFIG = Object.freeze({
  /** Full org name, e.g. "DICT Region V" — used in page titles/headers. */
  orgName: envOr("NEXT_PUBLIC_LEARNHUB_ORG_NAME", "DICT Region V"),
  /** Short org name, e.g. "DICT" — used in compact labels and chips. */
  orgShort: envOr("NEXT_PUBLIC_LEARNHUB_ORG_SHORT", "DICT"),
  /** Product/brand name, e.g. "LearnHub" or "ILCDB LearnHub". */
  productName: envOr("NEXT_PUBLIC_LEARNHUB_PRODUCT_NAME", "ILCDB LearnHub"),
  /** Region/locale label, e.g. "Region V". */
  regionName: envOr("NEXT_PUBLIC_LEARNHUB_REGION", "Region V"),
  /** What we call the people who can verify mentors in this deployment. */
  mentorAuthorityLabel: envOr(
    "NEXT_PUBLIC_LEARNHUB_MENTOR_AUTHORITY",
    "coordinators"
  ),
  /** One-line marketing tagline shown on landing/feed headers. */
  tagline: envOr(
    "NEXT_PUBLIC_LEARNHUB_TAGLINE",
    "Learn together. Apply what you learn."
  ),
  /** Program/cohort names this deployment recognizes. Drives chips/filters. */
  programs,
  /** Color per program name. */
  programColors: DEFAULT_PROGRAM_COLORS,
});

export type OrgConfig = typeof ORG_CONFIG;

/** Convenience: color for a given program name, falling back to a neutral gray. */
export function programColor(name: string): string {
  return ORG_CONFIG.programColors[name] ?? "#6b7280";
}

/** Convenience: compact header line, e.g. "DICT REGION V". */
export function orgHeadlineLabel(): string {
  return `${ORG_CONFIG.orgShort} ${ORG_CONFIG.regionName}`.toUpperCase();
}
