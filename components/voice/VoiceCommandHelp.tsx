"use client";

import { X } from "lucide-react";

type Section = { title: string; commands: string[] };

const SECTIONS: Section[] = [
  {
    title: "🧭 Navigation",
    commands: [
      "Go to dashboard",
      "Open activities",
      "Show interns",
      "Show me attendance",
      "Open the map",
      "Go to personnel",
      "Open reports",
      "Open settings",
      "Open import log",
      "Go to SPARK project",
      "Go back",
    ],
  },
  {
    title: "📊 Data queries",
    commands: [
      "How many activities today?",
      "How many activities this month?",
      "How many activities this year?",
      "Total number of activities",
      "How many interns do we have?",
      "How many personnel?",
      "Show statistics",
      "Show SPARK program summary",
      "Find activity about digital marketing",
    ],
  },
  {
    title: "✏️ Adding data",
    commands: [
      "Add a new activity",
      "Add activity for SPARK",
      "Add a new intern",
      "Mark Juan de la Cruz as present today",
    ],
  },
  {
    title: "🔤 Sort, filter, search",
    commands: [
      "Sort by date newest first",
      "Sort alphabetically",
      "Filter by SPARK program",
      "Search for digital marketing",
      "Open the first activity",
    ],
  },
  {
    title: "📥 Import & reports",
    commands: [
      "Open import log",
      "Import data from Google Sheets",
      "Import activities from CSV",
      "Import data for eGovPH",
      "Generate report",
      "Generate quarterly report for SPARK",
      "Export report to Sheets",
    ],
  },
  {
    title: "⚙️ System",
    commands: [
      "Help / What can you do",
      "Stop listening / Sleep",
      "Yes / Confirm",
      "No / Cancel",
      "Close this",
    ],
  },
];

export function VoiceCommandHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">🎙️ Voice Commands</h2>
            <p className="mt-1 text-sm text-gray-500">
              Click the mic and speak. Turn on <span className="font-medium text-indigo-600">Wake on</span> to say "hey system" hands-free.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="mb-2 text-sm font-semibold text-gray-800">
                {s.title}
              </h3>
              <ul className="space-y-1">
                {s.commands.map((c) => (
                  <li
                    key={c}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 font-mono text-xs text-gray-700"
                  >
                    “{c}”
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 text-xs text-gray-600 md:grid-cols-2">
          <div>
            <div className="font-semibold text-gray-800">Taglish works</div>
            <div className="mt-1 opacity-80">
              "Ipakita ang activities ngayon", "Magdagdag ng activity para sa SPARK", "Ilan ang interns natin".
            </div>
          </div>
          <div>
            <div className="font-semibold text-gray-800">Confirmation</div>
            <div className="mt-1 opacity-80">
              Some actions (like marking attendance) ask for confirmation — reply <em>"yes"</em> or <em>"no"</em>.
            </div>
          </div>
        </div>

        <p className="mt-4 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
          Requires Chrome or Edge. Microphone permission needed. Audio is sent to Google's speech service; transcripts are parsed by Groq.
        </p>
      </div>
    </div>
  );
}
