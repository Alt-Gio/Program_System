import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { IntentAction, ParsedIntent } from "./CommandRegistry";
import { NAV_ROUTE_MAP } from "./CommandRegistry";
import { emitVoiceEvent } from "./voiceEvents";

export type ActionResult = {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
  pending?: {
    action: IntentAction;
    description: string;
    data?: Record<string, any>;
  };
};

export type ExecutorContext = {
  router: AppRouterInstance;
  convex: ConvexReactClient;
};

export async function executeVoiceIntent(
  intent: ParsedIntent,
  ctx: ExecutorContext,
): Promise<ActionResult> {
  const { action, entities, confidence } = intent;

  if (confidence < 0.35 || action === "unknown") {
    return {
      success: false,
      message:
        intent.fallbackMessage ??
        `I heard "${intent.rawTranscript}" but didn't recognize the command.`,
    };
  }

  // Navigation
  const route = NAV_ROUTE_MAP[action];
  if (route) {
    ctx.router.push(route);
    return { success: true, message: navSpoken(action) };
  }
  if (action === "go_back") {
    ctx.router.back();
    return { success: true, message: "Going back." };
  }
  if (action === "go_to_project") {
    if (!entities.programCode) {
      return { success: false, message: "Which program should I open?" };
    }
    ctx.router.push(`/projects/${encodeURIComponent(entities.programCode)}`);
    return { success: true, message: `Opening ${entities.programCode}.` };
  }

  // Data queries (Convex)
  switch (action) {
    case "show_today_activities":
      return await queryActivitiesToday(ctx);
    case "query_activities_this_month":
      return await queryActivitiesThisMonth(ctx);
    case "query_activities_this_year":
      return await queryActivitiesThisYear(ctx);
    case "query_activities_total":
    case "count_activities":
      return await queryActivitiesTotal(ctx, entities.programCode);
    case "count_interns":
      return await countFromQuery(ctx, "interns", "intern");
    case "count_personnel":
      return await countFromQuery(ctx, "personnel", "personnel");
    case "show_statistics":
      return await showStatistics(ctx);
    case "find_activity":
      return await findActivity(
        ctx,
        entities.activityName ?? entities.searchQuery ?? "",
      );
    case "show_program_summary":
      return await programSummary(ctx, entities.programCode);
    case "check_attendance":
      return { success: true, message: "Opening attendance view." };
  }

  // Data write — these open modals via the event bus
  if (action === "add_activity") {
    emitVoiceEvent("voice:openModal", {
      id: "add_activity",
      prefill: {
        programCode: entities.programCode,
        date: entities.date === "today"
          ? new Date().toISOString().slice(0, 10)
          : entities.date,
        ...(entities.formData ?? {}),
      },
    });
    return {
      success: true,
      message: entities.programCode
        ? `Opening add activity form for ${entities.programCode}.`
        : "Opening add activity form.",
    };
  }
  if (action === "add_intern") {
    emitVoiceEvent("voice:openModal", {
      id: "add_intern",
      prefill: { programCode: entities.programCode },
    });
    return { success: true, message: "Opening add intern form." };
  }
  if (action === "fill_activity_form") {
    if (!entities.formData) {
      return { success: false, message: "Please provide the activity details." };
    }
    emitVoiceEvent("voice:fillForm", {
      formId: "activity_form",
      data: entities.formData,
    });
    return {
      success: true,
      message: "Form filled. Please review and submit.",
    };
  }
  if (action === "mark_attendance") {
    if (!entities.internName) {
      return { success: false, message: "Who should I mark as present?" };
    }
    return {
      success: true,
      message: `Mark ${entities.internName} present on ${entities.date ?? "today"}? Say confirm to save.`,
      requiresConfirmation: true,
      pending: {
        action: "mark_attendance",
        description: `Mark ${entities.internName} present`,
        data: {
          internName: entities.internName,
          date: entities.date ?? "today",
        },
      },
    };
  }
  if (action === "delete_activity") {
    return {
      success: true,
      message: "Deleting is confirmation-only. Use the trash icon on the row.",
    };
  }

  // UI actions
  if (action === "sort_table") {
    emitVoiceEvent("voice:sort", {
      field: entities.sortBy ?? "date",
      order: entities.sortOrder ?? "desc",
    });
    return {
      success: true,
      message: `Sorted by ${entities.sortBy ?? "date"}, ${
        (entities.sortOrder ?? "desc") === "desc" ? "newest first" : "oldest first"
      }.`,
    };
  }
  if (action === "filter_table") {
    const field = entities.filterField ?? "program";
    const value =
      entities.filterValue ?? entities.programCode ?? entities.searchQuery;
    if (!value) return { success: false, message: "What should I filter by?" };
    emitVoiceEvent("voice:filter", { field, value });
    return { success: true, message: `Filtered by ${field}: ${value}.` };
  }
  if (action === "search") {
    const q = entities.searchQuery ?? "";
    if (!q) return { success: false, message: "What should I search for?" };
    emitVoiceEvent("voice:search", { query: q });
    return { success: true, message: `Searching for "${q}".` };
  }
  if (action === "open_activity") {
    emitVoiceEvent("voice:openItem", {
      type: "activity",
      index: (entities.quantity ?? 1) - 1,
    });
    return { success: true, message: `Opening activity ${entities.quantity ?? 1}.` };
  }
  if (action === "close_modal") {
    emitVoiceEvent("voice:closeModal", {});
    return { success: true, message: "Closed." };
  }
  if (action === "confirm_action") {
    emitVoiceEvent("voice:confirm", {});
    return { success: true, message: "Confirmed." };
  }
  if (action === "cancel_action") {
    emitVoiceEvent("voice:cancel", {});
    return { success: true, message: "Cancelled." };
  }

  // Import
  if (action === "import_data" || action === "import_activities") {
    ctx.router.push("/import-log");
    if (entities.programCode) {
      const program = entities.programCode;
      setTimeout(() => {
        emitVoiceEvent("voice:importLogOpen", { program });
      }, 200);
    }
    const where = entities.programCode ? ` for ${entities.programCode}` : "";
    const how =
      entities.importSource === "csv"
        ? " via CSV"
        : entities.importSource === "sheets"
          ? " from Google Sheets"
          : "";
    return { success: true, message: `Opening the import manager${where}${how}.` };
  }
  if (action === "import_interns") {
    ctx.router.push("/interns");
    return { success: true, message: "Opening the interns page to import." };
  }

  // Report
  if (action === "generate_report") {
    const params = new URLSearchParams();
    if (entities.reportType) params.set("type", entities.reportType);
    if (entities.programCode) params.set("program", entities.programCode);
    ctx.router.push(`/reports${params.toString() ? `?${params}` : ""}`);
    return {
      success: true,
      message: `Generating ${entities.reportType ?? "the"} report${
        entities.programCode ? ` for ${entities.programCode}` : ""
      }.`,
    };
  }
  if (action === "export_report") {
    emitVoiceEvent("voice:export", {
      destination: entities.importSource ?? "sheets",
    });
    return { success: true, message: "Exporting report." };
  }

  // System — handled in the hook, but safe defaults
  if (action === "help") {
    emitVoiceEvent("voice:help", {});
    return {
      success: true,
      message:
        "I can navigate pages, query data, add activities, sort tables, import data, and generate reports.",
    };
  }
  if (action === "stop_listening") {
    return { success: true, message: "Okay, going to sleep." };
  }

  return {
    success: false,
    message: "I recognized the command but can't handle it yet.",
  };
}

// ------------- helpers -------------

function navSpoken(action: IntentAction): string {
  switch (action) {
    case "go_to_dashboard": return "Opening dashboard.";
    case "go_to_activities": return "Going to activities.";
    case "go_to_interns": return "Going to interns.";
    case "go_to_attendance": return "Opening attendance.";
    case "go_to_map": return "Opening the map.";
    case "go_to_personnel": return "Opening personnel.";
    case "go_to_reports": return "Opening reports.";
    case "go_to_settings": return "Opening settings.";
    case "go_to_import_log": return "Opening the import log.";
    default: return "Opening.";
  }
}

async function queryActivitiesToday(ctx: ExecutorContext): Promise<ActionResult> {
  try {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    const activities = await ctx.convex.query(api.activities.listActivities, {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
    const count = activities.filter(
      (a: { startDate: string; endDate: string }) =>
        a.startDate <= iso && iso <= a.endDate,
    ).length;
    return { success: true, message: formatCount(count, "activity", "activities", "today") };
  } catch {
    return { success: false, message: "Couldn't fetch today's activities." };
  }
}

async function queryActivitiesThisMonth(ctx: ExecutorContext): Promise<ActionResult> {
  try {
    const now = new Date();
    const items = await ctx.convex.query(api.activities.listActivities, {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
    return { success: true, message: formatCount(items.length, "activity", "activities", "this month") };
  } catch {
    return { success: false, message: "Couldn't fetch activities for this month." };
  }
}

async function queryActivitiesThisYear(ctx: ExecutorContext): Promise<ActionResult> {
  try {
    const now = new Date();
    const items = await ctx.convex.query(api.activities.listActivities, {
      year: now.getFullYear(),
    });
    return { success: true, message: formatCount(items.length, "activity", "activities", "this year") };
  } catch {
    return { success: false, message: "Couldn't fetch activities this year." };
  }
}

async function queryActivitiesTotal(
  ctx: ExecutorContext,
  _programCode?: string,
): Promise<ActionResult> {
  try {
    const items = await ctx.convex.query(api.activities.listActivities, {});
    return { success: true, message: formatCount(items.length, "activity", "activities", "in total") };
  } catch {
    return { success: false, message: "Couldn't fetch activities." };
  }
}

async function countFromQuery(
  ctx: ExecutorContext,
  name: "interns" | "personnel",
  label: string,
): Promise<ActionResult> {
  try {
    const items =
      name === "interns"
        ? await ctx.convex.query(api.interns.list, {})
        : await ctx.convex.query(api.personnel.list, {});
    return {
      success: true,
      message: formatCount(items.length, label, name === "personnel" ? "personnel" : "interns", "on record"),
    };
  } catch {
    return { success: false, message: `Couldn't fetch ${name}.` };
  }
}

async function showStatistics(ctx: ExecutorContext): Promise<ActionResult> {
  try {
    const [activities, interns] = await Promise.all([
      ctx.convex.query(api.activities.listActivities, {}),
      ctx.convex.query(api.interns.list, {}),
    ]);
    return {
      success: true,
      message: `You have ${activities.length} activities and ${interns.length} interns on record.`,
    };
  } catch {
    return { success: false, message: "Couldn't load statistics." };
  }
}

async function findActivity(
  ctx: ExecutorContext,
  query: string,
): Promise<ActionResult> {
  if (!query) return { success: false, message: "What activity are you looking for?" };
  try {
    const items = await ctx.convex.query(api.activities.listActivities, {});
    const lower = query.toLowerCase();
    const matches = items.filter((a: { activityTitle?: string; venue?: string }) =>
      (a.activityTitle ?? "").toLowerCase().includes(lower) ||
      (a.venue ?? "").toLowerCase().includes(lower),
    );
    return {
      success: true,
      message:
        matches.length > 0
          ? `Found ${matches.length} matching activities.`
          : `No activities found matching "${query}".`,
    };
  } catch {
    return { success: false, message: "Couldn't search activities." };
  }
}

async function programSummary(
  ctx: ExecutorContext,
  code?: string,
): Promise<ActionResult> {
  if (!code) return { success: false, message: "Which program should I summarize?" };
  try {
    const projects = await ctx.convex.query(api.projects.list, {});
    const project = projects.find(
      (p: { code: string }) => p.code.toLowerCase() === code.toLowerCase(),
    );
    if (!project) {
      return { success: false, message: `I don't have a program named ${code}.` };
    }
    const summary = await ctx.convex.query(api.activities.projectStats, {
      projectId: project._id,
    });
    return {
      success: true,
      message: `${project.code} has ${summary.totalActivities} activities and ${summary.totalParticipants} participants.`,
    };
  } catch {
    return { success: false, message: "Couldn't fetch the program summary." };
  }
}

function formatCount(n: number, singular: string, plural: string, suffix: string): string {
  if (n === 0) return `No ${plural} ${suffix}.`;
  if (n === 1) return `There is 1 ${singular} ${suffix}.`;
  return `There are ${n} ${plural} ${suffix}.`;
}
