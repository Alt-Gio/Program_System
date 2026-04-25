"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { QuickAddActivity } from "./QuickAddActivity";

export function QuickAddButton() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcut(
    { key: "a", ctrl: true, shift: true },
    () => setOpen(true),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick add activity (Ctrl+Shift+A)"
        title="Quick add activity (Ctrl+Shift+A)"
        className="fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition hover:scale-105 hover:bg-blue-700 active:scale-95 md:left-auto md:right-[108px]"
      >
        <Plus className="h-5 w-5" />
      </button>
      <QuickAddActivity open={open} onOpenChange={setOpen} />
    </>
  );
}
