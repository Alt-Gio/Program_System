/**
 * Cross-subsystem achievement badge catalogue.
 *
 * The badge definitions live in `lib/` so both client UI (profile pages,
 * celebratory toast) and the server-side awarder (`convex/learnhub_badges.ts`)
 * read the same source of truth for name/emoji/description.
 *
 * Criteria are implemented server-side in convex/learnhub_badges.ts because
 * they need DB access (xp_events count, mentorship status, etc.).
 */

export interface BadgeDefinition {
  key: string;
  name: string;
  emoji: string;
  description: string;
  /** Short hint shown to learners who haven't earned it yet. */
  hint: string;
}

export const BADGES: BadgeDefinition[] = [
  {
    key: "first_steps",
    name: "First Steps",
    emoji: "🏁",
    description: "Started your learning journey.",
    hint: "Awarded on signup.",
  },
  {
    key: "polymath",
    name: "Polymath",
    emoji: "🦉",
    description: "Curious across four or more disciplines.",
    hint: "Pick interests spanning 4+ categories on your profile.",
  },
  {
    key: "mentor_magnet",
    name: "Mentor Magnet",
    emoji: "🧲",
    description: "Three or more accepted mentorships.",
    hint: "Get accepted by at least three mentors.",
  },
  {
    key: "knowledge_builder",
    name: "Knowledge Builder",
    emoji: "🧱",
    description: "Reviewed fifty flashcards.",
    hint: "Spaced repetition compounds — keep reviewing.",
  },
  {
    key: "streak_keeper",
    name: "Streak Keeper",
    emoji: "🔥",
    description: "A learning streak of fourteen days.",
    hint: "Show up daily for two weeks.",
  },
  {
    key: "renaissance_learner",
    name: "Renaissance Learner",
    emoji: "🎨",
    description: "Certificates across three or more programs.",
    hint: "Earn certificates in three different program types.",
  },
];

export const BADGE_BY_KEY: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGES.map((b) => [b.key, b]),
);
