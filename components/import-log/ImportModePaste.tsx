"use client";

import { useMemo, useState } from "react";
import { parseCSVText, countRows } from "@/lib/import/csvParser";
import { buildPreview, type ImportPreview } from "@/lib/import/validateAndDedup";
import { PROGRAM_SCHEMAS } from "@/lib/import/programSchemas";
import { ColumnMapper } from "./ColumnMapper";
import { ValidationTable } from "./ValidationTable";

type Props = {
  program: string;
  existingFingerprints: Array<{
    fingerprint: string;
    rowData: Record<string, string>;
  }>;
  onImport: (preview: ImportPreview) => Promise<void> | void;
  isImporting?: boolean;
};

export function ImportModePaste({
  program,
  existingFingerprints,
  onImport,
  isImporting,
}: Props) {
  const schema = PROGRAM_SCHEMAS[program] ?? [];
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Record<string, string> | null>(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    return parseCSVText(text);
  }, [text]);

  const preview = useMemo(() => {
    if (!parsed || parsed.rows.length === 0) return null;
    return buildPreview(
      parsed.rows,
      parsed.columns,
      program,
      existingFingerprints,
      mapping ?? undefined,
    );
  }, [parsed, program, existingFingerprints, mapping]);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
        <span>💡</span>
        <span>
          Copy rows directly from Google Sheets or Excel and paste below. The
          first row should be column headers.
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold text-gray-700">
          Expected columns:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {schema.map((f) => (
            <span
              key={f.key}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                f.required
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {f.label}
              {f.required && " *"}
            </span>
          ))}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste your ${program} data here...\n\nExample:\nActivity Title\tDate\tVenue\tParticipants\nDigital Literacy Training\t2026-04-20\tDTC Legazpi\t35`}
        rows={10}
        className="w-full rounded-xl border border-gray-200 bg-white p-3 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <div className="text-xs text-gray-500">
        {text.trim() ? `${countRows(text)} rows detected` : ""}
      </div>

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
          onConfirmImport={(selected) => {
            onImport({ ...preview, validatedRows: selected });
          }}
          isImporting={isImporting}
        />
      )}
    </div>
  );
}
