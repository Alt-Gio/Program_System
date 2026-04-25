import Papa from "papaparse";

export type ParsedTable = {
  columns: string[];
  rows: Record<string, string>[];
};

export function parseCSVText(text: string): ParsedTable {
  // Detect tab-separated (from Excel/Sheets copy) vs comma-separated
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    firstLine.includes("\t") ? "\t" :
    firstLine.includes(";") && !firstLine.includes(",") ? ";" :
    ",";

  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (h) => h.trim(),
  });

  const columns =
    result.meta.fields?.map((f) => f.trim()).filter(Boolean) ?? [];

  const rows = (result.data ?? []).map((r) => {
    const clean: Record<string, string> = {};
    for (const c of columns) {
      const v = r[c];
      clean[c] = v == null ? "" : String(v).trim();
    }
    return clean;
  });

  return { columns, rows };
}

export async function parseCSVFile(file: File): Promise<ParsedTable> {
  const text = await file.text();
  return parseCSVText(text);
}

export function countRows(text: string): number {
  if (!text.trim()) return 0;
  // header + n data rows → n rows
  const lines = text.trim().split(/\r?\n/);
  return Math.max(0, lines.length - 1);
}
