"use client";

/**
 * (lh-main) layout.
 *
 * Shared chrome for every signed-in LearnHub page (feed, journal,
 * certificates, leaderboard, etc).
 *
 * Two collapse states:
 *   • leftCollapsed  — hides the left profile panel
 *   • rightCollapsed — hides the unified right panel
 *
 * The toggle handles are NOT inside the panels anymore. They are
 * fixed to the viewport's left and right edges so the user can grab
 * them at any scroll position, and they stay reachable even when
 * their respective panel is collapsed (otherwise re-opening would be
 * impossible). Both states persist to localStorage.
 *
 * The previous "right panel mode switch" (default vs. expanded
 * events view) is gone — RightPanel now contains everything in one
 * scrollable column, including the user's mini-profile + status
 * picker at the top.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NotificationProvider } from "@/components/learnhub/notifications/NotificationProvider";
import { TopNav } from "@/components/learnhub/layout/TopNav";
import { MobileBottomNav } from "@/components/learnhub/layout/MobileBottomNav";
import { LeftRail } from "@/components/learnhub/layout/LeftRail";
import { RightPanel } from "@/components/learnhub/panels/RightPanel";

const LS_KEY_LEFT  = "lh-panel-left-collapsed";
const LS_KEY_RIGHT = "lh-panel-right-collapsed";

export default function LhMainLayout({ children }: { children: React.ReactNode }) {
  // Left rail is now a fixed 72px icon strip; the "collapsed" toggle
  // hides it entirely on desktop (mobile nav still works).
  const [leftCollapsed,  setLeftCollapsed]  = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY_LEFT)  === "1") setLeftCollapsed(true);
      if (localStorage.getItem(LS_KEY_RIGHT) === "1") setRightCollapsed(true);
    } catch { /* private mode or sandboxed iframe */ }
  }, []);

  function toggleLeft() {
    // Emit a custom event so the PostComposer can collapse before the
    // grid transition kicks in (prevents visual jump).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lh-composer-collapse"));
    }
    setLeftCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEY_LEFT, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  function toggleRight() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lh-composer-collapse"));
    }
    setRightCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEY_RIGHT, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  const mainClass = [
    "lh-main",
    leftCollapsed  ? "lh-main--left-collapsed"  : "",
    rightCollapsed ? "lh-main--right-collapsed" : "",
  ].filter(Boolean).join(" ");

  return (
    <NotificationProvider>
      <div className="lh-root">
        <TopNav />

        <div className={mainClass}>
          <aside className="lh-left-panel">
            <LeftRail />
          </aside>

          <main style={{ minWidth: 0 }}>{children}</main>

          <aside className="lh-right-panel">
            <RightPanel />
          </aside>
        </div>

        {/* Viewport-edge handles ───────────────────────────────────
            Fixed to the left and right edges of the window. They sit
            on top of every panel/scrollbar (z-index 60) so they can
            still be used to RE-OPEN their panel when collapsed. */}
        <button
          type="button"
          onClick={toggleLeft}
          className={`lh-edge-handle lh-edge-handle--left ${leftCollapsed ? "is-collapsed" : ""}`}
          aria-label={leftCollapsed ? "Show profile panel" : "Hide profile panel"}
          aria-expanded={!leftCollapsed}
          title={leftCollapsed ? "Show profile panel" : "Hide profile panel"}
        >
          {leftCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <button
          type="button"
          onClick={toggleRight}
          className={`lh-edge-handle lh-edge-handle--right ${rightCollapsed ? "is-collapsed" : ""}`}
          aria-label={rightCollapsed ? "Show suggestions panel" : "Hide suggestions panel"}
          aria-expanded={!rightCollapsed}
          title={rightCollapsed ? "Show suggestions panel" : "Hide suggestions panel"}
        >
          {rightCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        <MobileBottomNav />
      </div>
    </NotificationProvider>
  );
}
