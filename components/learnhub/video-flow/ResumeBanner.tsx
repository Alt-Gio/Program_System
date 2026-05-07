"use client";

import { History, X } from "lucide-react";
import { fmtTime } from "./utils";

type Props = {
  lastPositionSec: number;
  durationSec?: number;
  onResume: () => void;
  onStartOver: () => void;
  onDismiss: () => void;
};

export function ResumeBanner({ lastPositionSec, durationSec, onResume, onStartOver, onDismiss }: Props) {
  if (lastPositionSec < 5) return null;
  const pct = durationSec ? Math.min(100, Math.round((lastPositionSec / durationSec) * 100)) : null;
  return (
    <div className="vf-resume-banner" role="status">
      <div className="vf-resume-banner-icon"><History size={18} /></div>
      <div className="vf-resume-banner-text">
        <strong>Pick up where you left off</strong>
        <span>Last watched at {fmtTime(lastPositionSec)}{pct !== null ? ` · ${pct}% in` : ""}.</span>
      </div>
      <div className="vf-resume-banner-actions">
        <button className="vf-primary-btn vf-primary-btn-sm" onClick={onResume}>Resume</button>
        <button className="vf-ghost-btn vf-ghost-btn-sm" onClick={onStartOver}>Start over</button>
        <button className="vf-icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
