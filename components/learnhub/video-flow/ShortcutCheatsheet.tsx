"use client";

import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ROWS: { keys: string; label: string }[] = [
  { keys: "Space / K", label: "Play / Pause" },
  { keys: "J / L", label: "Back / Forward 10s" },
  { keys: "← / →", label: "Back / Forward 5s" },
  { keys: "T", label: "Toggle theater mode" },
  { keys: "N", label: "Focus note input" },
  { keys: "B", label: "Quick bookmark at current time" },
  { keys: "Shift + A / Shift + B", label: "Set loop A / B" },
  { keys: "0 – 9", label: "Jump to 0–90% of video" },
  { keys: "Ctrl/Cmd + Enter", label: "Save note from composer" },
  { keys: "?", label: "Show this cheatsheet" },
];

export function ShortcutCheatsheet({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="vf-modal-backdrop" role="dialog" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="vf-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Keyboard shortcuts</h2>
          <button className="vf-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <table className="vf-shortcut-table">
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.keys}>
                <td><kbd>{row.keys}</kbd></td>
                <td>{row.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="vf-muted">Shortcuts pause when you're typing in any input, textarea, or chat box.</p>
      </div>
    </div>
  );
}
