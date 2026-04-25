"use client";

import { PROGRAM_LIST, PROGRAM_META } from "@/lib/import/programSchemas";

type Props = {
  value: string | "all";
  onChange: (program: string | "all") => void;
  counts?: Record<string, number>;
};

export function ProgramSelector({ value, onChange, counts }: Props) {
  const allCount =
    counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;

  return (
    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-medium transition ${
          value === "all"
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
        }`}
      >
        All
        {allCount !== undefined && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              value === "all" ? "bg-white/20" : "bg-gray-200 text-gray-600"
            }`}
          >
            {allCount}
          </span>
        )}
      </button>

      {PROGRAM_LIST.map((p) => {
        const meta = PROGRAM_META[p];
        const active = value === p;
        const count = counts?.[p];
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            style={
              active
                ? { background: meta.soft, borderColor: meta.color, color: meta.color }
                : undefined
            }
            className={`flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-medium transition ${
              active
                ? ""
                : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: meta.color }}
            />
            {meta.label}
            {count !== undefined && count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? "bg-white/60" : "bg-gray-200 text-gray-600"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
