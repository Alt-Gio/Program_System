import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/learnhub/auth";
import {
  groq,
  STUDY_ASSISTANT_SYSTEM_PROMPT,
  CHAT_MODEL,
  MAX_MESSAGES_PER_SESSION,
} from "@/lib/learnhub/groq";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// POST /api/learnhub/chat
// Proxies chat messages to Groq. Session validated server-side.

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = await verifySession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const body = await request.json();
  const { messages } = body as { messages: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  if (messages.length > MAX_MESSAGES_PER_SESSION) {
    return NextResponse.json(
      {
        error: "Session limit reached",
        message: "Start a new session to continue chatting.",
      },
      { status: 429 }
    );
  }

  try {
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: STUDY_ASSISTANT_SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 400,
      temperature: 0.7,
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
        { error: "The assistant is busy, try again in a moment." },
        { status: 429 }
      );
    }
    console.error("[LearnHub] Groq error:", err);
    return NextResponse.json({ error: "Chat unavailable" }, { status: 500 });
  }
}
