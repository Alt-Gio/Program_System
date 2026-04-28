export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

// Reuse the same Groq key the LearnHub side uses.
const apiKey =
  process.env.LEARNHUB_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "";

const groq = apiKey ? new Groq({ apiKey }) : null;

export async function POST(req: NextRequest) {
  if (!groq) {
    return NextResponse.json(
      { error: "groq_not_configured" },
      { status: 500 },
    );
  }

  let body: { transcript?: string; systemPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const transcript = body.transcript?.trim();
  const systemPrompt = body.systemPrompt?.trim();
  if (!transcript || !systemPrompt) {
    return NextResponse.json(
      { error: "missing_fields" },
      { status: 400 },
    );
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse this voice command: "${transcript}"` },
      ],
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    return NextResponse.json({ content });
  } catch (err: any) {
    return NextResponse.json(
      { error: "groq_error", detail: err?.message ?? String(err) },
      { status: 502 },
    );
  }
}
