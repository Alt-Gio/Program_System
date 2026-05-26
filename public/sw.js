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

const CACHE_VERSION = "dtc-pwa-v4";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Install-time precache. Everything else is cached opportunistically the
// first time the user visits a route. Keep this list tight — too many URLs
// here makes install slow and brittle (any 404 aborts the whole cache.addAll
// unless we .catch — which we do, but it still hurts UX).
const SHELL_URLS = [
  // Root + auth surfaces
  "/",
  "/login",
  // Meeting Hall + DTC logbook
  "/meeting-hall",
  "/dtc-logbook",
  // Intern portal core
  "/intern/dashboard",
  "/intern/tasks",
  "/intern/habits",
  "/intern/journal",
  "/intern/messages",
  "/intern/qr",
  "/intern/qr-checkin",
  // Supervisor
  "/supervisor/dashboard",
  // LearnHub primary landing pages
  "/learnhub/today",
  "/learnhub/feed",
  "/learnhub/paths",
  "/learnhub/mentors",
  // PMS dashboard core
  "/dashboard",
  // Manifests + icons
  "/manifest.json",
  "/learnhub-manifest.json",
  "/meeting-hall-manifest.json",
  "/intern-manifest.json",
  "/icons/dict-icon.svg",
  "/icons/dict-maskable.svg",
  "/icons/dtc-icon.svg",
  "/icons/dtc-maskable.svg",
  "/icons/learnhub-icon.svg",
  "/icons/learnhub-maskable.svg",
  "/icons/intern-icon.svg",
  "/icons/intern-maskable.svg",
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

// Branded offline fallback returned when navigation fails AND no cached
// copy of that route exists. Keep this small + self-contained — it must
// render with zero network. The retry button just reloads; the "go to
// installed pages" CTAs link to routes already in SHELL_URLS so they're
// guaranteed to work offline after install.
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Offline — DICT Region V</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #06060f; color: #e8eaf4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; }
body { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
.card { max-width: 460px; width: 100%; background: linear-gradient(160deg, rgba(91,108,255,0.08), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px; text-align: center; }
.dot { width: 56px; height: 56px; border-radius: 99px; background: linear-gradient(135deg, #5b6cff, #7c5cff); margin: 0 auto 18px; display: flex; align-items: center; justify-content: center; font-size: 26px; }
h1 { font-size: 22px; margin: 0 0 8px; font-weight: 700; }
p { font-size: 14px; line-height: 1.55; margin: 0 0 14px; color: #b9bee6; }
.btn { display: inline-block; padding: 10px 18px; border-radius: 999px; background: #5b6cff; color: #fff; font-weight: 600; font-size: 13px; text-decoration: none; border: none; cursor: pointer; }
.btn.ghost { background: transparent; border: 1px solid rgba(255,255,255,0.14); color: #cfd3eb; margin-left: 6px; }
.row { margin-top: 18px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.quick { margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); }
.quick p { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #6f76a0; margin-bottom: 10px; }
.quick a { display: inline-block; margin: 4px 6px; padding: 6px 12px; font-size: 12px; color: #a8b4ff; text-decoration: none; border-radius: 99px; background: rgba(91,108,255,0.1); border: 1px solid rgba(91,108,255,0.25); }
.tag { display: inline-block; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 10px; border-radius: 99px; background: rgba(255,140,66,0.12); color: #ff8c42; border: 1px solid rgba(255,140,66,0.3); margin-bottom: 12px; }
</style>
</head>
<body>
<div class="card">
  <div class="dot">📡</div>
  <span class="tag">Offline</span>
  <h1>You're offline</h1>
  <p>We couldn't reach the network for this page. Anything you've already visited will still open — and submissions made offline (bookings, journal entries, habits, check-ins) sync automatically when you reconnect.</p>
  <div class="row">
    <button class="btn" onclick="location.reload()">Try again</button>
    <a class="btn ghost" href="/">Go to home</a>
  </div>
  <div class="quick">
    <p>Pages cached for offline use</p>
    <a href="/learnhub/today">LearnHub · Today</a>
    <a href="/meeting-hall">Meeting Hall</a>
    <a href="/intern/dashboard">Intern Portal</a>
    <a href="/dashboard">Dashboard</a>
  </div>
</div>
</body>
</html>`;

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

// Paths we never want the SW to mediate — auth callbacks, OAuth round-trips,
// and anything that mutates server state via GET (rare, but exists for
// certificate verification + invite links). These bypass the navigation
// handler and hit the network directly.
function isUnshellablePath(pathname) {
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/accept-invite")) return true;
  if (pathname.startsWith("/learnhub/verify/")) return true;
  // PWA Web Share Target lands here with query params we must not strip
  // or replay from cache — always hit the network so the latest share is
  // forwarded to the composer.
  if (pathname === "/learnhub/share") return true;
  return false;
}

// Whole-app PWA model (post-Batch-5 refactor): any same-origin GET
// navigation that isn't on the bypass list is eligible for the offline
// shell. This replaces the old allowlist (meeting-hall / intern /
// supervisor only) so dashboard, learnhub, cohorts, projects, etc. all
// get a usable offline fallback after their first successful visit.
function isPublicNavigation(pathname) {
  return !isUnshellablePath(pathname);
}

function shellKeyFor(pathname) {
  if (isUnshellablePath(pathname)) return null;
  // One cache key per pathname — search strings are intentionally dropped
  // so /projects/A and /projects/A?tab=overview share an offline shell.
  return pathname || "/";
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
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
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
