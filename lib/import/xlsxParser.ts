import type { ParsedTable } from "./csvParser";

// Dynamic import avoids bundling xlsx in non-xlsx flows.
export async function parseXLSXFile(file: File): Promise<ParsedTable> {
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch {
    throw new Error(
      "The 'xlsx' package is not installed. Run: npm install xlsx",
    );
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };
  const sheet = wb.Sheets[sheetName];

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (json.length === 0) return { columns: [], rows: [] };

  const columns = Object.keys(json[0]).map((c) => c.trim());
  const rows = json.map((r) => {
    const clean: Record<string, string> = {};
    for (const c of columns) {
      const v = r[c];
      clean[c] = v == null ? "" : String(v).trim();
    }
    return clean;
  });
  return { columns, rows };
}
