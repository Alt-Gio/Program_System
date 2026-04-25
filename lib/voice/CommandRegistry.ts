// =============================================================
// Voice Command Registry
// All supported intents, entity schemas, and routing constants.
// =============================================================

export type CommandCategory =
  | "navigation"
  | "data_query"
  | "data_write"
  | "form_fill"
  | "ui_action"
  | "import"
  | "report"
  | "filter_sort"
  | "system";

export type IntentAction =
  // Navigation
  | "go_to_dashboard"
  | "go_to_activities"
  | "go_to_interns"
  | "go_to_attendance"
  | "go_to_map"
  | "go_to_personnel"
  | "go_to_reports"
  | "go_to_settings"
  | "go_to_project"
  | "go_to_import_log"
  | "go_back"
  // Data query
  | "show_statistics"
  | "count_activities"
  | "count_interns"
  | "count_personnel"
  | "find_activity"
  | "find_intern"
  | "check_attendance"
  | "show_today_activities"
  | "show_program_summary"
  | "query_activities_this_month"
  | "query_activities_this_year"
  | "query_activities_total"
  // Data write
  | "add_activity"
  | "add_intern"
  | "update_activity"
  | "delete_activity"
  | "mark_attendance"
  // Form fill
  | "fill_activity_form"
  | "fill_intern_form"
  // UI actions
  | "open_activity"
  | "sort_table"
  | "filter_table"
  | "search"
  | "close_modal"
  | "confirm_action"
  | "cancel_action"
  // Import
  | "import_data"
  | "import_activities"
  | "import_interns"
  // Report
  | "generate_report"
  | "export_report"
  // System
  | "help"
  | "stop_listening"
  // Fallback
  | "unknown";

export type IntentEntities = {
  programCode?: string;
  activityName?: string;
  internName?: string;
  date?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filterField?: string;
  filterValue?: string;
  searchQuery?: string;
  formData?: Record<string, string>;
  importSource?: "sheets" | "csv" | "clipboard";
  reportType?: string;
  quantity?: number;
};

export type ParsedIntent = {
  action: IntentAction;
  category: CommandCategory;
  confidence: number;
  entities: IntentEntities;
  rawTranscript: string;
  fallbackMessage?: string;
};

export const ALL_ACTIONS: IntentAction[] = [
  "go_to_dashboard",
  "go_to_activities",
  "go_to_interns",
  "go_to_attendance",
  "go_to_map",
  "go_to_personnel",
  "go_to_reports",
  "go_to_settings",
  "go_to_project",
  "go_to_import_log",
  "go_back",
  "show_statistics",
  "count_activities",
  "count_interns",
  "count_personnel",
  "find_activity",
  "find_intern",
  "check_attendance",
  "show_today_activities",
  "show_program_summary",
  "query_activities_this_month",
  "query_activities_this_year",
  "query_activities_total",
  "add_activity",
  "add_intern",
  "update_activity",
  "delete_activity",
  "mark_attendance",
  "fill_activity_form",
  "fill_intern_form",
  "open_activity",
  "sort_table",
  "filter_table",
  "search",
  "close_modal",
  "confirm_action",
  "cancel_action",
  "import_data",
  "import_activities",
  "import_interns",
  "generate_report",
  "export_report",
  "help",
  "stop_listening",
  "unknown",
];

// Programs recognized in speech (the IntentParser normalizes to these)
export const PROGRAM_CODES = [
  "eGovPH",
  "eLGU",
  "Free WiFi",
  "GovNet",
  "NBP",
  "Cybersecurity",
  "PNPKI",
  "DRRM",
  "ILCDB",
  "IIDB",
  "SPARK",
  "DWIA",
];

export const NAV_ROUTE_MAP: Record<string, string> = {
  go_to_dashboard: "/dashboard",
  go_to_activities: "/activities",
  go_to_interns: "/interns",
  go_to_attendance: "/attendance-overview",
  go_to_map: "/map",
  go_to_personnel: "/personnel",
  go_to_reports: "/reports",
  go_to_settings: "/settings",
  go_to_import_log: "/import-log",
};

export const COMMAND_EXAMPLES: Array<{
  say: string;
  action: IntentAction;
  entities?: IntentEntities;
}> = [
  // Navigation
  { say: "go to dashboard", action: "go_to_dashboard" },
  { say: "take me to activities", action: "go_to_activities" },
  { say: "open the interns page", action: "go_to_interns" },
  { say: "show me attendance", action: "go_to_attendance" },
  { say: "open the map", action: "go_to_map" },
  { say: "go to personnel", action: "go_to_personnel" },
  { say: "open reports", action: "go_to_reports" },
  { say: "open settings", action: "go_to_settings" },
  { say: "go to SPARK project", action: "go_to_project", entities: { programCode: "SPARK" } },
  { say: "open eGovPH program", action: "go_to_project", entities: { programCode: "eGovPH" } },
  { say: "open import log", action: "go_to_import_log" },
  { say: "show activity log", action: "go_to_import_log" },
  { say: "go back", action: "go_back" },

  // Data queries
  { say: "how many activities today", action: "show_today_activities" },
  { say: "show me today's activities", action: "show_today_activities" },
  { say: "how many activities this month", action: "query_activities_this_month" },
  { say: "how many activities this year", action: "query_activities_this_year" },
  { say: "total number of activities", action: "query_activities_total" },
  { say: "how many interns do we have", action: "count_interns" },
  { say: "how many personnel", action: "count_personnel" },
  { say: "show statistics", action: "show_statistics" },
  { say: "find the activity about social media", action: "find_activity", entities: { activityName: "social media" } },
  { say: "check attendance for today", action: "check_attendance", entities: { date: "today" } },
  { say: "show SPARK program summary", action: "show_program_summary", entities: { programCode: "SPARK" } },

  // Data write
  { say: "add an activity", action: "add_activity" },
  { say: "add a new activity for SPARK", action: "add_activity", entities: { programCode: "SPARK" } },
  { say: "add a new intern", action: "add_intern" },
  { say: "mark Juan de la Cruz as present today", action: "mark_attendance", entities: { internName: "Juan de la Cruz", date: "today" } },

  // UI actions
  { say: "open the first activity", action: "open_activity", entities: { quantity: 1 } },
  { say: "sort by date newest first", action: "sort_table", entities: { sortBy: "date", sortOrder: "desc" } },
  { say: "sort alphabetically", action: "sort_table", entities: { sortBy: "name", sortOrder: "asc" } },
  { say: "filter by SPARK program", action: "filter_table", entities: { filterField: "program", filterValue: "SPARK" } },
  { say: "search for digital marketing", action: "search", entities: { searchQuery: "digital marketing" } },
  { say: "close this", action: "close_modal" },
  { say: "yes confirm", action: "confirm_action" },
  { say: "cancel", action: "cancel_action" },

  // Import
  { say: "import data from Google Sheets", action: "import_data", entities: { importSource: "sheets" } },
  { say: "import activities from CSV", action: "import_activities", entities: { importSource: "csv" } },
  { say: "import interns list", action: "import_interns" },
  { say: "import data for eGovPH", action: "import_data", entities: { programCode: "eGovPH" } },

  // Report
  { say: "generate report", action: "generate_report" },
  { say: "generate quarterly report for SPARK", action: "generate_report", entities: { programCode: "SPARK" } },
  { say: "export this report to sheets", action: "export_report", entities: { importSource: "sheets" } },

  // System
  { say: "help", action: "help" },
  { say: "what can you do", action: "help" },
  { say: "stop listening", action: "stop_listening" },
  { say: "sleep", action: "stop_listening" },
];

export const ACTION_CATEGORY: Record<IntentAction, CommandCategory> = {
  go_to_dashboard: "navigation",
  go_to_activities: "navigation",
  go_to_interns: "navigation",
  go_to_attendance: "navigation",
  go_to_map: "navigation",
  go_to_personnel: "navigation",
  go_to_reports: "navigation",
  go_to_settings: "navigation",
  go_to_project: "navigation",
  go_to_import_log: "navigation",
  go_back: "navigation",
  show_statistics: "data_query",
  count_activities: "data_query",
  count_interns: "data_query",
  count_personnel: "data_query",
  find_activity: "data_query",
  find_intern: "data_query",
  check_attendance: "data_query",
  show_today_activities: "data_query",
  show_program_summary: "data_query",
  query_activities_this_month: "data_query",
  query_activities_this_year: "data_query",
  query_activities_total: "data_query",
  add_activity: "data_write",
  add_intern: "data_write",
  update_activity: "data_write",
  delete_activity: "data_write",
  mark_attendance: "data_write",
  fill_activity_form: "form_fill",
  fill_intern_form: "form_fill",
  open_activity: "ui_action",
  sort_table: "filter_sort",
  filter_table: "filter_sort",
  search: "ui_action",
  close_modal: "ui_action",
  confirm_action: "ui_action",
  cancel_action: "ui_action",
  import_data: "import",
  import_activities: "import",
  import_interns: "import",
  generate_report: "report",
  export_report: "report",
  help: "system",
  stop_listening: "system",
  unknown: "system",
};
