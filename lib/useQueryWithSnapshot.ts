/**
 * useQueryWithSnapshot — Convex useQuery + localStorage snapshot.
 *
 * Convex's useQuery is online-only: while offline, it returns undefined
 * forever. For pages that need to render offline, we mirror every
 * successful read into localStorage under a stable key, and hydrate from
 * that snapshot on mount so the UI has data to work with until Convex
 * reconnects.
 *
 * Usage:
 *   const data = useQueryWithSnapshot(
 *     api.foo.bar,
 *     token ? { token } : "skip",
 *     `foo:bar:${tokenHash}`,
 *   );
 *
 * The returned value has the same type as useQuery's return and behaves
 * identically online. Offline, `data` will be the last snapshot value
 * instead of `undefined` (or null when no snapshot exists).
 */

import { useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { loadSnapshot, saveSnapshot } from "./dtc-logbook-cache";

export function useQueryWithSnapshot<
  Q extends FunctionReference<"query">
>(
  query: Q,
  args: Q["_args"] | "skip",
  snapshotKey: string | null,
): Q["_returnType"] | undefined {
  const live = useQuery(query, args as any) as Q["_returnType"] | undefined;

  const hydrated = useMemo(() => {
    if (!snapshotKey) return undefined;
    return loadSnapshot<Q["_returnType"]>(snapshotKey) ?? undefined;
  }, [snapshotKey]);

  useEffect(() => {
    if (!snapshotKey) return;
    if (live === undefined) return;
    saveSnapshot(snapshotKey, live);
  }, [live, snapshotKey]);

  return live ?? hydrated;
}
