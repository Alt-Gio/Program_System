"use client";

import { useEffect, useState } from "react";
import { WifiOff, CloudUpload } from "lucide-react";
import {
  countQueued,
  drainQueue,
  requestSwDrain,
  type QueueStore,
} from "@/lib/offline-queue";

type StoreEndpoint = { store: QueueStore; endpoint: string };

/**
 * Small connectivity strip for authenticated PWA pages (intern, supervisor).
 * - Shows "You're offline" when navigator.onLine is false.
 * - Shows pending-queue count when there are saved writes waiting to sync.
 * - Exposes a "Sync now" button that nudges the SW + runs a fallback drain.
 *
 * Renders nothing when online AND no queued records.
 */
export default function OfflineBanner({ stores }: { stores: StoreEndpoint[] }) {
  const [isOnline, setIsOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  async function recount() {
    let total = 0;
    for (const { store } of stores) total += await countQueued(store);
    setQueued(total);
  }

  async function drainAll() {
    requestSwDrain();
    for (const { store, endpoint } of stores) {
      try {
        await drainQueue(store, endpoint);
      } catch {}
    }
    recount();
  }

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsOnline(navigator.onLine);
    recount();

    const onOnline = () => {
      setIsOnline(true);
      drainAll();
    };
    const onOffline = () => setIsOnline(false);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "dtc-sync-result") recount();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onMsg);
    }
    const poll = setInterval(recount, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onMsg);
      }
      clearInterval(poll);
    };

  }, []);

  if (isOnline && queued === 0) return null;

  return (
    <div
      className={cnLocal(
        "px-4 py-2 text-xs flex items-center gap-2 border-b",
        !isOnline
          ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
          : "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
      )}
    >
      {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <CloudUpload className="w-3.5 h-3.5" />}
      <span className="flex-1">
        {!isOnline && queued === 0 && "You're offline. Changes will save locally."}
        {!isOnline && queued > 0 &&
          `Offline — ${queued} change${queued === 1 ? "" : "s"} waiting to sync.`}
        {isOnline && queued > 0 &&
          `Syncing ${queued} change${queued === 1 ? "" : "s"}…`}
      </span>
      {isOnline && queued > 0 && (
        <button onClick={drainAll} className="font-semibold underline">
          Sync now
        </button>
      )}
    </div>
  );
}

function cnLocal(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
