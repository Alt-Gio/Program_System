"use client";

import { useState } from "react";
import type { ImportPreview, ValidatedRow } from "@/lib/import/validateAndDedup";
import { PROGRAM_SCHEMAS, type FieldDef } from "@/lib/import/programSchemas";

type Props = {
  preview: ImportPreview;
  program: string;
  onConfirmImport: (selectedRows: ValidatedRow[]) => void;
  isImporting?: boolean;
};

type Filter = "all" | "valid" | "invalid" | "duplicate" | "warning";

export function ValidationTable({
  preview,
  program,
  onConfirmImport,
  isImporting,
}: Props) {
  const [rows, setRows] = useState<ValidatedRow[]>(preview.validatedRows);
  const [filter, setFilter] = useState<Filter>("all");
  const schema = PROGRAM_SCHEMAS[program] ?? [];

  const selectedRows = rows.filter((r) => r.isSelected);
  const filtered = rows.filter((r) =>
    filter === "all" ? true : r.status === filter,
  );

  const toggle = (id: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id && r.status !== "invalid"
          ? { ...r, isSelected: !r.isSelected }
          : r,
      ),
    );

  const selectAll = (onlyValid = true) =>
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        isSelected: onlyValid ? r.status !== "invalid" : true,
      })),
    );

  const clearSel = () =>
    setRows((prev) => prev.map((r) => ({ ...r, isSelected: false })));

  return (
    <div className="mt-4 space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Valid" value={preview.summary.valid} color="emerald" />
        <Stat label="Invalid" value={preview.summary.invalid} color="red" />
        <Stat
          label="Duplicates"
          value={preview.summary.duplicates}
          color="amber"
        />
        <Stat
          label="Will Import"
          value={selectedRows.length}
          color="blue"
          emphasis
        />
      </div>

      {/* Filter / Select */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2">
        {(["all", "valid", "invalid", "duplicate", "warning"] as const).map(
          (f) => {
            const n =
              f === "all"
                ? rows.length
                : rows.filter((r) => r.status === f).length;
            if (f !== "all" && n === 0) return null;
            return (
              <button
                type="button"
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                  filter === f
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f} ({n})
              </button>
            );
          },
        )}
        <div className="ml-auto flex gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => selectAll(true)}
            className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 hover:bg-emerald-100"
          >
            Select valid
          </button>
          <button
            type="button"
            onClick={() => selectAll(false)}
            className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearSel}
            className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="max-h-[420px] space-y-1.5 overflow-y-auto">
        {filtered.map((row) => (
          <RowCard
            key={row.id}
            row={row}
            schema={schema}
            onToggle={() => toggle(row.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
            No rows match this filter.
          </div>
        )}
      </div>

      {/* Confirm */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
        <div className="text-sm">
          <div className="font-semibold text-gray-900">
            {selectedRows.length} row{selectedRows.length === 1 ? "" : "s"} selected
          </div>
          <div className="text-xs text-gray-500">
            {selectedRows.filter((r) => r.status === "duplicate").length} overwrites
            · {selectedRows.filter((r) => r.status === "valid").length} new inserts
          </div>
        </div>
        <button
          type="button"
          disabled={selectedRows.length === 0 || isImporting}
          onClick={() => onConfirmImport(selectedRows)}
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isImporting ? "Importing…" : `Import ${selectedRows.length} Rows →`}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  emphasis,
}: {
  label: string;
  value: number;
  color: "emerald" | "red" | "amber" | "blue";
  emphasis?: boolean;
}) {
  const c = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  }[color];
  return (
    <div
      className={`rounded-xl border-[1.5px] p-2.5 text-center ${c} ${emphasis ? "ring-2 ring-blue-500/30" : ""}`}
    >
      <div className="text-xl font-bold leading-tight">{value}</div>
      <div className="text-[10px] font-medium opacity-70">{label}</div>
    </div>
  );
}

function RowCard({
  row,
  schema,
  onToggle,
}: {
  row: ValidatedRow;
  schema: FieldDef[];
  onToggle: () => void;
}) {
  const statusStyle = {
    valid: "border-emerald-200",
    invalid: "border-red-300 bg-red-50",
    duplicate: "border-amber-300 bg-amber-50",
    warning: "border-amber-200 bg-amber-50/50",
  }[row.status];

  const badge = {
    valid: { label: "✓ Valid", cls: "bg-emerald-100 text-emerald-700" },
    invalid: { label: "✕ Invalid", cls: "bg-red-100 text-red-700" },
    duplicate: { label: "⚡ Duplicate", cls: "bg-amber-100 text-amber-800" },
    warning: { label: "⚠ Warning", cls: "bg-amber-100 text-amber-800" },
  }[row.status];

  return (
    <div
      className={`rounded-lg border-[1.5px] bg-white p-2.5 transition ${statusStyle} ${row.isSelected ? "ring-2 ring-blue-500" : ""}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={row.isSelected}
          disabled={row.status === "invalid"}
          onChange={onToggle}
          className="h-4 w-4 accent-blue-600"
        />
        <span className="text-xs font-medium text-gray-500">
          Row {row.rowIndex + 1}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {row.errors.map((e, i) => (
            <span
              key={i}
              className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700"
            >
              {e.field}: {e.message}
            </span>
          ))}
          {row.warnings.map((w, i) => (
            <span
              key={i}
              className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800"
            >
              {w.field}: {w.message}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-3 lg:grid-cols-4">
        {schema.map((field) => {
          const v = row.data[field.key];
          const err = row.errors.some((e) => e.field === field.key);
          const warn = row.warnings.some((w) => w.field === field.key);
          return (
            <div
              key={field.key}
              className={`flex flex-col rounded px-1.5 py-1 text-[11px] ${err ? "bg-red-100" : warn ? "bg-amber-100" : ""}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                {field.label}
              </span>
              <span className="truncate text-gray-800">
                {v || <em className="text-gray-400">empty</em>}
              </span>
            </div>
          );
        })}
      </div>

      {row.status === "duplicate" && row.duplicateMatch && (
        <div className="mt-2 rounded-lg bg-white/70 p-2 text-xs">
          <div className="mb-1 text-[10px] font-semibold uppercase text-amber-800">
            ⚡ Matches existing record
          </div>
          <div className="space-y-0.5">
            {schema.slice(0, 4).map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-[110px_1fr_1fr] gap-2 text-[11px]"
              >
                <span className="text-gray-500">{field.label}</span>
                <span className="truncate text-blue-700">
                  New: {row.data[field.key] || "—"}
                </span>
                <span className="truncate text-gray-500">
                  Existing: {row.duplicateMatch![field.key] || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
