"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENTS, type AccentKey, type LoginTweaks } from "@/lib/login/tweaks";

interface Props {
  tweaks: LoginTweaks;
  onChange: (next: LoginTweaks) => void;
}

export function TweaksPanel({ tweaks, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 60,
      }}
    >
      {open && (
        <div
          className="fade-up"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            right: 0,
            width: 280,
            padding: 18,
            borderRadius: 14,
            background: "rgba(15, 17, 30, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
            ACCENT COLOR
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
              const meta = ACCENTS[k];
              const active = tweaks.accent === k;
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => onChange({ ...tweaks, accent: k })}
                  aria-label={meta.label}
                  title={meta.label}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: meta.hex,
                    border: active ? "2px solid #fff" : "2px solid rgba(255,255,255,0.12)",
                    cursor: "pointer",
                    transition: "transform 0.15s",
                    transform: active ? "scale(1.08)" : "scale(1)",
                  }}
                />
              );
            })}
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
              color: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              padding: "8px 0",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 12,
            }}
          >
            <span>Show DICT branding</span>
            <Toggle checked={tweaks.showBranding} onChange={(v) => onChange({ ...tweaks, showBranding: v })} />
          </label>

          <button
            type="button"
            onClick={() => setShowRef((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--login-accent, #f97316)",
              fontSize: 11,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: showRef ? 8 : 0,
            }}
          >
            <span style={{ transform: showRef ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▸</span>
            Hidden access methods
          </button>

          {showRef && (
            <ul className="mono" style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
              <li>1 · Type <span style={{ color: "#e8eaf4" }}>"admin"</span> anywhere</li>
              <li>2 · Press <span style={{ color: "#e8eaf4" }}>Ctrl + Shift + L</span></li>
              <li>3 · Triple-click the central seal</li>
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open tweaks"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(15, 17, 30, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "rgba(255, 255, 255, 0.6)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.11-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.1a1.7 1.7 0 001.56-1.11 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001.03-1.56V3a2 2 0 114 0v.1a1.7 1.7 0 001.03 1.56 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.56 1.03H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: checked ? "var(--login-accent, #f97316)" : "rgba(255,255,255,0.12)",
        border: "none",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}
