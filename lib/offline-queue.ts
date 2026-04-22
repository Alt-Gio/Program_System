/**
 * Shared offline-queue primitives for public DTC PWA pages.
 *
 * Happy path: the service worker intercepts the POST, queues to IDB
 * on network failure, and replays via Background Sync.
 *
 * This module is the client-side fallback for:
 *   - browsers without SW support
 *   - the first visit before the SW is controlling the page
 *   - manual "Sync now" retries driven from the UI
 *
 * Separate object stores per endpoint keep page queues isolated.
 */

const DB_NAME = "dtc-offline";
const DB_VERSION = 3;

export type QueueStore =
  | "meetingHallQueue"
  | "dtcLogbookQueue"
  | "internJournalQueue"
  | "internHabitsQueue"
  | "internCheckinQueue";
const STORES: QueueStore[] = [
  "meetingHallQueue",
  "dtcLogbookQueue",
  "internJournalQueue",
  "internHabitsQueue",
  "internCheckinQueue",
];

export type QueuedRecord<P = any> = {
  clientId: string;
  payload: P;
  queuedAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "clientId" });
        }
      }
      // Legacy v1 store — preserve existing queued records across upgrade.
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "clientId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue<P extends { clientId: string }>(
  store: QueueStore,
  payload: P
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put({
      clientId: payload.clientId,
      payload: { ...payload, submittedOffline: true },
      queuedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueued<P = any>(
  store: QueueStore
): Promise<QueuedRecord<P>[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result || []) as QueuedRecord<P>[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueued(
  store: QueueStore,
  clientId: string
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countQueued(store: QueueStore): Promise<number> {
  try {
    return (await listQueued(store)).length;
  } catch {
    return 0;
  }
}

/**
 * Drain one queue by POSTing each payload back to its endpoint.
 * Successes and permanent (4xx) failures are evicted from the store.
 */
export async function drainQueue(
  store: QueueStore,
  endpoint: string
): Promise<{ sent: number; remaining: number }> {
  const items = await listQueued(store);
  let sent = 0;
  for (const item of items) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await removeQueued(store, item.clientId);
        sent += 1;
      } else if (res.status >= 400 && res.status < 500) {
        await removeQueued(store, item.clientId);
      }
    } catch {
      // still offline — try again later
    }
  }
  const remaining = (await listQueued(store)).length;
  return { sent, remaining };
}

/** Ask the SW (if any) to drain both queues. No-op when there's no SW. */
export function requestSwDrain(): void {
  if (typeof navigator === "undefined") return;
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "dtc-drain" });
  }
}

export function generateClientId(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
