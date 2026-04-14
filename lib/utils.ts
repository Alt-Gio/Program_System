import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | undefined, fmt = "MMM d, yyyy") {
  if (!dateStr) return "�";
  try { return format(parseISO(dateStr), fmt); } catch { return dateStr; }
}

export function formatDateShort(dateStr: string | undefined) {
  return formatDate(dateStr, "MM/dd/yyyy");
}

export function numberWithCommas(n: number) {
  return n.toLocaleString("en-PH");
}

export function getCompletionRate(completed: number, total: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function pluralize(count: number, word: string, plural?: string) {
  return count === 1 ? `${count} ${word}` : `${count} ${plural ?? word + "s"}`;
}

export function truncate(str: string, maxLen: number) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "�";
}

export function calcTotal(p: {
  nga: { male: number; female: number };
  lgu: { male: number; female: number };
  suc: { male: number; female: number };
  others: { male: number; female: number };
}): number {
  return p.nga.male + p.nga.female + p.lgu.male + p.lgu.female +
    p.suc.male + p.suc.female + p.others.male + p.others.female;
}

export function calcMale(p: {
  nga: { male: number };
  lgu: { male: number };
  suc: { male: number };
  others: { male: number };
}): number {
  return p.nga.male + p.lgu.male + p.suc.male + p.others.male;
}

export function calcFemale(p: {
  nga: { female: number };
  lgu: { female: number };
  suc: { female: number };
  others: { female: number };
}): number {
  return p.nga.female + p.lgu.female + p.suc.female + p.others.female;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Reported":  return "bg-green-100 text-green-800 border-green-200";
    case "Validated": return "bg-blue-100 text-blue-800 border-blue-200";
    case "Submitted": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Draft":     return "bg-gray-100 text-gray-600 border-gray-200";
    default:          return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function getMonthLabel(month: number): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[month - 1] ?? String(month);
}

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
