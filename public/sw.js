/* DTC Region V — Public PWA Service Worker
 * -----------------------------------------------------------
 * Responsibilities:
 *   1. Offline shells for /meeting-hall and /dtc-logbook
 *      (install-time cache + runtime SWR for static assets).
 *   2. Offline-tolerant POST for the two public submit endpoints
 *      (/api/meeting-hall/bookings, /api/dtc-logbook/log):
 *      when the network fails we stash the request in IndexedDB
 *      and return a synthetic 202 { queued: true } response.
 *   3. Background Sync drains both queues when connectivity
 *      returns. Browsers without Background Sync fall back to
 *      a client-side drain (see lib/offline-queue.ts).
 * ----------------------------------------------------------- */

const CACHE_VERSION = "dtc-pwa-v3";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const SHELL_URLS = [
  "/meeting-hall",
  "/dtc-logbook",
  "/intern/dashboard",
  "/intern/tasks",
  "/intern/habits",
  "/intern/journal",
  "/intern/messages",
  "/intern/qr",
  "/intern/qr-checkin",
  "/supervisor/dashboard",
  "/manifest.json",
  "/icons/dtc-icon.svg",
  "/icons/dtc-maskable.svg",
];

// One sync tag handles all queues; drain walks every store.
const SYNC_TAG = "dtc-public-sync";

const DB_NAME = "dtc-offline";
const DB_VERSION = 3;

// Each offline-tolerant endpoint gets its own IDB object store so
// queues don't collide and individual drains can run in parallel.
const ENDPOINTS = [
  {
    path: "/api/meeting-hall/bookings",
    store: "meetingHallQueue",
  },
  {
    path: "/api/dtc-logbook/log",
    store: "dtcLogbookQueue",
  },
  {
    path: "/api/intern/journal/upsert",
    store: "internJournalQueue",
  },
  {
    path: "/api/intern/habits/toggle",
    store: "internHabitsQueue",
  },
  {
    path: "/api/intern/qr/checkin",
    store: "internCheckinQueue",
  },
];

function endpointFor(pathname) {
  return ENDPOINTS.find((e) => e.path === pathname) || null;
}

// --- IndexedDB helpers -------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const { store } of ENDPOINTS) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "clientId" });
        }
      }
      // Legacy single-store name from v1 — keep it around so users
      // who already have queued records don't lose them on upgrade.
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "clientId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(store, clientId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Install / Activate ------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// --- Fetch handling ----------------------------------------------------

function isPublicNavigation(pathname) {
  if (pathname === "/meeting-hall" || pathname === "/dtc-logbook") return true;
  if (pathname.startsWith("/intern/")) return true;
  if (pathname.startsWith("/supervisor/")) return true;
  return false;
}

function shellKeyFor(pathname) {
  // Cache each intern/supervisor route under its own shell key so the
  // navigation fallback can find it by pathname.
  if (pathname === "/meeting-hall" || pathname === "/dtc-logbook") return pathname;
  if (pathname.startsWith("/intern/")) return pathname;
  if (pathname.startsWith("/supervisor/")) return pathname;
  return null;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Offline-tolerant public POSTs.
  if (req.method === "POST") {
    const match = endpointFor(url.pathname);
    if (match) {
      event.respondWith(handleQueueablePost(req, match));
    }
    return;
  }

  if (req.method !== "GET") return;

  // Navigation: network-first with cached fallback (per-route shell).
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          const key = shellKeyFor(url.pathname);
          if (key) cache.put(key, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const key = shellKeyFor(url.pathname);
          const cached =
            (await cache.match(req)) ||
            (key ? await cache.match(key) : null);
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title>" +
              "<div style='font-family:system-ui;padding:40px;max-width:480px;margin:0 auto;text-align:center'>" +
              "<h1>You're offline</h1><p>Visit this page once while online and it'll be available offline afterwards.</p></div>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  // Static chunks + public assets: stale-while-revalidate.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => null);
        return cached || (await network) || new Response("", { status: 504 });
      })()
    );
  }
});

// --- Offline-tolerant POST handling ------------------------------------

async function handleQueueablePost(req, endpoint) {
  let payload;
  try {
    payload = await req.clone().json();
  } catch {
    return fetch(req);
  }

  try {
    const res = await fetch(req.clone());
    // 4xx/5xx are NOT queued — those are server errors, let the page see them.
    return res;
  } catch (_networkErr) {
    if (!payload?.clientId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing clientId; cannot queue offline",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    try {
      await idbPut(endpoint.store, {
        clientId: payload.clientId,
        payload: { ...payload, submittedOffline: true },
        queuedAt: Date.now(),
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to queue offline" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if ("sync" in self.registration) {
      try {
        await self.registration.sync.register(SYNC_TAG);
      } catch {}
    }
    return new Response(
      JSON.stringify({
        ok: true,
        queued: true,
        clientId: payload.clientId,
        message:
          "You're offline — we saved this on-device and will submit it when you reconnect.",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function drainStore(endpoint) {
  const items = await idbGetAll(endpoint.store);
  const results = [];
  for (const item of items) {
    try {
      const res = await fetch(endpoint.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await idbDelete(endpoint.store, item.clientId);
        results.push({ store: endpoint.store, clientId: item.clientId, ok: true });
      } else if (res.status >= 400 && res.status < 500) {
        // Permanent rejection — drop the record so we stop retrying.
        await idbDelete(endpoint.store, item.clientId);
        results.push({
          store: endpoint.store,
          clientId: item.clientId,
          ok: false,
          dropped: true,
        });
      } else {
        results.push({ store: endpoint.store, clientId: item.clientId, ok: false });
      }
    } catch {
      // Still offline — leave for next time.
      results.push({ store: endpoint.store, clientId: item.clientId, ok: false });
    }
  }
  return results;
}

async function drainAll() {
  const all = [];
  for (const endpoint of ENDPOINTS) {
    const r = await drainStore(endpoint);
    all.push(...r);
  }
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clientsList) {
    c.postMessage({ type: "dtc-sync-result", results: all });
  }
  return all;
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(drainAll());
  }
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "dtc-drain" || event.data.type === "dtc-hall-drain") {
    event.waitUntil(drainAll());
  }
  if (event.data.type === "dtc-skip-waiting") {
    self.skipWaiting();
  }
});
