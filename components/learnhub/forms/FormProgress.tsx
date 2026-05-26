"use client";

interface FormProgressProps {
  current: number;
  total: number;
  showLabel?: boolean;
}

export function FormProgress({ current, total, showLabel = true }: FormProgressProps) {
  const pct = Math.min(Math.round((current / total) * 100), 100);
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "var(--lh-text-2)" }}>
          <span>Question {current} of {total}</span>
          <span>{pct}% complete</span>
        </div>
      )}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#5b6cff,#22d3a0)" }}
        />
      </div>
    </div>
  );
}
