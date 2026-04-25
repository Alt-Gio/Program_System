"use client";

import { useMemo, useState } from "react";
import { PROGRAM_SCHEMAS } from "@/lib/import/programSchemas";
import {
  buildPreview,
  type ImportPreview,
} from "@/lib/import/validateAndDedup";
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

export function ImportModeManual({
  program,
  existingFingerprints,
  onImport,
  isImporting,
}: Props) {
  const schema = PROGRAM_SCHEMAS[program] ?? [];
  const [rows, setRows] = useState<Record<string, string>[]>([{}]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const preview = useMemo(() => {
    if (!previewOpen) return null;
    const filled = rows.filter((r) => Object.values(r).some((v) => v));
    if (filled.length === 0) return null;
    return buildPreview(
      filled,
      schema.map((f) => f.key),
      program,
      existingFingerprints,
      Object.fromEntries(schema.map((f) => [f.key, f.key])),
    );
  }, [rows, schema, program, existingFingerprints, previewOpen]);

  const addRow = () => setRows((p) => [...p, {}]);
  const removeRow = (i: number) =>
    setRows((p) => p.filter((_, idx) => idx !== i));
  const update = (i: number, key: string, v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));

  const hasInput = rows.some((r) => Object.values(r).some((v) => v));

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">
                Row {i + 1}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  ✕ Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {schema.map((f) => (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {f.label}
                    {f.required && <span className="ml-0.5 text-red-500">*</span>}
                  </span>
                  {f.type === "select" ? (
                    <select
                      value={row[f.key] ?? ""}
                      onChange={(e) => update(i, f.key, e.target.value)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                    >
                      <option value="">Select {f.label}</option>
                      {f.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={
                        f.type === "date"
                          ? "date"
                          : f.type === "number"
                            ? "number"
                            : f.type === "email"
                              ? "email"
                              : "text"
                      }
                      value={row[f.key] ?? ""}
                      onChange={(e) => update(i, f.key, e.target.value)}
                      placeholder={f.label}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-800"
        >
          + Add Another Row
        </button>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!hasInput}
          className="ml-auto rounded-full bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Validate & Preview →
        </button>
      </div>

      {preview && (
        <ValidationTable
          preview={preview}
          program={program}
          onConfirmImport={(selected) =>
            onImport({ ...preview, validatedRows: selected })
          }
          isImporting={isImporting}
        />
      )}
    </div>
  );
}
