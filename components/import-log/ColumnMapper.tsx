"use client";

import { useEffect, useState } from "react";
import type { FieldDef } from "@/lib/import/programSchemas";
import { autoMapColumns } from "@/lib/import/validator";

type Props = {
  sourceColumns: string[];
  targetSchema: FieldDef[];
  initialMapping?: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
};

export function ColumnMapper({
  sourceColumns,
  targetSchema,
  initialMapping,
  onMappingChange,
}: Props) {
  const [mapping, setMapping] = useState<Record<string, string>>(
    initialMapping ?? autoMapColumns(sourceColumns, targetSchema),
  );

  useEffect(() => {
    setMapping(initialMapping ?? autoMapColumns(sourceColumns, targetSchema));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceColumns.join("|")]);

  const update = (key: string, val: string) => {
    const next = { ...mapping, [key]: val };
    setMapping(next);
    onMappingChange(next);
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900">Column Mapping</div>
        <div className="text-xs text-gray-500">
          Match your file columns to the expected fields.
        </div>
      </div>

      <div className="space-y-1.5">
        {targetSchema.map((field) => {
          const mapped = mapping[field.key];
          return (
            <div
              key={field.key}
              className="grid grid-cols-[1fr_auto_1.2fr_auto] items-center gap-2 text-sm"
            >
              <div className="truncate text-gray-700">
                {field.label}
                {field.required && (
                  <span className="ml-1 text-red-500">●</span>
                )}
              </div>
              <div className="text-gray-400">→</div>
              <select
                value={mapped ?? ""}
                onChange={(e) => update(field.key, e.target.value)}
                className={`rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  mapped
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : field.required
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-gray-300 bg-gray-50 text-gray-700"
                }`}
              >
                <option value="">— not mapped —</option>
                {sourceColumns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span
                className={`text-[10px] font-medium ${
                  mapped
                    ? "text-emerald-600"
                    : field.required
                      ? "text-red-600"
                      : "text-gray-400"
                }`}
              >
                {mapped ? "✓" : field.required ? "Required" : "Optional"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
