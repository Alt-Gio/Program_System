/**
 * Snapshot cache for /dtc-logbook public reads.
 *
 * The logbook uses Convex useQuery() for settings / pcs / announcements,
 * which is online-only. We keep the last successful snapshot in
 * localStorage so the page can still render (and allow form fill-out)
 * while offline. When the device comes back online and Convex re-
 * connects, useQuery re-hydrates and overwrites the snapshot.
 */

const KEY_PREFIX = "dtc-logbook-snap:";
const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — tolerant of stale reads

type Snapshot<T> = { at: number; value: T };

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveSnapshot<T>(key: string, value: T): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    const payload: Snapshot<T> = { at: Date.now(), value };
    ls.setItem(KEY_PREFIX + key, JSON.stringify(payload));
  } catch {
    // quota or JSON errors — snapshot is best-effort
  }
}

export function loadSnapshot<T>(key: string): T | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > SNAPSHOT_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}
