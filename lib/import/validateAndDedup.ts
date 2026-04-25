import type { FieldError } from "./validator";
import { autoMapColumns, remapRows, validateRow } from "./validator";
import { buildFingerprint, detectDuplicates } from "./duplicateDetector";
import { PROGRAM_SCHEMAS } from "./programSchemas";

export type ValidatedRow = {
  id: string;
  rowIndex: number;
  data: Record<string, string>;
  status: "valid" | "invalid" | "duplicate" | "warning";
  errors: FieldError[];
  warnings: FieldError[];
  duplicateOf?: string;
  duplicateMatch?: Record<string, string>;
  isSelected: boolean;
};

export type ImportPreview = {
  sourceColumns: string[];
  rawRows: Record<string, string>[];
  mapping: Record<string, string>;
  validatedRows: ValidatedRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    warnings: number;
    willInsert: number;
  };
};

export function buildPreview(
  rawRows: Record<string, string>[],
  sourceColumns: string[],
  program: string,
  existingFingerprints: Array<{
    fingerprint: string;
    rowData: Record<string, string>;
  }>,
  providedMapping?: Record<string, string>,
): ImportPreview {
  const schema = PROGRAM_SCHEMAS[program] ?? [];
  const mapping =
    providedMapping ??
    (sourceColumns.length
      ? autoMapColumns(sourceColumns, schema)
      : Object.fromEntries(schema.map((f) => [f.key, f.key])));

  const mapped = sourceColumns.length
    ? remapRows(rawRows, mapping, schema)
    : rawRows;

  const duplicateChecks = detectDuplicates(
    mapped,
    program,
    existingFingerprints,
  );

  const validated: ValidatedRow[] = mapped.map((row, i) => {
    const { errors, warnings } = validateRow(row, schema);
    const dup = duplicateChecks[i];

    let status: ValidatedRow["status"] = "valid";
    if (errors.length > 0) status = "invalid";
    else if (dup.isDuplicate) status = "duplicate";
    else if (warnings.length > 0) status = "warning";

    return {
      id: `row-${i}`,
      rowIndex: i,
      data: row,
      status,
      errors,
      warnings,
      duplicateOf: dup.isDuplicate ? `existing-${i}` : undefined,
      duplicateMatch: dup.matchedRow,
      isSelected: status === "valid" || status === "warning",
    };
  });

  const summary = {
    total: validated.length,
    valid: validated.filter((r) => r.status === "valid").length,
    invalid: validated.filter((r) => r.status === "invalid").length,
    duplicates: validated.filter((r) => r.status === "duplicate").length,
    warnings: validated.filter((r) => r.status === "warning").length,
    willInsert: validated.filter((r) => r.isSelected).length,
  };

  return { sourceColumns, rawRows, mapping, validatedRows: validated, summary };
}

export function fingerprintsFromRows(
  rows: Record<string, string>[],
  program: string,
): Array<{ fingerprint: string; rowData: Record<string, string> }> {
  return rows.map((r) => ({
    fingerprint: buildFingerprint(r, program),
    rowData: r,
  }));
}
