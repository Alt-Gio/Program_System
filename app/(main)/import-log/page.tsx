"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProgramSelector } from "@/components/import-log/ProgramSelector";
import { ImportPanel } from "@/components/import-log/ImportPanel";
import { ActivityTimeline } from "@/components/import-log/ActivityTimeline";
import { PROGRAM_LIST } from "@/lib/import/programSchemas";

export default function ImportLogPage() {
  const searchParams = useSearchParams();
  const initialProgram = searchParams.get("program");
  const [program, setProgram] = useState<string | "all">(
    initialProgram && PROGRAM_LIST.includes(initialProgram)
      ? initialProgram
      : PROGRAM_LIST[0],
  );
  const counts = useQuery(api.import_log.getProgramCounts, {}) as
    | Record<string, number>
    | undefined;

  // Sync from URL updates (e.g. user navigates with different ?program=)
  useEffect(() => {
    if (initialProgram && PROGRAM_LIST.includes(initialProgram)) {
      setProgram(initialProgram);
    }
  }, [initialProgram]);

  // Listen for a voice command to pre-select a program
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { program?: string };
      if (detail?.program && PROGRAM_LIST.includes(detail.program)) {
        setProgram(detail.program);
      }
    };
    window.addEventListener("voice:importLogOpen", handler);
    return () => window.removeEventListener("voice:importLogOpen", handler);
  }, []);

  const activeProgram = program === "all" ? PROGRAM_LIST[0] : program;

  return (
    <div className="page-content flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Data Import & Activity Log
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage data imports and track every change across all 10 programs.
          </p>
        </div>
      </div>

      <ProgramSelector value={program} onChange={setProgram} counts={counts} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Import Data
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {program === "all"
                ? `Importing to: ${activeProgram} (defaulted)`
                : `Target: ${program}`}
            </div>
          </div>
          <ImportPanel program={activeProgram} />
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Activity Timeline
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {program === "all" ? "All programs" : program}
            </div>
          </div>
          <ActivityTimeline program={program} />
        </div>
      </div>
    </div>
  );
}
