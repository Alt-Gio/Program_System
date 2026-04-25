"use client";

import Link from "next/link";
import { ArrowLeft, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = { keys: string[]; action: string; description?: string };

const GLOBAL: Row[] = [
  { keys: ["/"], action: "Smart Search", description: "Search activities, interns, personnel, and programs." },
  { keys: ["Ctrl", "Shift", "A"], action: "Quick Add Activity", description: "Opens the 5-field modal anywhere in the app." },
  { keys: ["Ctrl", "Shift", "I"], action: "Go to Import Log" },
  { keys: ["Ctrl", "Shift", "D"], action: "Go to Dashboard" },
  { keys: ["Ctrl", "K"], action: "Open this Shortcuts page" },
];

const VOICE: Row[] = [
  { keys: ["Click orb"], action: "Push-to-talk", description: "Speak a single command." },
  { keys: ["Wake toggle"], action: "Say 'hey system'", description: "Hands-free; always listening." },
];

const DIALOG: Row[] = [
  { keys: ["Esc"], action: "Close current dialog or panel" },
  { keys: ["Enter"], action: "Confirm primary action", description: "In forms where focus is on an input." },
  { keys: ["Tab"], action: "Next field" },
  { keys: ["Shift", "Tab"], action: "Previous field" },
];

export default function ShortcutsPage() {
  return (
    <div className="page-content mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Keyboard className="h-5 w-5" /> Keyboard Shortcuts
          </h1>
          <p className="text-sm text-gray-500">
            Optimized for staff who use this daily. All shortcuts ignore input
            fields so typing never triggers them.
          </p>
        </div>
      </div>

      <Section title="Global" rows={GLOBAL} />
      <Section title="Voice commands" rows={VOICE} />
      <Section title="Inside dialogs & forms" rows={DIALOG} />

      <div className="rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
        Shortcuts that involve <kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm">Ctrl</kbd>{" "}
        work with <kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm">⌘</kbd> on macOS.
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div>
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr] gap-4 border-t border-gray-50 px-4 py-3 first:border-t-0"
          >
            <div className="flex flex-wrap items-center gap-1">
              {row.keys.map((k, j) => (
                <span key={j} className="flex items-center">
                  <kbd className="rounded-md border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-700 shadow-sm">
                    {k}
                  </kbd>
                  {j < row.keys.length - 1 && (
                    <span className="mx-1 text-gray-300">+</span>
                  )}
                </span>
              ))}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {row.action}
              </div>
              {row.description && (
                <div className="text-xs text-gray-500">{row.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
