/**
 * Shared interest taxonomy + hashtag helpers.
 *
 * The same vocabulary that learners pick from in onboarding (`interests`
 * on `learnhub_users`) is also the dictionary against which post `#hashtags`
 * are matched for feed ranking. Keeping both in one file means a new
 * interest is added in one place and immediately drives both onboarding
 * and feed ranking.
 *
 * The taxonomy is intentionally broad (covering health, business, design,
 * sciences, humanities, trades, life skills, in addition to tech) so the
 * hub serves learners from any discipline. Users can also store custom
 * free-form tags on `learnhub_users.interests` — these coexist with the
 * curated taxonomy because the feed scorer matches by normalized string.
 *
 * Hashtags are stored normalized (lowercased, no leading `#`, kebab-or-snake
 * only) so callers can use them as dictionary keys without re-normalizing.
 */

/**
 * Grouped taxonomy. The order here drives the order shown in the onboarding
 * wizard and the settings page. Keep groups domain-coherent so users can
 * scan quickly.
 */
export const INTEREST_CATEGORIES = {
  "Tech & Digital": [
    "Digital Literacy",
    "Web Dev",
    "Mobile Dev",
    "Data Analysis",
    "Cybersecurity",
    "AI & ML",
    "UI/UX Design",
    "Cloud & DevOps",
  ],
  "Health & Care": [
    "Nursing",
    "Public Health",
    "Mental Health",
    "Nutrition",
    "First Aid",
  ],
  "Business & Finance": [
    "Entrepreneurship",
    "Marketing",
    "Accounting",
    "Project Management",
    "Leadership",
  ],
  "Arts & Design": [
    "Graphic Design",
    "Photography",
    "Music",
    "Writing",
    "Video Production",
  ],
  Sciences: [
    "Math",
    "Physics",
    "Chemistry",
    "Biology",
    "Environmental Science",
  ],
  Humanities: ["History", "Languages", "Public Speaking", "Philosophy"],
  "Trades & Practical": [
    "Carpentry",
    "Electrical",
    "Plumbing",
    "Agriculture",
    "Culinary",
  ],
  "Life Skills": ["Communication", "Critical Thinking", "Career Pivot"],
} as const;

export type InterestCategory = keyof typeof INTEREST_CATEGORIES;

/**
 * Flat list of every curated tag, derived from INTEREST_CATEGORIES.
 * Kept as an explicit export (rather than computed) so TypeScript can
 * type `Interest` as a literal union, which keeps existing consumers
 * (feed scorer, post composer) honest at compile time.
 */
export const INTEREST_TAXONOMY = [
  // Tech & Digital
  "Digital Literacy",
  "Web Dev",
  "Mobile Dev",
  "Data Analysis",
  "Cybersecurity",
  "AI & ML",
  "UI/UX Design",
  "Cloud & DevOps",
  // Health & Care
  "Nursing",
  "Public Health",
  "Mental Health",
  "Nutrition",
  "First Aid",
  // Business & Finance
  "Entrepreneurship",
  "Marketing",
  "Accounting",
  "Project Management",
  "Leadership",
  // Arts & Design
  "Graphic Design",
  "Photography",
  "Music",
  "Writing",
  "Video Production",
  // Sciences
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "Environmental Science",
  // Humanities
  "History",
  "Languages",
  "Public Speaking",
  "Philosophy",
  // Trades & Practical
  "Carpentry",
  "Electrical",
  "Plumbing",
  "Agriculture",
  "Culinary",
  // Life Skills
  "Communication",
  "Critical Thinking",
  "Career Pivot",
] as const;

export type Interest = (typeof INTEREST_TAXONOMY)[number];

/**
 * Given a tag string (from the curated taxonomy OR a user's custom tag),
 * return the category it belongs to. Returns null for custom tags so the
 * UI can render them under a "Custom" bucket.
 */
export function categoryFor(tag: string): InterestCategory | null {
  for (const [cat, tags] of Object.entries(INTEREST_CATEGORIES) as [
    InterestCategory,
    readonly string[],
  ][]) {
    if (tags.includes(tag)) return cat;
  }
  return null;
}

// ASCII-only on purpose — the storage layer normalizes to [a-z0-9_] anyway
// and the project's tsconfig target rejects the unicode regex flag.
const HASHTAG_TOKEN = /#([a-zA-Z0-9_]+)/g;

/**
 * Normalize a single hashtag fragment: strip leading `#`, drop characters
 * outside [a-z0-9_], lowercase. Empty string if nothing usable remained.
 */
export function normalizeHashtag(input: string): string {
  if (!input) return "";
  const stripped = input.trim().replace(/^#+/, "").toLowerCase();
  return stripped.replace(/[^a-z0-9_]/g, "");
}

/**
 * Normalize an interest string for matching against hashtags / other
 * interests. Same shape as `normalizeHashtag` — exposed under a clearer
 * name for non-hashtag call sites.
 */
export function normalizeInterest(input: string): string {
  return normalizeHashtag(input);
}

/**
 * Find all `#tokens` in a string and return their normalized forms in the
 * order they appeared, deduped. Used both client-side (composer preview) and
 * server-side (createPost) so the canonical list never disagrees.
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  HASHTAG_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HASHTAG_TOKEN.exec(text)) !== null) {
    const tag = normalizeHashtag(m[1]);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

/**
 * True if a viewer's interest (from `INTEREST_TAXONOMY`, free-form casing)
 * resolves to the same normalized form as the post hashtag. Both sides go
 * through `normalizeHashtag` so "AI & ML" vs "#aiml" still matches "aiml".
 */
export function interestMatchesHashtag(interest: string, hashtag: string): boolean {
  return normalizeHashtag(interest) === normalizeHashtag(hashtag);
}

/**
 * Convenience: given an interest name from the taxonomy, what hashtag form
 * would the composer suggest? Used to pre-populate suggestion lists.
 */
export function suggestionFromInterest(interest: string): string {
  return normalizeHashtag(interest);
}
