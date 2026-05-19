/**
 * Shared interest taxonomy + hashtag helpers.
 *
 * The same vocabulary that learners pick from in onboarding (`interests`
 * on `learnhub_users`) is also the dictionary against which post `#hashtags`
 * are matched for feed ranking. Keeping both in one file means a new
 * interest is added in one place and immediately drives both onboarding
 * and feed ranking.
 *
 * Hashtags are stored normalized (lowercased, no leading `#`, kebab-or-snake
 * only) so callers can use them as dictionary keys without re-normalizing.
 */

export const INTEREST_TAXONOMY = [
  "Digital Literacy",
  "Python",
  "Data Analysis",
  "Web Dev",
  "Cybersecurity",
  "Project Management",
  "Communication",
  "Career Pivot",
  "AI & ML",
  "UI/UX Design",
  "Public Speaking",
  "Entrepreneurship",
] as const;

export type Interest = (typeof INTEREST_TAXONOMY)[number];

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
