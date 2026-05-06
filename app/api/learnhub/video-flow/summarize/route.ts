export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";

const apiKey = process.env.LEARNHUB_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "";
const groq = apiKey ? new Groq({ apiKey }) : null;

type SummaryNote = {
  timestamp: string;
  kind: string;
  content: string;
};

type SummarizeBody = {
  title?: string;
  videoId?: string;
  transcript?: string;
  notes?: SummaryNote[];
};

function safeJson(content: string) {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  if (!groq) return NextResponse.json({ error: "Groq is not configured" }, { status: 503 });

  const body = (await request.json()) as SummarizeBody;
  const notes = (body.notes ?? []).slice(0, 80);
  const transcript = (body.transcript ?? "").slice(0, 16000);

  if (notes.length === 0 && transcript.trim().length < 80) {
    return NextResponse.json({ error: "Add notes or paste transcript text before generating a summary" }, { status: 400 });
  }

  const prompt = [
    `Video title: ${body.title ?? "YouTube Learning Session"}`,
    `Video ID: ${body.videoId ?? "unknown"}`,
    "Timestamped learner notes:",
    notes.map((n) => `- [${n.timestamp}] ${n.kind}: ${n.content}`).join("\n") || "None",
    "Transcript or pasted context:",
    transcript || "None",
  ].join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are LearnHub Video Flow AI for DICT Region V. Create grounded study output only from provided notes/transcript. Return JSON with keys: summary string, keyConcepts string[], actionItems string[], questions string[], beginnerExplanation string, quizItems array of {question, answer}. Keep it concise and useful for students.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const summary = safeJson(content);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[VideoFlow] Groq summary error:", err);
    return NextResponse.json({ error: "Failed to generate AI summary" }, { status: 502 });
  }
}
