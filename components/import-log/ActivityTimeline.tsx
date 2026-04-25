"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PROGRAM_LIST } from "@/lib/import/programSchemas";
import { TimelineEntry, type ActivityLogEntry } from "./TimelineEntry";

type Props = {
  program: string | "all";
};

export function ActivityTimeline({ program }: Props) {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [programFilter, setProgramFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");

  const logs = useQuery(api.import_log.getActivityLog, {
    program: program === "all" ? undefined : program,
    action: actionFilter || undefined,
    limit: 100,
  }) as ActivityLogEntry[] | undefined;

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l) => {
      if (programFilter && l.program !== programFilter) return false;
      if (dateFilter) {
        const d = new Date(l.timestamp);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (iso !== dateFilter) return false;
      }
      return true;
    });
  }, [logs, programFilter, dateFilter]);

  const grouped = useMemo(() => groupByDateLabel(filtered), [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Actions</option>
          <option value="import">Import</option>
          <option value="manual_add">Manual Add</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="sync">Sync</option>
          <option value="export">Export</option>
          <option value="voice_add">Voice</option>
        </select>

        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Programs</option>
          {PROGRAM_LIST.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        />
        {(actionFilter || programFilter || dateFilter) && (
          <button
            type="button"
            onClick={() => {
              setActionFilter("");
              setProgramFilter("");
              setDateFilter("");
            }}
            className="text-xs text-gray-500 hover:text-gray-800"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {!logs ? (
          <div className="flex h-40 items-center justify-center text-xs text-gray-400">
            Loading timeline…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <div className="text-3xl">📋</div>
            <div className="mt-2 text-sm font-semibold text-gray-700">
              No activity yet
            </div>
            <div className="text-xs text-gray-500">
              Import data or make changes to see the log here.
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([label, entries]) => (
            <div key={label} className="mb-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {label}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              {entries.map((e) => (
                <TimelineEntry key={e._id} entry={e} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function groupByDateLabel(
  entries: ActivityLogEntry[],
): Record<string, ActivityLogEntry[]> {
  const out: Record<string, ActivityLogEntry[]> = {};
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const todayKey = `${y}-${m}-${d}`;
  const yestKey = `${y}-${m}-${d - 1}`;

  for (const e of entries) {
    const dt = new Date(e.timestamp);
    const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    const label =
      key === todayKey
        ? "Today"
        : key === yestKey
          ? "Yesterday"
          : dt.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: dt.getFullYear() !== y ? "numeric" : undefined,
            });
    (out[label] ??= []).push(e);
  }
  return out;
}
