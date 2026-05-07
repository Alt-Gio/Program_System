"use client";

import { useEffect } from "react";
import type { PlayerControls } from "./Player";

type Handlers = {
  controlsRef: React.MutableRefObject<PlayerControls | null>;
  enabled: boolean;
  toggleTheater: () => void;
  toggleHelp: () => void;
  focusNoteComposer: () => void;
  quickBookmark: () => void;
  setLoopA: () => void;
  setLoopB: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useVideoFlowShortcuts({
  controlsRef,
  enabled,
  toggleTheater,
  toggleHelp,
  focusNoteComposer,
  quickBookmark,
  setLoopA,
  setLoopB,
}: Handlers) {
  useEffect(() => {
    if (!enabled) return;

    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) {
        if (event.key === "Escape" && event.target instanceof HTMLElement) {
          event.target.blur();
        }
        return;
      }

      const controls = controlsRef.current;
      const key = event.key;

      if (key === " " || key === "k" || key === "K") {
        event.preventDefault();
        controls?.toggle();
        return;
      }
      if (key === "j" || key === "J") { event.preventDefault(); controls?.seekBy(-10); return; }
      if (key === "l" || key === "L") { event.preventDefault(); controls?.seekBy(10); return; }
      if (key === "ArrowLeft") { event.preventDefault(); controls?.seekBy(-5); return; }
      if (key === "ArrowRight") { event.preventDefault(); controls?.seekBy(5); return; }
      if (key === "t" || key === "T") { event.preventDefault(); toggleTheater(); return; }
      if (key === "n" || key === "N") { event.preventDefault(); focusNoteComposer(); return; }
      if (key === "b" || key === "B") {
        if (event.shiftKey) { event.preventDefault(); setLoopB(); return; }
        event.preventDefault(); quickBookmark(); return;
      }
      if (event.shiftKey && (key === "a" || key === "A")) { event.preventDefault(); setLoopA(); return; }
      if (key === "?") { event.preventDefault(); toggleHelp(); return; }
      if (/^[0-9]$/.test(key)) {
        const ratio = Number(key) / 10;
        const dur = controls?.getDuration() ?? 0;
        if (dur > 0) {
          event.preventDefault();
          controls?.seekTo(Math.floor(dur * ratio), true);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, controlsRef, toggleTheater, toggleHelp, focusNoteComposer, quickBookmark, setLoopA, setLoopB]);
}
