"use client";

import { useState } from "react";
import { parseCSVText } from "@/lib/import/csvParser";
import {
  buildPreview,
  type ImportPreview,
} from "@/lib/import/validateAndDedup";
import { PROGRAM_SCHEMAS } from "@/lib/import/programSchemas";
import { ColumnMapper } from "./ColumnMapper";
import { ValidationTable } from "./ValidationTable";

type Props = {
  program: string;
  existingFingerprints: Array<{
    fingerprint: string;
    rowData: Record<string, string>;
  }>;
  onImport: (
    preview: ImportPreview,
    meta: { sourceSheetTab: string },
  ) => Promise<void> | void;
  isImporting?: boolean;
};

type Parsed = { columns: string[]; rows: Record<string, string>[] };

export function ImportModeSheet({
  program,
  existingFingerprints,
  onImport,
  isImporting,
}: Props) {
  const schema = PROGRAM_SCHEMAS[program] ?? [];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<string, string> | null>(null);
  const [lastPulledAt, setLastPulledAt] = useState<number | null>(null);

  const pull = async () => {
    setIsLoading(true);
    setError(null);
    setParsed(null);
    setMapping(null);
    try {
      const res = await fetch(
        `/api/sheets-tabs?program=${encodeURIComponent(program)}`,
      );
      if (!res.ok) {
        throw new Error(
          `Sheet preview endpoint returned ${res.status}. Configure /api/sheets-tabs to return the "${program}" tab as CSV.`,
        );
      }
      const text = await res.text();
      const t = parseCSVText(text);
      if (t.rows.length === 0) {
        throw new Error("No rows returned from the sheet tab.");
      }
      setParsed(t);
      setLastPulledAt(Date.now());
    } catch (e: any) {
      setError(e?.message ?? "Could not pull from the sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  const preview: ImportPreview | null =
    parsed && parsed.rows.length
      ? buildPreview(
          parsed.rows,
          parsed.columns,
          program,
          existingFingerprints,
          mapping ?? undefined,
        )
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            📊
          </div>
          <div>
            <div className="text-sm text-gray-600">
              tab: <strong className="text-gray-900">{program}</strong>
            </div>
            <div className="text-xs text-gray-500">Connected Google Sheet</div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">
          {lastPulledAt
            ? `Pulled ${new Date(lastPulledAt).toLocaleTimeString()}`
            : "Never pulled"}
        </div>
      </div>

      <button
        type="button"
        onClick={pull}
        disabled={isLoading}
        className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:bg-gray-300"
      >
        {isLoading ? "Reading Sheet…" : "↓ Pull Latest Data"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {parsed && parsed.columns.length > 0 && (
        <ColumnMapper
          sourceColumns={parsed.columns}
          targetSchema={schema}
          initialMapping={mapping ?? undefined}
          onMappingChange={setMapping}
        />
      )}

      {preview && (
        <ValidationTable
          preview={preview}
          program={program}
          onConfirmImport={(selected) =>
            onImport(
              { ...preview, validatedRows: selected },
              { sourceSheetTab: program },
            )
          }
          isImporting={isImporting}
        />
      )}
    </div>
  );
}
