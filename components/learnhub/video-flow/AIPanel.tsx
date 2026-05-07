"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtTime } from "./utils";
import type { VideoNote, VideoSession } from "./types";

type Props = {
  sessionId: string | null;
  userId: Id<"learnhub_users"> | null;
  isOwner: boolean;
  notes: VideoNote[];
  session: VideoSession | null;
  transcript: string;
  setTranscript: (next: string) => void;
};

export function AISummaryPanel({
  sessionId,
  userId,
  isOwner,
  notes,
  session,
  transcript,
  setTranscript,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateSummary = useMutation(api.learnhub_video_flow.updateSummary);
  const ai = session?.aiSummary;

  async function generate() {
    if (!sessionId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/learnhub/video-flow/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session?.title ?? "YouTube Learning Session",
          videoId: session?.videoId,
          transcript,
          notes: notes.map((n) => ({ timestamp: fmtTime(n.timestampSec), kind: n.kind, content: n.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI summary unavailable");
      await updateSummary({
        sessionId: sessionId as Id<"learnhub_video_sessions">,
        userId,
        aiSummary: data.summary,
        summary: data.summary?.summary,
        takeaways: data.summary?.keyConcepts ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI summary unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vf-tab-body">
      {isOwner && (
        <div className="vf-ai-box">
          <p>Generate from your notes plus an optional pasted transcript. Transcript is also reused by chat and export.</p>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Optional: paste transcript or important video sections here…"
          />
          <button onClick={generate} disabled={loading || (notes.length === 0 && transcript.trim().length < 80)}>
            {loading ? "Generating…" : "Generate Groq summary"}
          </button>
          {error && <p className="vf-error">{error}</p>}
        </div>
      )}
      {!ai && <p className="vf-muted">Add notes or paste a transcript, then generate a structured AI summary.</p>}
      {ai && (
        <div className="vf-summary-output">
          <h3>Summary</h3>
          <p>{ai.summary}</p>
          <SummaryList title="Key concepts" items={ai.keyConcepts} />
          <SummaryList title="Action items" items={ai.actionItems} />
          <SummaryList title="Questions to review" items={ai.questions} />
          {ai.beginnerExplanation && (<><h3>Beginner explanation</h3><p>{ai.beginnerExplanation}</p></>)}
          {ai.quizItems && ai.quizItems.length > 0 && (
            <>
              <h3>Quick recall</h3>
              {ai.quizItems.map((q, i) => (
                <details key={i}><summary>{q.question}</summary><p>{q.answer}</p></details>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </>
  );
}
