"use client";

import { useRef, useState } from "react";
import { parseCSVFile, type ParsedTable } from "@/lib/import/csvParser";
import { parseXLSXFile } from "@/lib/import/xlsxParser";
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
    meta: { sourceFileName: string },
  ) => Promise<void> | void;
  isImporting?: boolean;
};

export function ImportModeCSV({
  program,
  existingFingerprints,
  onImport,
  isImporting,
}: Props) {
  const schema = PROGRAM_SCHEMAS[program] ?? [];
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setError(null);
    setFile(f);
    setMapping(null);
    try {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const table =
        ext === "xlsx" || ext === "xls"
          ? await parseXLSXFile(f)
          : await parseCSVFile(f);
      if (table.rows.length === 0) {
        setError("No rows found in this file.");
        setParsed(null);
        return;
      }
      setParsed(table);
    } catch (e: any) {
      setError(e?.message ?? "Failed to parse file.");
      setParsed(null);
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
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 bg-gray-50 hover:border-blue-400"
        }`}
      >
        <div className="text-3xl">📁</div>
        <div className="mt-2 text-sm font-semibold text-gray-800">
          {file ? file.name : "Drop CSV or Excel file here"}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          or click to browse · CSV, XLSX supported
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

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
          onConfirmImport={(selected) => {
            onImport(
              { ...preview, validatedRows: selected },
              { sourceFileName: file?.name ?? "upload" },
            );
          }}
          isImporting={isImporting}
        />
      )}
    </div>
  );
}
