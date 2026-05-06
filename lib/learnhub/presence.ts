"use client";

import { useMemo } from "react";

/**
 * LearnHub presence — MOCK hook.
 *
 * Returns a deterministic subset of `userIds` that are pretended to
 * be "online" for UI development while the real Convex-backed
 * presence system is built.
 *
 * Design intent (next milestone — when OnlinePresence lands):
 *
 *   1. Add a Convex table `learnhub_presence` with fields:
 *        userId:     Id<"learnhub_users">  (indexed, unique)
 *        lastSeenAt: number                 (ms timestamp)
 *        status:     "online" | "away" | "busy" | "invisible"
 *
 *   2. Add `convex/learnhub_presence.ts` with:
 *        - heartbeat(userId, status) — upsert lastSeenAt = Date.now()
 *        - listOnline({ windowMs? = 180_000 }) — returns users whose
 *          lastSeenAt is within the heartbeat window AND whose
 *          role is "mentor" or "student" (org_partner and admin are
 *          EXCLUDED — explicit domain policy).
 *
 *   3. Fire a heartbeat from a top-level client hook once per 60s
 *      while the tab is visible, honoring the user's chosen status
 *      ("invisible" writes lastSeenAt = 0 so the user never appears
 *      online to anyone else, even themselves in listOnline).
 *
 *   4. Replace this mock's body with:
 *        const online = useQuery(api.learnhub_presence.listOnline, {});
 *        return new Set((online ?? []).map(u => u._id));
 *
 * This file's public signature is intentionally minimal so the
 * switch-over stays a single-file change.
 */
export function usePresenceMock(userIds: string[]): Set<string> {
  // Memo key is the joined id list — stable across re-renders when
  // the surrounding query result is referentially different but
  // contains the same users.
  const key = userIds.join("|");
  return useMemo(() => {
    const set = new Set<string>();
    for (const id of userIds) {
      // Deterministic bucket: ~2/3 of users appear "online" so the
      // UI always has a populated list for review.
      const hash = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0);
      if (hash % 3 !== 0) set.add(id);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
