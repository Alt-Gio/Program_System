// ============================================================
// Google Sheets Integration � DICT Region V PMS
// ============================================================

import { DICT_PROJECTS, ProjectDefinition, MONTHS } from "./types";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// ---- Import from Google Sheets ---------------------------

export async function importFromGoogleSheet(params: {
  sheetId: string;
  sheetName: string;
  projectCode: string;
  accessToken: string;
  defaultYear?: number;
}): Promise<{ rows: ParsedSheetRow[]; errors: Array<{ row: number; message: string }> }> {
  const project = DICT_PROJECTS.find(p => p.code === params.projectCode);
  if (!project) throw new Error(`Unknown project code: ${params.projectCode}`);
  const range = `${params.sheetName}!A1:ZZ`;
  const url = `${SHEETS_API_BASE}/${params.sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const values: string[][] = data.values ?? [];
  if (values.length < 2) return { rows: [], errors: [] };
  const headers = values[0].map(h => h.trim());
  const dataRows = values.slice(1);
  const rows: ParsedSheetRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const reverseMap: Record<string, string> = {};
  for (const [ourField, sheetHeader] of Object.entries(project.sheetsColumnMap)) {
    reverseMap[sheetHeader.toLowerCase()] = ourField;
  }
  dataRows.forEach((row, idx) => {
    try {
      const rowObj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const ourField = reverseMap[h.toLowerCase()];
        if (ourField) rowObj[ourField] = row[i] ?? "";
      });
      if (!rowObj.activityTitle && !rowObj.venue) return;
      rows.push(parseSheetRow(rowObj, params.defaultYear ?? new Date().getFullYear(), project));
    } catch (e: unknown) {
      errors.push({ row: idx + 2, message: String(e) });
    }
  });
  return { rows, errors };
}

export interface ParsedSheetRow {
  month: number;
  year: number;
  provinceName: string;
  lguName?: string;
  activityTitle: string;
  venue: string;
  partnerOrganizations: string[];
  startDate: string;
  endDate: string;
  modeOfConduct: string;
  personnelRaw: string;
  participants: {
    nga: { male: number; female: number };
    lgu: { male: number; female: number };
    suc: { male: number; female: number };
    others: { male: number; female: number; label?: string };
  };
  afterActivityReport: string;
  fbPostingLink: string;
  rawPhotosLink: string;
  remarks: string;
  extraFields: Record<string, string | number>;
  status: string;
}

function parseSheetRow(row: Record<string, string>, defaultYear: number, project: ProjectDefinition): ParsedSheetRow {
  let month = 1;
  if (row.month) {
    const idx = MONTHS.findIndex(m => m.toLowerCase() === row.month.toLowerCase().trim());
    if (idx >= 0) month = idx + 1;
    else if (!isNaN(Number(row.month))) month = Number(row.month);
  }
  const startDate = parseDate(row.startDate) ?? `${defaultYear}-${String(month).padStart(2, "0")}-01`;
  const endDate = parseDate(row.endDate) ?? startDate;
  const partners = (row.partnerOrganizations ?? "").split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const participants = {
    nga: { male: toNum(row.ngaMale), female: toNum(row.ngaFemale) },
    lgu: { male: toNum(row.lguMale), female: toNum(row.lguFemale) },
    suc: { male: toNum(row.sucMale), female: toNum(row.sucFemale) },
    others: { male: toNum(row.othersMale), female: toNum(row.othersFemale), label: row.othersLabel },
  };
  const extraFields: Record<string, string | number> = {};
  for (const field of project.extraFieldSchema) {
    if (row[field.key] !== undefined) {
      extraFields[field.key] = field.type === "number" ? toNum(row[field.key]) : row[field.key];
    }
  }
  return {
    month, year: defaultYear,
    provinceName: row.province ?? "",
    lguName: row.lgu,
    activityTitle: row.activityTitle ?? "",
    venue: row.venue ?? "",
    partnerOrganizations: partners,
    startDate, endDate,
    modeOfConduct: row.modeOfConduct ?? "On-Site",
    personnelRaw: row.personnelRaw ?? "",
    participants,
    afterActivityReport: row.afterActivityReport ?? "",
    fbPostingLink: row.fbPostingLink ?? "",
    rawPhotosLink: row.rawPhotosLink ?? "",
    remarks: row.remarks ?? "",
    extraFields,
    status: row.status ?? "Submitted",
  };
}

// ---- Export to Google Sheets ----------------------------

export interface ExportActivity {
  _id: string;
  month: number;
  year: number;
  provinceName: string;
  lguName?: string;
  activityTitle: string;
  venue: string;
  partnerOrganizations: string[];
  startDate: string;
  endDate: string;
  modeOfConduct: string;
  personnelRaw?: string;
  participants: {
    nga: { male: number; female: number };
    lgu: { male: number; female: number };
    suc: { male: number; female: number };
    others: { male: number; female: number; label?: string };
  };
  status: string;
  afterActivityReport?: string;
  fbPostingLink?: string;
  remarks?: string;
  extraFields?: string;
}

export async function exportToGoogleSheet(params: {
  title: string;
  activities: ExportActivity[];
  projectCode: string;
  accessToken: string;
  existingSheetId?: string;
}): Promise<string> {
  const project = DICT_PROJECTS.find(p => p.code === params.projectCode);
  if (!project) throw new Error(`Unknown project: ${params.projectCode}`);
  const headers = buildExportHeaders(project);
  const rows = params.activities.map(a => buildExportRow(a, project));
  const values = [headers, ...rows];
  let sheetId = params.existingSheetId;
  if (!sheetId) {
    const createRes = await fetch(SHEETS_API_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { title: params.title },
        sheets: [
          { properties: { title: "Activities", index: 0 } },
          { properties: { title: "Summary", index: 1 } },
          { properties: { title: "By Province", index: 2 } },
        ],
      }),
    });
    if (!createRes.ok) throw new Error(`Failed to create sheet: ${createRes.statusText}`);
    const sheet = await createRes.json();
    sheetId = sheet.spreadsheetId;
    await applySheetFormatting(sheetId!, project.color, params.accessToken);
  }
  await writeSheetValues(sheetId!, "Activities!A1", values, params.accessToken);
  await writeSheetValues(sheetId!, "Summary!A1", buildSummarySheet(params.activities, project), params.accessToken);
  await writeSheetValues(sheetId!, "By Province!A1", buildProvinceSheet(params.activities), params.accessToken);
  return `https://docs.google.com/spreadsheets/d/${sheetId}`;
}

function buildExportHeaders(project: ProjectDefinition): string[] {
  const base = [
    "Record ID", "Month", "Year", "Province", "LGU/Municipality",
    "Activity Title", "Venue", "Partner Organizations",
    "Start Date", "End Date", "Mode of Conduct", "DICT Personnel",
    "NGA Male", "NGA Female", "LGU Male", "LGU Female",
    "SUC Male", "SUC Female", "Others Male", "Others Female",
    "Others Category", "Total Participants",
    "Status", "After Activity Report", "FB Posting Link", "Remarks", "FY",
  ];
  return [...base, ...project.extraFieldSchema.map(f => f.label)];
}

function buildExportRow(a: ExportActivity, project: ProjectDefinition): (string | number)[] {
  const total =
    a.participants.nga.male + a.participants.nga.female +
    a.participants.lgu.male + a.participants.lgu.female +
    a.participants.suc.male + a.participants.suc.female +
    a.participants.others.male + a.participants.others.female;
  const extra = parseExtraFields(a.extraFields);
  const base: (string | number)[] = [
    a._id, MONTHS[a.month - 1] ?? a.month, a.year, a.provinceName, a.lguName ?? "",
    a.activityTitle, a.venue, a.partnerOrganizations.join(", "),
    a.startDate, a.endDate, a.modeOfConduct, a.personnelRaw ?? "",
    a.participants.nga.male, a.participants.nga.female,
    a.participants.lgu.male, a.participants.lgu.female,
    a.participants.suc.male, a.participants.suc.female,
    a.participants.others.male, a.participants.others.female,
    a.participants.others.label ?? "Others", total,
    a.status, a.afterActivityReport ?? "", a.fbPostingLink ?? "", a.remarks ?? "",
    `FY ${a.year}`,
  ];
  return [...base, ...project.extraFieldSchema.map(f => extra[f.key] ?? "")];
}

function buildSummarySheet(activities: ExportActivity[], project: ProjectDefinition): (string | number)[][] {
  const rows: (string | number)[][] = [
    [`Summary � ${project.name}`], [],
    ["Metric", "Value"],
    ["Total Activities", activities.length],
    ["Total Participants", activities.reduce((sum, a) =>
      sum + a.participants.nga.male + a.participants.nga.female +
      a.participants.lgu.male + a.participants.lgu.female +
      a.participants.suc.male + a.participants.suc.female +
      a.participants.others.male + a.participants.others.female, 0)],
    ["Provinces Covered", [...new Set(activities.map(a => a.provinceName))].length],
    [], ["Month", "No. of Activities", "Total Participants"],
  ];
  const byMonth: Record<number, { count: number; participants: number }> = {};
  for (const a of activities) {
    if (!byMonth[a.month]) byMonth[a.month] = { count: 0, participants: 0 };
    byMonth[a.month].count++;
    byMonth[a.month].participants +=
      a.participants.nga.male + a.participants.nga.female + a.participants.lgu.male +
      a.participants.lgu.female + a.participants.suc.male + a.participants.suc.female +
      a.participants.others.male + a.participants.others.female;
  }
  for (let m = 1; m <= 12; m++) {
    rows.push([MONTHS[m - 1], byMonth[m]?.count ?? 0, byMonth[m]?.participants ?? 0]);
  }
  return rows;
}

function buildProvinceSheet(activities: ExportActivity[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Province", "No. of Activities", "NGA", "LGU", "SUC", "Others", "Total Participants"],
  ];
  const byProvince: Record<string, { count: number; nga: number; lgu: number; suc: number; others: number }> = {};
  for (const a of activities) {
    const k = a.provinceName;
    if (!byProvince[k]) byProvince[k] = { count: 0, nga: 0, lgu: 0, suc: 0, others: 0 };
    byProvince[k].count++;
    byProvince[k].nga += a.participants.nga.male + a.participants.nga.female;
    byProvince[k].lgu += a.participants.lgu.male + a.participants.lgu.female;
    byProvince[k].suc += a.participants.suc.male + a.participants.suc.female;
    byProvince[k].others += a.participants.others.male + a.participants.others.female;
  }
  for (const [province, data] of Object.entries(byProvince)) {
    const total = data.nga + data.lgu + data.suc + data.others;
    rows.push([province, data.count, data.nga, data.lgu, data.suc, data.others, total]);
  }
  return rows;
}

async function writeSheetValues(sheetId: string, range: string, values: (string | number)[][], accessToken: string) {
  await fetch(
    `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    }
  );
}

async function applySheetFormatting(sheetId: string, hexColor: string, accessToken: string) {
  const rgb = hexToRgb(hexColor);
  await fetch(`${SHEETS_API_BASE}/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        { repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: {
                backgroundColor: rgb,
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
            }},
            fields: "userEnteredFormat(backgroundColor,textFormat)",
        }},
        { updateSheetProperties: {
            properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
        }},
      ],
    }),
  });
}

function parseDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function toNum(v?: string): number {
  if (!v) return 0;
  const n = Number(v.replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

function parseExtraFields(json?: string): Record<string, string | number> {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

function hexToRgb(hex: string) {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
  };
}
