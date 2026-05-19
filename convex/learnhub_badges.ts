/**
 * Cross-subsystem badge awarding engine.
 *
 * `evaluateAndAward` walks the badge catalogue, runs each criterion against
 * the user's current state, and pushes any newly-met badge onto
 * `learnhub_users.badges`. Criteria are bounded constant-time-ish lookups
 * (single index range scan or `.first()`) so this is safe to call from
 * terminal-action mutations like `respondToMentorshipRequest`,
 * `reviewFlashcard`, `awardLearnHubXp`, etc.
 *
 * Badges are stored as their display string ("🏁 First Steps") so existing
 * seed data and the leaderboard surface keep working unchanged.
 */

import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { INTEREST_CATEGORIES } from "../lib/learnhub/interests";
import { BADGES } from "../lib/learnhub/badges";

function badgeDisplay(key: string): string {
  const b = BADGES.find((x) => x.key === key);
  return b ? `${b.emoji} ${b.name}` : key;
}

function hasBadge(user: Doc<"learnhub_users">, key: string): boolean {
  const display = badgeDisplay(key);
  return user.badges.includes(display);
}

// Each criterion returns true if the badge should now be awarded.
// Criteria are run against the latest user state (refetched inside the
// mutation handler) and the live DB.
type Criterion = (
  ctx: MutationCtx,
  user: Doc<"learnhub_users">,
) => Promise<boolean>;

const CRITERIA: Record<string, Criterion> = {
  first_steps: async (_ctx, _user) => true, // Seeded on signup; safe idempotent re-award.

  polymath: async (_ctx, user) => {
    const tags = user.interests ?? [];
    if (tags.length < 4) return false;
    const cats = new Set<string>();
    for (const t of tags) {
      for (const [cat, members] of Object.entries(INTEREST_CATEGORIES)) {
        if ((members as readonly string[]).includes(t)) {
          cats.add(cat);
          break;
        }
      }
    }
    return cats.size >= 4;
  },

  mentor_magnet: async (ctx, user) => {
    const rels = await ctx.db
      .query("learnhub_mentoring_relationships")
      .withIndex("by_mentee", (q) => q.eq("menteeId", user._id))
      .collect();
    const accepted = rels.filter(
      (r) => r.status === "active" || r.status === "completed",
    ).length;
    return accepted >= 3;
  },

  knowledge_builder: async (ctx, user) => {
    const events = await ctx.db
      .query("learnhub_xp_events")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const reviewCount = events.filter(
      (e) => e.sourceType === "flashcard_review",
    ).length;
    return reviewCount >= 50;
  },

  streak_keeper: async (_ctx, user) => {
    return (user.currentStreak ?? 0) >= 14;
  },

  renaissance_learner: async (ctx, user) => {
    const certs = await ctx.db
      .query("learnhub_certificates")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
    const programs = new Set(certs.map((c) => c.programType));
    return programs.size >= 3;
  },
};

export async function evaluateAndAwardForUser(
  ctx: MutationCtx,
  userId: Id<"learnhub_users">,
): Promise<string[]> {
  const user = await ctx.db.get(userId);
  if (!user) return [];

  const awarded: string[] = [];
  for (const def of BADGES) {
    if (hasBadge(user, def.key)) continue;
    const criterion = CRITERIA[def.key];
    if (!criterion) continue;
    try {
      const ok = await criterion(ctx, user);
      if (ok) awarded.push(badgeDisplay(def.key));
    } catch (err) {
      console.warn(`[badges] criterion ${def.key} failed:`, err);
    }
  }

  if (awarded.length > 0) {
    await ctx.db.patch(userId, {
      badges: [...user.badges, ...awarded],
    });
  }
  return awarded;
}

// Public wrapper so client code can call evaluation explicitly (e.g. after
// the user edits interests on /settings) without waiting for the next
// terminal action to trigger it.
export const evaluateAndAward = mutation({
  args: { userId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    return await evaluateAndAwardForUser(ctx, args.userId);
  },
});
