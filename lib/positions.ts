// ============================================================
// DICT / Philippine government plantilla & common office positions.
// Used to seed the Position combobox on /attendance/register and any
// other place that needs a position picker. Merge these with the
// distinct positions already stored in `personnel` (api.personnel.listPositions)
// and de-duplicate so typed-in custom positions are preserved.
// ============================================================

export const DICT_POSITIONS: string[] = [
  // ── Executive / Directorial ──
  "Undersecretary",
  "Assistant Secretary",
  "Director IV",
  "Director III",
  "Director II",
  "Director I",
  "Assistant Director",
  "Regional Director",
  "Assistant Regional Director",
  "Division Chief",
  "OIC - Regional Director",

  // ── Information Technology ──
  "Information Technology Officer III",
  "Information Technology Officer II",
  "Information Technology Officer I",
  "Information Systems Analyst III",
  "Information Systems Analyst II",
  "Information Systems Analyst I",
  "Computer Programmer III",
  "Computer Programmer II",
  "Computer Programmer I",
  "Computer Maintenance Technologist III",
  "Computer Maintenance Technologist II",
  "Computer Maintenance Technologist I",
  "Computer Operator III",
  "Computer Operator II",
  "Computer Operator I",
  "Network Administrator",
  "Systems Administrator",
  "Database Administrator",
  "Web Developer",
  "Software Developer",
  "Data Analyst",
  "Data Scientist",
  "Cybersecurity Specialist",
  "IT Support Specialist",
  "Technical Support Specialist",
  "Quality Assurance Specialist",
  "UI/UX Designer",
  "DevOps Engineer",

  // ── Engineering & Science ──
  "Engineer III",
  "Engineer II",
  "Engineer I",
  "Electronics Engineer",
  "Telecommunications Engineer",
  "Project Engineer",
  "Senior Science Research Specialist",
  "Science Research Specialist II",
  "Science Research Specialist I",
  "Science Research Analyst",
  "Science Aide",

  // ── Project & Program Management ──
  "Project Manager",
  "Project Development Officer V",
  "Project Development Officer IV",
  "Project Development Officer III",
  "Project Development Officer II",
  "Project Development Officer I",
  "Project Evaluation Officer III",
  "Project Evaluation Officer II",
  "Project Evaluation Officer I",
  "Project Technical Specialist",
  "Program Coordinator",
  "Community Development Officer III",
  "Community Development Officer II",
  "Community Development Officer I",

  // ── Planning, Statistics & Policy ──
  "Planning Officer III",
  "Planning Officer II",
  "Planning Officer I",
  "Statistician III",
  "Statistician II",
  "Statistician I",
  "Economist III",
  "Economist II",
  "Policy Analyst",

  // ── Administrative & Support ──
  "Chief Administrative Officer",
  "Supervising Administrative Officer",
  "Administrative Officer V",
  "Administrative Officer IV",
  "Administrative Officer III",
  "Administrative Officer II",
  "Administrative Officer I",
  "Administrative Assistant VI",
  "Administrative Assistant V",
  "Administrative Assistant IV",
  "Administrative Assistant III",
  "Administrative Assistant II",
  "Administrative Assistant I",
  "Administrative Aide VI",
  "Administrative Aide IV",
  "Administrative Aide III",
  "Administrative Aide I",
  "Executive Assistant",
  "Secretary",
  "Clerk",
  "Data Encoder",

  // ── Finance, HR & Legal ──
  "Accountant III",
  "Accountant II",
  "Accountant I",
  "Budget Officer III",
  "Budget Officer II",
  "Budget Officer I",
  "Cashier III",
  "Cashier II",
  "Cashier I",
  "Internal Auditor III",
  "Internal Auditor II",
  "Internal Auditor I",
  "Human Resource Management Officer III",
  "Human Resource Management Officer II",
  "Human Resource Management Officer I",
  "Attorney IV",
  "Attorney III",
  "Attorney II",
  "Legal Officer III",
  "Legal Officer II",
  "Legal Officer I",

  // ── Communications & Records ──
  "Information Officer III",
  "Information Officer II",
  "Information Officer I",
  "Public Relations Officer",
  "Communications Officer",
  "Graphic Artist",
  "Photographer",
  "Videographer",
  "Records Officer III",
  "Records Officer II",
  "Records Officer I",
  "Librarian II",
  "Librarian I",

  // ── Field, Logistics & Utility ──
  "Communications Equipment Operator III",
  "Communications Equipment Operator II",
  "Communications Equipment Operator I",
  "Driver II",
  "Driver I",
  "Security Guard III",
  "Security Guard II",
  "Security Guard I",
  "Utility Worker II",
  "Utility Worker I",
  "Warehouseman",
  "Storekeeper",

  // ── Trainees / Non-plantilla ──
  "Project Technical Assistant",
  "Technical Assistant",
  "Intern",
  "On-the-Job Trainee",
  "Job Order Personnel",
  "Contract of Service",
  "Consultant",
  "Volunteer",
];

/** Merge curated positions with any already-stored ones, de-duplicated and
 *  sorted. Custom (typed-in) positions are preserved. */
export function mergePositions(stored: string[] | undefined): string[] {
  const set = new Set<string>(DICT_POSITIONS);
  for (const p of stored ?? []) {
    const t = p?.trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
