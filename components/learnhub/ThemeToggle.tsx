"use client";

import { useState, useEffect } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/learnhub/theme";

const ICONS: Record<Theme, string> = { light: "☀️", dark: "🌙", system: "💻" };
const LABELS: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };
const ORDER: Theme[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      onClick={cycle}
      className="lh-icon-btn"
      title={`Theme: ${LABELS[theme]}`}
      style={{ fontSize: 16 }}
    >
      {ICONS[theme]}
    </button>
  );
}
