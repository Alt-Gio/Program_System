/**
 * Pure XP → level derivation. No DB writes — level is always derived from
 * `user.xpPoints` so it stays consistent across surfaces.
 *
 * Curve: gentle past Lv 20 so progression has narrative weight. Names per
 * bracket (Apprentice / Journeyman / Practitioner / Master) so the
 * level pill reads as an honorific, not just a number.
 *
 * Tunable: edit BREAKPOINTS to reshape the curve.
 */

// XP threshold at the *start* of each level. Lv 1 = 0, Lv 2 = 100, etc.
// After Lv 20 the curve flattens — high levels are slow to reach.
const BREAKPOINTS: number[] = [
  0,      // Lv 1
  100,    // Lv 2
  250,    // Lv 3
  450,    // Lv 4
  700,    // Lv 5
  1000,   // Lv 6
  1400,   // Lv 7
  1900,   // Lv 8
  2500,   // Lv 9
  3200,   // Lv 10
  4000,   // Lv 11
  4900,   // Lv 12
  5900,   // Lv 13
  7000,   // Lv 14
  8200,   // Lv 15
  9500,   // Lv 16
  10900,  // Lv 17
  12400,  // Lv 18
  14000,  // Lv 19
  16000,  // Lv 20
];

// Past Lv 20, each level costs +1500 XP more than the previous bracket gap.
function thresholdForLevel(level: number): number {
  if (level <= BREAKPOINTS.length) return BREAKPOINTS[level - 1];
  const stepsAbove20 = level - 20;
  return BREAKPOINTS[BREAKPOINTS.length - 1] + stepsAbove20 * 2500;
}

export interface LevelInfo {
  level: number;
  /** XP earned within the current level. */
  current: number;
  /** XP required to reach the next level (delta from current level threshold). */
  next: number;
  /** Percent toward the next level, 0..100. */
  pct: number;
  /** Honorific bracket title for this level. */
  bracket: "Apprentice" | "Journeyman" | "Practitioner" | "Master";
}

export function levelFromXp(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  // Find the highest level whose threshold is <= safeXp. Cap at Lv 50.
  let level = 1;
  for (let l = 1; l <= 50; l++) {
    if (thresholdForLevel(l) <= safeXp) level = l;
    else break;
  }
  const thisFloor = thresholdForLevel(level);
  const nextFloor = thresholdForLevel(level + 1);
  const next = Math.max(1, nextFloor - thisFloor);
  const current = safeXp - thisFloor;
  const pct = level >= 50 ? 100 : Math.min(100, Math.round((current / next) * 100));
  const bracket = bracketFor(level);
  return { level, current, next, pct, bracket };
}

function bracketFor(level: number): LevelInfo["bracket"] {
  if (level <= 5) return "Apprentice";
  if (level <= 15) return "Journeyman";
  if (level <= 30) return "Practitioner";
  return "Master";
}

/**
 * Returns true when `prevXp → nextXp` crossed a level boundary. Used by
 * mutations that award XP to decide whether to fire a `level_up` notif.
 */
export function crossedLevelBoundary(prevXp: number, nextXp: number): {
  crossed: boolean;
  newLevel: number;
} {
  const before = levelFromXp(prevXp).level;
  const after = levelFromXp(nextXp).level;
  return { crossed: after > before, newLevel: after };
}
