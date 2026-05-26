"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

// Mount once at the top of (lh-main)/layout.tsx. Fires recordActivity exactly
// once per page-mount per user. The mutation is server-side idempotent for the
// same Manila-day, so a duplicate call is a no-op — but we still gate on the
// client to avoid log noise and unnecessary round-trips.
//
// On a meaningful change (streak advanced / freeze used / reset / started),
// pop a small auto-dismissing toast.

type Outcome = "already_active" | "started" | "advanced" | "frozen" | "reset";

interface ToastState {
  outcome: Outcome;
  message: string;
  streak?: number;
}

export function StreakCheckIn() {
  const { userId } = useLearnhubSession();
  const recordActivity = useMutation(api.learnhub_streaks.recordActivity);
  const firedRef = useRef<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Guard against double-fire in React strict mode and on quick re-renders.
    if (firedRef.current === userId) return;
    firedRef.current = userId;

    let cancelled = false;
    (async () => {
      try {
        const result = await recordActivity({ userId: userId as Id<"learnhub_users"> });
        if (cancelled) return;
        if (result.changed && result.outcome !== "already_active") {
          setToast({
            outcome: result.outcome,
            message: result.message,
            streak: result.currentStreak,
          });
        }
      } catch {
        // Silent failure — streaks are nice-to-have, never block app load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, recordActivity]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const color =
    toast.outcome === "reset"
      ? "#ef4444"
      : toast.outcome === "frozen"
      ? "#38bdf8"
      : toast.outcome === "started" || toast.outcome === "advanced"
      ? "#f97316"
      : "var(--lh-text-2)";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
        right: 16,
        zIndex: 70,
        maxWidth: "min(360px, calc(100vw - 32px))",
        background: "linear-gradient(180deg, #1a1d30, #131626)",
        border: `1px solid ${color}55`,
        borderRadius: 12,
        padding: "12px 14px",
        color: "var(--lh-text)",
        fontSize: 13,
        boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>
        {toast.outcome === "reset" ? "💤" : toast.outcome === "frozen" ? "🧊" : "🔥"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, color }}>
          {toast.outcome === "reset"
            ? "Streak reset"
            : toast.outcome === "frozen"
            ? "Streak saved"
            : toast.outcome === "started"
            ? "Streak started!"
            : `Day ${toast.streak} streak`}
        </p>
        <p style={{ margin: "2px 0 0", color: "rgba(220,225,240,0.8)", fontSize: 12 }}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => setToast(null)}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.55)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
