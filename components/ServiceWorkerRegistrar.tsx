"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once per tab. Scope is "/" so both
 * /meeting-hall and /dtc-logbook are intercepted regardless of
 * which page the user lands on first.
 *
 * Safe to render on every route — dev reloads on other pages
 * share the same SW, and the SW ignores paths it doesn't care
 * about.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register in dev too so offline flows can be exercised locally.
    // If caching ever gets in the way during iteration, open DevTools →
    // Application → Service Workers → "Update on reload".

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // SW support is a progressive enhancement — silently ignore.
    });
  }, []);
  return null;
}
