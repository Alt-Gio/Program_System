"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

type Props = {
  storageKey: string;
  icon?: React.ReactNode;
  title: string;
  body: string;
  show?: boolean;
};

export function DiscoveryHint({ storageKey, icon, title, body, show = true }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(`vf-hint:${storageKey}`);
      if (!seen) setDismissed(false);
    } catch { /* ignore */ }
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    try { window.localStorage.setItem(`vf-hint:${storageKey}`, "1"); } catch { /* ignore */ }
  }

  if (dismissed || !show) return null;

  return (
    <div className="vf-hint-card" role="status">
      <span className="vf-hint-icon">{icon ?? <Sparkles size={16} />}</span>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="vf-icon-btn">
        <X size={14} />
      </button>
    </div>
  );
}
