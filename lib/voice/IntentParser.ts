import type {
  IntentAction,
  IntentEntities,
  ParsedIntent,
} from "./CommandRegistry";
import {
  ACTION_CATEGORY,
  ALL_ACTIONS,
  COMMAND_EXAMPLES,
  PROGRAM_CODES,
} from "./CommandRegistry";

export type IntentContext = {
  currentPage?: string;
  currentProgram?: string;
  lastAction?: string;
};

const SYSTEM_PROMPT_HEADER = `
You are an AI command parser for a DICT Region V Program Management System
used to manage ICT training and infrastructure programs (SPARK, DWIA,
eGovPH, eLGU, Free WiFi, GovNet, NBP, Cybersecurity, PNPKI, DRRM, ILCDB,
IIDB). Users speak in English or Filipino-English (Taglish).

AVAILABLE ACTIONS:
${ALL_ACTIONS.join(", ")}

PROGRAM CODES (recognize even if slightly mispronounced):
${PROGRAM_CODES.join(", ")}

EXAMPLES:
${COMMAND_EXAMPLES.map(
  (e) =>
    `"${e.say}" -> ${e.action}${
      e.entities ? ", entities: " + JSON.stringify(e.entities) : ""
    }`,
).join("\n")}

FILIPINO HINTS:
- "punta sa dashboard" / "buksan ang dashboard" -> go_to_dashboard
- "ipakita ang interns" -> go_to_interns
- "ilan ang activities ngayon" -> show_today_activities
- "magdagdag ng activity" -> add_activity
- "balik" / "bumalik" -> go_back

ENTITY EXTRACTION RULES:
- Dates: "today", "yesterday", "this week", "last month", or ISO YYYY-MM-DD.
- Program codes: normalize to one of the canonical codes above.
- Sort: "newest first" → desc; "oldest first" → asc; "alphabetically" → name asc.
- When the user dictates multiple fields inline (title X date Y venue Z),
  put them in entities.formData as { title, date, venue, participants, ... }.

You MUST respond with ONLY a JSON object (no markdown, no prose) matching:
{
  "action": "<one of the actions>",
  "confidence": <0..1>,
  "entities": {
    "programCode": string|null,
    "activityName": string|null,
    "internName": string|null,
    "date": string|null,
    "sortBy": string|null,
    "sortOrder": "asc"|"desc"|null,
    "filterField": string|null,
    "filterValue": string|null,
    "searchQuery": string|null,
    "formData": object|null,
    "importSource": "sheets"|"csv"|"clipboard"|null,
    "reportType": string|null,
    "quantity": number|null
  },
  "fallbackMessage": string|null
}

If confidence < 0.35, set action to "unknown" and write a helpful
fallbackMessage telling the user what you heard.
`.trim();

function buildSystemPrompt(context: IntentContext): string {
  return `${SYSTEM_PROMPT_HEADER}

CURRENT CONTEXT:
- Current page: ${context.currentPage ?? "unknown"}
- Current program: ${context.currentProgram ?? "none"}
- Last action: ${context.lastAction ?? "none"}
`.trim();
}

export async function parseIntent(
  transcript: string,
  context: IntentContext = {},
): Promise<ParsedIntent> {
  const systemPrompt = buildSystemPrompt(context);

  try {
    const res = await fetch("/api/voice/parse-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, systemPrompt }),
    });

    if (!res.ok) {
      return fallback(transcript, "the parser is unavailable");
    }

    const data = (await res.json()) as { content?: string };
    const parsed = JSON.parse(data.content ?? "{}") as {
      action?: string;
      confidence?: number;
      entities?: IntentEntities;
      fallbackMessage?: string | null;
    };

    const action: IntentAction = ALL_ACTIONS.includes(
      parsed.action as IntentAction,
    )
      ? (parsed.action as IntentAction)
      : "unknown";

    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;

    const entities = normalizeEntities(parsed.entities ?? {});

    return {
      action,
      category: ACTION_CATEGORY[action] ?? "system",
      confidence,
      entities,
      rawTranscript: transcript,
      fallbackMessage: parsed.fallbackMessage ?? undefined,
    };
  } catch {
    return fallback(transcript, "couldn't reach the parser");
  }
}

function fallback(transcript: string, reason: string): ParsedIntent {
  return {
    action: "unknown",
    category: "system",
    confidence: 0,
    entities: {},
    rawTranscript: transcript,
    fallbackMessage: `I heard "${transcript}" but ${reason}.`,
  };
}

function normalizeEntities(e: IntentEntities): IntentEntities {
  const out: IntentEntities = {};
  if (e.programCode) {
    const match = PROGRAM_CODES.find(
      (c) => c.toLowerCase() === String(e.programCode).toLowerCase(),
    );
    out.programCode = match ?? e.programCode;
  }
  if (e.activityName) out.activityName = String(e.activityName);
  if (e.internName) out.internName = String(e.internName);
  if (e.date) out.date = String(e.date);
  if (e.sortBy) out.sortBy = String(e.sortBy);
  if (e.sortOrder === "asc" || e.sortOrder === "desc")
    out.sortOrder = e.sortOrder;
  if (e.filterField) out.filterField = String(e.filterField);
  if (e.filterValue) out.filterValue = String(e.filterValue);
  if (e.searchQuery) out.searchQuery = String(e.searchQuery);
  if (e.formData && typeof e.formData === "object") out.formData = e.formData;
  if (
    e.importSource === "sheets" ||
    e.importSource === "csv" ||
    e.importSource === "clipboard"
  )
    out.importSource = e.importSource;
  if (e.reportType) out.reportType = String(e.reportType);
  if (typeof e.quantity === "number") out.quantity = e.quantity;
  return out;
}
