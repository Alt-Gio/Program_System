"use client";

/**
 * (lh-main) layout.
 *
 * Shared chrome for every signed-in LearnHub page.
 *
 * Left panel cycles between two visible modes (never fully hidden,
 * Pinterest-style):
 *   • "rail" — 84-px icon strip (LeftRail)
 *   • "full" — wider profile panel (LeftPanel)
 *
 * Right panel still has a binary collapsed/visible state.
 *
 * Both states persist to localStorage.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { NotificationProvider } from "@/components/learnhub/notifications/NotificationProvider";
import { TopNav } from "@/components/learnhub/layout/TopNav";
import { MobileBottomNav } from "@/components/learnhub/layout/MobileBottomNav";
import { LeftRail } from "@/components/learnhub/layout/LeftRail";
import { LeftPanel } from "@/components/learnhub/panels/LeftPanel";
import { RightPanel } from "@/components/learnhub/panels/RightPanel";

const LS_KEY_LEFT  = "lh-panel-left-mode";
const LS_KEY_RIGHT = "lh-panel-right-collapsed";

type LeftMode = "rail" | "full";

export default function LhMainLayout({ children }: { children: React.ReactNode }) {
  const [leftMode,       setLeftMode]       = useState<LeftMode>("rail");
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_LEFT);
      if (saved === "full" || saved === "rail") {
        setLeftMode(saved);
      }
      if (localStorage.getItem(LS_KEY_RIGHT) === "1") setRightCollapsed(true);
    } catch { /* private mode or sandboxed iframe */ }
  }, []);

  function toggleLeft() {
    // Emit a custom event so the PostComposer can collapse before the
    // grid transition kicks in (prevents visual jump).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lh-composer-collapse"));
    }
    setLeftMode((prev) => {
      const next: LeftMode = prev === "full" ? "rail" : "full";
      try { localStorage.setItem(LS_KEY_LEFT, next); } catch {}
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

  const isFull = leftMode === "full";
  const mainClass = [
    "lh-main",
    isFull ? "lh-main--left-full" : "",
    rightCollapsed ? "lh-main--right-collapsed" : "",
  ].filter(Boolean).join(" ");

  return (
    <NotificationProvider>
      <div className="lh-root">
        <TopNav />

        <div className={mainClass}>
          <aside className="lh-left-panel">
            {isFull ? <LeftPanel /> : <LeftRail />}
          </aside>

          <main style={{ minWidth: 0 }}>{children}</main>

          <aside className="lh-right-panel">
            <RightPanel />
          </aside>
        </div>

        {/* Viewport-edge handles ───────────────────────────────────
            Left handle cycles rail ↔ full; right handle still toggles
            visible/hidden. Fixed-position so they reach across panels. */}
        <button
          type="button"
          onClick={toggleLeft}
          className={`lh-edge-handle lh-edge-handle--left ${isFull ? "is-full" : ""}`}
          aria-label={isFull ? "Switch to compact icon rail" : "Show full profile panel"}
          aria-expanded={isFull}
          title={isFull ? "Compact view" : "Expanded profile"}
        >
          {isFull ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
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
