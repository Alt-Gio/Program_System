"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fingerprintsFromRows } from "@/lib/import/validateAndDedup";
import type { ImportPreview, ValidatedRow } from "@/lib/import/validateAndDedup";
import { ImportModePaste } from "./ImportModePaste";
import { ImportModeCSV } from "./ImportModeCSV";
import { ImportModeManual } from "./ImportModeManual";
import { ImportModeSheet } from "./ImportModeSheet";
import { MapToProductionDialog } from "./MapToProductionDialog";

type Mode = "sheets" | "csv" | "paste" | "manual";

const MODE_LABELS: Record<Mode, { icon: string; label: string }> = {
  sheets: { icon: "📊", label: "Google Sheet" },
  csv: { icon: "📁", label: "Upload CSV" },
  paste: { icon: "📋", label: "Paste" },
  manual: { icon: "✏️", label: "Manual" },
};

type Props = {
  program: string;
  importedBy?: string;
  onImportComplete?: () => void;
};

export function ImportPanel({ program, importedBy, onImportComplete }: Props) {
  const [mode, setMode] = useState<Mode>("paste");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<Id<"import_sessions"> | null>(
    null,
  );
  const [lastRowsForMap, setLastRowsForMap] = useState<ValidatedRow[]>([]);

  const existing = useQuery(api.import_log.getExistingFingerprints, { program });
  const createSession = useMutation(api.import_log.createImportSession);
  const logRow = useMutation(api.import_log.logRow);
  const saveFingerprints = useMutation(api.import_log.saveFingerprints);
  const complete = useMutation(api.import_log.completeImportSession);

  const existingFps = existing ?? [];

  const handleImport = async (
    preview: ImportPreview,
    meta?: { sourceFileName?: string; sourceSheetTab?: string },
  ) => {
    setIsImporting(true);
    setResult(null);

    try {
      const sessionId = await createSession({
        program,
        importMode: mode,
        totalRows: preview.validatedRows.length,
        importedBy,
        sourceFileName: meta?.sourceFileName,
        sourceSheetTab: meta?.sourceSheetTab,
      });

      let inserted = 0;
      let skipped = 0;
      let duplicates = 0;
      let errors = 0;
      const toFingerprint: Record<string, string>[] = [];

      for (const row of preview.validatedRows) {
        let status: "inserted" | "skipped_duplicate" | "skipped_invalid" = "inserted";
        if (row.status === "invalid") {
          status = "skipped_invalid";
          skipped++;
          errors++;
        } else if (row.status === "duplicate") {
          status = "skipped_duplicate";
          duplicates++;
          skipped++;
        } else {
          inserted++;
          toFingerprint.push(row.data);
        }

        await logRow({
          sessionId,
          program,
          rowIndex: row.rowIndex,
          rowData: row.data,
          status,
          validationErrors: row.errors,
        });
      }

      if (toFingerprint.length > 0) {
        await saveFingerprints({
          program,
          sessionId,
          fingerprints: fingerprintsFromRows(toFingerprint, program),
        });
      }

      await complete({
        sessionId,
        insertedRows: inserted,
        updatedRows: 0,
        skippedRows: skipped,
        duplicatesFound: duplicates,
        validationErrors: errors,
        status: inserted > 0 ? (skipped > 0 ? "partial" : "completed") : "failed",
      });

      setResult(
        `✓ ${inserted} row${inserted === 1 ? "" : "s"} staged${
          skipped > 0 ? ` · ${skipped} skipped` : ""
        }`,
      );

      // Open the map-to-production dialog so user can push into activities
      if (inserted > 0) {
        setLastSessionId(sessionId);
        setLastRowsForMap(
          preview.validatedRows.filter(
            (r) => r.status !== "invalid" && r.status !== "duplicate",
          ),
        );
        setMapOpen(true);
      }

      onImportComplete?.();
    } catch (e: any) {
      setResult(`✗ Import failed: ${e?.message ?? e}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => {
          const active = mode === m;
          const meta = MODE_LABELS[m];
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {result && (
        <div
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            result.startsWith("✓")
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {result}
        </div>
      )}

      {mode === "paste" && (
        <ImportModePaste
          program={program}
          existingFingerprints={existingFps}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}
      {mode === "csv" && (
        <ImportModeCSV
          program={program}
          existingFingerprints={existingFps}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}
      {mode === "manual" && (
        <ImportModeManual
          program={program}
          existingFingerprints={existingFps}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}
      {mode === "sheets" && (
        <ImportModeSheet
          program={program}
          existingFingerprints={existingFps}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}

      <MapToProductionDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        sessionId={lastSessionId}
        program={program}
        rows={lastRowsForMap}
        importedBy={importedBy ?? "import-ui"}
        onSuccess={(r) => {
          setResult(
            `→ ${r.inserted} row${r.inserted === 1 ? "" : "s"} written to ${program} activities${
              r.skipped > 0 ? ` · ${r.skipped} skipped` : ""
            }`,
          );
          onImportComplete?.();
        }}
      />
    </div>
  );
}
