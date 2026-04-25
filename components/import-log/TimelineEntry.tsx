"use client";

import { memo, useState } from "react";
import { PROGRAM_META } from "@/lib/import/programSchemas";

type Action =
  | "import"
  | "manual_add"
  | "update"
  | "delete"
  | "sync"
  | "export"
  | "voice_add"
  | "bulk_delete";

export type ActivityLogEntry = {
  _id: string;
  program: string;
  action: Action;
  entityType: string;
  summary: string;
  detail?: any;
  affectedRows: number;
  performedBy?: string;
  timestamp: number;
  isVoiceInitiated: boolean;
};

const ACTION_CFG: Record<
  Action,
  { icon: string; label: string; dot: string; pill: string }
> = {
  import:      { icon: "📥", label: "Import",      dot: "bg-blue-500",   pill: "bg-blue-50 text-blue-700" },
  manual_add:  { icon: "✏️", label: "Manual Add",  dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  update:      { icon: "🔄", label: "Update",      dot: "bg-amber-500",  pill: "bg-amber-50 text-amber-800" },
  delete:      { icon: "🗑️", label: "Delete",      dot: "bg-red-500",    pill: "bg-red-50 text-red-700" },
  sync:        { icon: "🔗", label: "Sync",        dot: "bg-violet-500", pill: "bg-violet-50 text-violet-700" },
  export:      { icon: "📤", label: "Export",      dot: "bg-gray-500",   pill: "bg-gray-100 text-gray-700" },
  voice_add:   { icon: "🎙️", label: "Voice",       dot: "bg-indigo-500", pill: "bg-indigo-50 text-indigo-700" },
  bulk_delete: { icon: "🗑️", label: "Bulk Delete", dot: "bg-red-600",    pill: "bg-red-50 text-red-700" },
};

export const TimelineEntry = memo(
  function TimelineEntryInner({ entry }: { entry: ActivityLogEntry }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = ACTION_CFG[entry.action];
    const meta = PROGRAM_META[entry.program];

  return (
    <div className="flex gap-3 py-1">
      <div className="flex w-9 flex-col items-center">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-base shadow-sm ${cfg.pill}`}
        >
          {cfg.icon}
        </div>
        <div className="mt-1 w-px flex-1 bg-gray-200" />
      </div>

      <div className="flex-1 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {meta && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: meta.soft,
                color: meta.color,
                borderColor: meta.color + "40",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: meta.color }}
              />
              {entry.program}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.pill}`}
          >
            {cfg.label}
          </span>
          {entry.isVoiceInitiated && (
            <span title="Initiated by voice" className="text-sm">
              🎙️
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400">
            {new Date(entry.timestamp).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          {entry.detail && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-gray-400 hover:text-gray-700"
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>

        <div className="mt-1 text-sm text-gray-800">{entry.summary}</div>

        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
          {entry.affectedRows > 0 && (
            <span>
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
              {entry.affectedRows} row{entry.affectedRows === 1 ? "" : "s"}
            </span>
          )}
          {entry.performedBy && <span>by {entry.performedBy}</span>}
        </div>

        {expanded && entry.detail && (
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
            {entry.action === "import" ? (
              <div className="flex flex-wrap gap-3">
                <span className="text-emerald-700">
                  ✓ {entry.detail.inserted ?? 0} inserted
                </span>
                <span className="text-amber-700">
                  ⚡ {entry.detail.duplicates ?? 0} duplicates
                </span>
                <span className="text-gray-500">
                  ○ {entry.detail.skipped ?? 0} skipped
                </span>
                <span className="text-red-700">
                  ✕ {entry.detail.errors ?? 0} errors
                </span>
                {entry.detail.sourceFile && (
                  <span className="w-full text-gray-500">
                    Source: {entry.detail.sourceFile}
                  </span>
                )}
                {entry.detail.sourceSheet && (
                  <span className="w-full text-gray-500">
                    Sheet tab: {entry.detail.sourceSheet}
                  </span>
                )}
                <span className="w-full text-gray-500">
                  Mode: {entry.detail.mode}
                </span>
              </div>
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px]">
                {JSON.stringify(entry.detail, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
  },
  (prev, next) =>
    prev.entry._id === next.entry._id &&
    prev.entry.timestamp === next.entry.timestamp &&
    prev.entry.affectedRows === next.entry.affectedRows,
);
