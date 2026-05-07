"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtTime } from "./utils";
import type { VideoNote, VideoSession } from "./types";

type ChatMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { timestampSec: number; quote?: string }[];
  createdAt: number;
};

type Props = {
  sessionId: string | null;
  userId: Id<"learnhub_users"> | null;
  isOwner: boolean;
  notes: VideoNote[];
  session: VideoSession | null;
  transcript: string;
  onSeek: (sec: number) => void;
  onTypingChange?: (isTyping: boolean) => void;
};

export function ChatPanel({
  sessionId,
  userId,
  isOwner,
  notes,
  session,
  transcript,
  onSeek,
  onTypingChange,
}: Props) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const messages = useQuery(
    api.learnhub_video_flow.listChatMessages,
    sessionId && userId
      ? { sessionId: sessionId as Id<"learnhub_video_sessions">, userId }
      : "skip"
  ) as ChatMessage[] | undefined;

  const appendChat = useMutation(api.learnhub_video_flow.appendChatMessage);
  const clearChat = useMutation(api.learnhub_video_flow.clearChatMessages);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages?.length]);

  async function send() {
    if (!sessionId || !userId || !input.trim() || pending) return;
    const question = input.trim();
    setInput("");
    setError(null);
    setPending(true);
    try {
      await appendChat({
        sessionId: sessionId as Id<"learnhub_video_sessions">,
        userId,
        role: "user",
        content: question,
      });
      const res = await fetch("/api/learnhub/video-flow/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          question,
          title: session?.title,
          videoId: session?.videoId,
          transcript,
          summary: session?.aiSummary,
          notes: notes.map((n) => ({ timestamp: fmtTime(n.timestampSec), timestampSec: n.timestampSec, kind: n.kind, content: n.content })),
          history: (messages ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat unavailable");
      await appendChat({
        sessionId: sessionId as Id<"learnhub_video_sessions">,
        userId,
        role: "assistant",
        content: data.answer ?? "",
        citations: Array.isArray(data.citations) ? data.citations : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat unavailable");
    } finally {
      setPending(false);
    }
  }

  async function clear() {
    if (!sessionId || !userId) return;
    await clearChat({
      sessionId: sessionId as Id<"learnhub_video_sessions">,
      userId,
    });
  }

  const list = messages ?? [];

  return (
    <div className="vf-tab-body">
      <div className="vf-chat-grounding">
        <Sparkles size={13} />
        <span>
          Grounded on {notes.length} note{notes.length === 1 ? "" : "s"}
          {transcript.trim().length > 80 ? `, transcript (${transcript.length} chars)` : ", no transcript"}
          {session?.aiSummary ? ", AI summary" : ""}
        </span>
        {isOwner && list.length > 0 && (
          <button className="vf-link-btn" onClick={clear} title="Clear conversation">
            <Trash2 size={12} /> clear
          </button>
        )}
      </div>

      <div className="vf-chat-scroll" ref={scrollerRef}>
        {list.length === 0 && (
          <p className="vf-muted">
            Ask anything about this video — "What did the speaker mean at 3:42?", "Summarize the part about authentication", "Quiz me on the key points".
          </p>
        )}
        {list.map((m) => (
          <div key={m._id} className={`vf-chat-msg vf-chat-${m.role}`}>
            <div className="vf-chat-bubble">
              <p>{m.content}</p>
              {m.citations && m.citations.length > 0 && (
                <div className="vf-chat-citations">
                  {m.citations.map((c, i) => (
                    <button key={i} onClick={() => onSeek(c.timestampSec)}>
                      {fmtTime(c.timestampSec)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && <div className="vf-chat-msg vf-chat-assistant"><div className="vf-chat-bubble vf-chat-typing"><span /><span /><span /></div></div>}
      </div>

      {isOwner && (
        <div className="vf-chat-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => onTypingChange?.(true)}
            onBlur={() => onTypingChange?.(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask about this video… (Enter to send, Shift+Enter for newline)"
            rows={2}
          />
          <button onClick={send} disabled={pending || !input.trim()} aria-label="Send">
            <Send size={15} />
          </button>
        </div>
      )}
      {error && <p className="vf-error">{error}</p>}
    </div>
  );
}
