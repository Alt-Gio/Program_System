import type { FieldDef } from "./programSchemas";
import { PROGRAM_SCHEMAS } from "./programSchemas";

export type FieldError = { field: string; message: string };

export function validateRow(
  row: Record<string, string>,
  schema: FieldDef[],
): { errors: FieldError[]; warnings: FieldError[] } {
  const errors: FieldError[] = [];
  const warnings: FieldError[] = [];

  for (const field of schema) {
    const raw = row[field.key];
    const value = raw == null ? "" : String(raw).trim();

    if (field.required && !value) {
      errors.push({ field: field.key, message: "Required" });
      continue;
    }
    if (!value) continue;

    switch (field.type) {
      case "number": {
        const n = Number(value.replace(/,/g, ""));
        if (Number.isNaN(n)) {
          errors.push({ field: field.key, message: "Must be a number" });
        }
        break;
      }
      case "date": {
        const d = parseLooseDate(value);
        if (!d) {
          errors.push({ field: field.key, message: "Invalid date" });
        }
        break;
      }
      case "email": {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({ field: field.key, message: "Invalid email" });
        }
        break;
      }
      case "select": {
        if (field.options && !field.options.includes(value)) {
          warnings.push({
            field: field.key,
            message: `Not in options (${field.options.join("/")})`,
          });
        }
        break;
      }
      case "phone": {
        if (!/^[0-9+\-\s()]{7,}$/.test(value)) {
          warnings.push({ field: field.key, message: "Unusual phone format" });
        }
        break;
      }
      case "text":
      default:
        if (field.maxLength && value.length > field.maxLength) {
          warnings.push({
            field: field.key,
            message: `Over ${field.maxLength} chars`,
          });
        }
        if (field.pattern && !field.pattern.test(value)) {
          errors.push({ field: field.key, message: "Does not match pattern" });
        }
    }
  }

  return { errors, warnings };
}

export function getProgramSchema(program: string): FieldDef[] {
  return PROGRAM_SCHEMAS[program] ?? [];
}

// Accepts ISO, slashes, or "April 20, 2026" forms
export function parseLooseDate(input: string): Date | null {
  if (!input) return null;
  const s = input.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    const [, m, d, y] = slash;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function autoMapColumns(
  sourceColumns: string[],
  schema: FieldDef[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const sourceNorm = sourceColumns.map((s) => ({ raw: s, norm: normalize(s) }));

  for (const field of schema) {
    const keyNorm = normalize(field.key);
    const labelNorm = normalize(field.label);

    const hit =
      sourceColumns.find((s) => s === field.key) ??
      sourceColumns.find((s) => s.toLowerCase() === field.key.toLowerCase()) ??
      sourceNorm.find((s) => s.norm === keyNorm || s.norm === labelNorm)?.raw ??
      sourceNorm.find(
        (s) =>
          s.norm.includes(keyNorm) ||
          keyNorm.includes(s.norm) ||
          s.norm.includes(labelNorm) ||
          labelNorm.includes(s.norm),
      )?.raw;

    if (hit) mapping[field.key] = hit;
  }
  return mapping;
}

export function remapRows(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  schema: FieldDef[],
): Record<string, string>[] {
  return rows.map((r) => {
    const next: Record<string, string> = {};
    for (const field of schema) {
      const src = mapping[field.key];
      next[field.key] = src ? (r[src] ?? "") : "";
    }
    return next;
  });
}
