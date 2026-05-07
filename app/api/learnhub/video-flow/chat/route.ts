export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { SESSION_COOKIE, verifySession } from "@/lib/learnhub/auth";

const apiKey = process.env.LEARNHUB_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "";
const groq = apiKey ? new Groq({ apiKey }) : null;

type ChatNote = {
  timestamp: string;
  timestampSec: number;
  kind: string;
  content: string;
};

type ChatHistory = { role: "user" | "assistant"; content: string };

type ChatBody = {
  question?: string;
  title?: string;
  videoId?: string;
  transcript?: string;
  summary?: unknown;
  notes?: ChatNote[];
  history?: ChatHistory[];
};

function safeJson(content: string) {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  if (!groq) return NextResponse.json({ error: "Groq is not configured" }, { status: 503 });

  const body = (await request.json()) as ChatBody;
  const question = (body.question ?? "").trim().slice(0, 1000);
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });

  const notes = (body.notes ?? []).slice(0, 80);
  const transcript = (body.transcript ?? "").slice(0, 14000);
  const history = (body.history ?? []).slice(-8);

  const groundingParts: string[] = [];
  groundingParts.push(`Video title: ${body.title ?? "YouTube Learning Session"}`);
  if (body.videoId) groundingParts.push(`Video ID: ${body.videoId}`);
  if (notes.length > 0) {
    groundingParts.push("Learner notes (timestamped):");
    groundingParts.push(notes.map((n) => `- [${n.timestamp}] (${n.kind}) ${n.content}`).join("\n"));
  }
  if (body.summary && typeof body.summary === "object") {
    try {
      groundingParts.push(`AI summary JSON:\n${JSON.stringify(body.summary).slice(0, 4000)}`);
    } catch { /* ignore */ }
  }
  if (transcript.trim()) {
    groundingParts.push("Transcript / pasted context:");
    groundingParts.push(transcript);
  }

  const grounding = groundingParts.join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are LearnHub Video Flow Chat for DICT Region V. Answer questions about a YouTube video the learner is studying. Use ONLY the provided notes, summary, and transcript as ground truth. If the answer is not present, say you don't know based on the provided material. Always respond as JSON: { \"answer\": string, \"citations\": [{ \"timestampSec\": number, \"quote\": string? }] }. Citations should reference timestamps from the learner's notes when relevant; otherwise return an empty array. Keep answer under 220 words.",
        },
        { role: "user", content: `Grounding material:\n\n${grounding}` },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: question },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeJson(content) ?? { answer: content, citations: [] };
    const answer = typeof parsed.answer === "string" ? parsed.answer : "";
    const rawCitations = Array.isArray(parsed.citations) ? parsed.citations : [];
    const citations = rawCitations
      .map((c: any) => ({
        timestampSec: Number.isFinite(c?.timestampSec) ? Math.max(0, Math.floor(c.timestampSec)) : null,
        quote: typeof c?.quote === "string" ? c.quote.slice(0, 240) : undefined,
      }))
      .filter((c: any) => c.timestampSec !== null)
      .slice(0, 8);
    return NextResponse.json({ answer, citations });
  } catch (err) {
    console.error("[VideoFlow] Groq chat error:", err);
    return NextResponse.json({ error: "Failed to generate chat response" }, { status: 502 });
  }
}
