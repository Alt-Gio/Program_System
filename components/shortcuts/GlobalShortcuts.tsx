"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { QuickAddActivity } from "@/components/quick-add/QuickAddActivity";

// Centralized non-visual shortcut registry. The floating QuickAddButton
// also binds Ctrl+Shift+A for redundancy; both openers are safe.
export function GlobalShortcuts() {
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useKeyboardShortcut(
    { key: "a", ctrl: true, shift: true },
    () => setQuickAddOpen(true),
  );
  useKeyboardShortcut({ key: "i", ctrl: true, shift: true }, () =>
    router.push("/import-log"),
  );
  useKeyboardShortcut({ key: "d", ctrl: true, shift: true }, () =>
    router.push("/dashboard"),
  );
  useKeyboardShortcut({ key: "k", ctrl: true }, () =>
    router.push("/shortcuts"),
  );

  return (
    <QuickAddActivity open={quickAddOpen} onOpenChange={setQuickAddOpen} />
  );
}
