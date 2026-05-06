"use client";

import { useRef } from "react";

interface DictSealProps {
  size?: number;
  onTripleClick?: () => void;
  glow?: boolean;
}

// Central seal on the login stage. Triple-click (3 clicks within 800 ms)
// is one of the three admin-unlock triggers.
export function DictSeal({ size = 120, onTripleClick, glow = true }: DictSealProps) {
  const clicksRef = useRef<number[]>([]);

  function handleClick() {
    if (!onTripleClick) return;
    const now = Date.now();
    const recent = clicksRef.current.filter((t) => now - t < 800);
    recent.push(now);
    clicksRef.current = recent;
    if (recent.length >= 3) {
      clicksRef.current = [];
      onTripleClick();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="DICT seal"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 50% 50%, #0a0d1e 0%, #05060f 70%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: glow
          ? "0 0 40px rgba(249, 115, 22, 0.15), inset 0 0 30px rgba(0,0,0,0.4)"
          : "inset 0 0 30px rgba(0,0,0,0.4)",
        position: "relative",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        style={{ display: "block" }}
      >
        {/* outer dashed ring */}
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.6"
          strokeDasharray="2 4"
        />
        {/* inner solid ring */}
        <circle
          cx="60"
          cy="60"
          r="38"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.8"
        />
        {/* accent ring */}
        <circle
          cx="60"
          cy="60"
          r="22"
          fill="rgba(249, 115, 22, 0.08)"
          stroke="var(--login-accent, #f97316)"
          strokeWidth="1"
        />
        {/* D monogram */}
        <text
          x="60"
          y="70"
          textAnchor="middle"
          fontFamily="'DM Serif Display', serif"
          fontSize="22"
          fontStyle="italic"
          fill="var(--login-accent, #f97316)"
        >
          D
        </text>
        {/* tick marks */}
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1="60"
            y1="14"
            x2="60"
            y2="18"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            transform={`rotate(${deg} 60 60)`}
          />
        ))}
      </svg>
    </button>
  );
}
