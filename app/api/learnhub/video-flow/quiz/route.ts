export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";

const apiKey = process.env.LEARNHUB_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "";
const groq = apiKey ? new Groq({ apiKey }) : null;

type QuizNote = { timestamp: string; timestampSec: number; kind: string; content: string };

type QuizBody = {
  title?: string;
  videoId?: string;
  transcript?: string;
  notes?: QuizNote[];
  count?: number;
};

function safeJson(content: string) {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  if (!groq) return NextResponse.json({ error: "Groq is not configured" }, { status: 503 });

  const body = (await request.json()) as QuizBody;
  const notes = (body.notes ?? []).slice(0, 80);
  const transcript = (body.transcript ?? "").slice(0, 14000);
  const count = Math.max(3, Math.min(10, body.count ?? 6));

  if (notes.length === 0 && transcript.trim().length < 120) {
    return NextResponse.json(
      { error: "Add notes or paste a transcript before generating a quiz" },
      { status: 400 }
    );
  }

  const grounding = [
    `Video title: ${body.title ?? "YouTube Learning Session"}`,
    `Video ID: ${body.videoId ?? "unknown"}`,
    "Learner notes (timestamped):",
    notes.map((n) => `- [${n.timestamp}] (${n.kind}) ${n.content}`).join("\n") || "None",
    "Transcript / pasted context:",
    transcript || "None",
  ].join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are LearnHub Video Flow Quiz for DICT Region V. Generate exactly ${count} multiple-choice questions grounded ONLY in the provided notes and transcript. Each question has 4 plausible choices, exactly one correct answer, a short explanation, and (when possible) a timestampSec that anchors to a learner note. Return JSON: { "questions": [{ "question": string, "choices": [string, string, string, string], "answerIndex": number (0-3), "explanation": string, "timestampSec": number? }] }. Do not include questions whose answer is not present in the grounding.`,
        },
        { role: "user", content: grounding },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeJson(content);
    const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions = rawQuestions
      .map((q: any) => {
        const choices = Array.isArray(q?.choices) ? q.choices.slice(0, 4).map((c: any) => String(c).slice(0, 200)) : [];
        if (choices.length !== 4) return null;
        const answerIndex = Number(q?.answerIndex);
        if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return null;
        const question = String(q?.question ?? "").slice(0, 400);
        if (!question) return null;
        const out: any = { question, choices, answerIndex };
        if (typeof q?.explanation === "string") out.explanation = q.explanation.slice(0, 400);
        if (Number.isFinite(q?.timestampSec)) out.timestampSec = Math.max(0, Math.floor(q.timestampSec));
        return out;
      })
      .filter(Boolean)
      .slice(0, count);

    if (questions.length < 3) {
      return NextResponse.json({ error: "Not enough material to build a reliable quiz" }, { status: 422 });
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[VideoFlow] Groq quiz error:", err);
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 502 });
  }
}
