"use client";

import { useEffect, useRef } from "react";

export type ShortcutHandler = (e: KeyboardEvent) => void;

export type ShortcutSpec = {
  // Key like "a", "d", "i", "/", "Escape"
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  // Match when typing into an input/textarea (default: false)
  allowInInput?: boolean;
  // Prevent default browser handling (default: true when matched)
  preventDefault?: boolean;
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useKeyboardShortcut(
  spec: ShortcutSpec,
  handler: ShortcutHandler,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const keyMatch =
        e.key.toLowerCase() === spec.key.toLowerCase() ||
        e.code.toLowerCase() === spec.key.toLowerCase();
      if (!keyMatch) return;
      if (!!spec.ctrl !== (e.ctrlKey || e.metaKey)) {
        // Accept Ctrl or Meta when ctrl requested; otherwise strict
        if (spec.ctrl && !(e.ctrlKey || e.metaKey)) return;
        if (!spec.ctrl && (e.ctrlKey || e.metaKey)) return;
      }
      if (!!spec.shift !== e.shiftKey) return;
      if (!!spec.alt !== e.altKey) return;
      if (!spec.allowInInput && isTyping(e.target)) return;
      if (spec.preventDefault !== false) e.preventDefault();
      handlerRef.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    spec.key,
    spec.ctrl,
    spec.shift,
    spec.alt,
    spec.meta,
    spec.allowInInput,
    spec.preventDefault,
  ]);
}
