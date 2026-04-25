import CryptoJS from "crypto-js";
import { DEDUP_KEYS } from "./programSchemas";

export function buildFingerprint(
  row: Record<string, string>,
  program: string,
): string {
  const keys = DEDUP_KEYS[program] ?? ["activityTitle", "date"];
  const normalized = keys
    .map((k) => (row[k] ?? "").toLowerCase().trim().replace(/\s+/g, " "))
    .join("|");
  return CryptoJS.MD5(normalized).toString();
}

export type DuplicateCheck = {
  rowIndex: number;
  isDuplicate: boolean;
  matchedRow?: Record<string, string>;
};

export function detectDuplicates(
  rows: Record<string, string>[],
  program: string,
  existingFingerprints: Array<{
    fingerprint: string;
    rowData: Record<string, string>;
  }>,
): DuplicateCheck[] {
  const existingMap = new Map(
    existingFingerprints.map((f) => [f.fingerprint, f.rowData]),
  );
  const intraBatch = new Map<string, number>();

  return rows.map((row, rowIndex) => {
    const fp = buildFingerprint(row, program);

    if (existingMap.has(fp)) {
      return { rowIndex, isDuplicate: true, matchedRow: existingMap.get(fp) };
    }
    if (intraBatch.has(fp)) {
      return {
        rowIndex,
        isDuplicate: true,
        matchedRow: rows[intraBatch.get(fp)!],
      };
    }
    intraBatch.set(fp, rowIndex);
    return { rowIndex, isDuplicate: false };
  });
}
