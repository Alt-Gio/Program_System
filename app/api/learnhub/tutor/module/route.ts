export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/learnhub/auth";
import {
  groq,
  CHAT_MODEL,
  MAX_MESSAGES_PER_SESSION,
} from "@/lib/learnhub/groq";

// Rec #6 — Per-module AI tutor.
//
// Reuses the Groq plumbing already powering the global Study Assistant,
// but injects the specific path/module context into the system prompt so
// answers stay grounded in what the learner is actually working through.
//
// Inputs are explicit (pathTitle/moduleTitle/moduleDescription) instead of
// re-fetched server-side so this endpoint stays a thin proxy — the page
// already has the full path loaded for rendering and can pass the slice
// it cares about.

interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

interface TutorRequestBody {
  pathTitle?: string;
  moduleTitle?: string;
  moduleDescription?: string;
  messages?: TutorMessage[];
}

function buildSystemPrompt(opts: {
  pathTitle: string;
  moduleTitle: string;
  moduleDescription: string;
}): string {
  return `You are an ILCDB Module Tutor on DICT Region V's LearnHub. You help one learner work through a single module of a learning path.

The learner is enrolled in path: "${opts.pathTitle}".
They are working on module: "${opts.moduleTitle}".
Module description: ${opts.moduleDescription || "(no description provided)"}

Rules:
- Stay tightly scoped to this module. If the learner drifts, gently steer back: "That's outside this module — let's stay focused."
- Prefer Socratic prompts over direct answers when the question is conceptual. Give worked examples for procedural questions.
- Keep replies under 180 words unless the learner explicitly asks for more depth.
- Never fabricate course content, links, or specific DICT program details. If you don't know, say so.
- Bilingual-friendly: if the learner writes in Tagalog or Taglish, respond in the same style.`;
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const session = await verifySession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const body = (await request.json()) as TutorRequestBody;
  const pathTitle = (body.pathTitle ?? "").toString().slice(0, 240);
  const moduleTitle = (body.moduleTitle ?? "").toString().slice(0, 240);
  const moduleDescription = (body.moduleDescription ?? "").toString().slice(0, 1200);
  const messages = body.messages;

  if (!pathTitle || !moduleTitle) {
    return NextResponse.json(
      { error: "Missing path or module context" },
      { status: 400 },
    );
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES_PER_SESSION) {
    return NextResponse.json(
      {
        error: "Session limit reached",
        message: "Start a fresh tutor session to continue.",
      },
      { status: 429 },
    );
  }

  try {
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({ pathTitle, moduleTitle, moduleDescription }),
        },
        ...messages,
      ],
      max_tokens: 400,
      temperature: 0.5,
    });
    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : 500;
    if (status === 429) {
      return NextResponse.json(
        { error: "The tutor is busy, try again in a moment." },
        { status: 429 },
      );
    }
    console.error("[LearnHub tutor] Groq error:", err);
    return NextResponse.json({ error: "Tutor unavailable" }, { status: 500 });
  }
}
