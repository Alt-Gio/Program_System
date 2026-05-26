"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

const BORDER = "rgba(255,255,255,0.06)";
const CARD = "#111323";
const TEXT = "#e8eaf4";
const MUTED = "rgba(185,190,230,0.6)";
const INDIGO = "#6366f1";

export function GroupChatPanel({ groupId, canSend }: { groupId: Id<"learnhub_groups">; canSend: boolean }) {
  const { userId } = useLearnhubSession();
  const messages = useQuery(api.learnhub_conversations.listGroupMessages, { groupId });
  const send = useMutation(api.learnhub_conversations.sendGroupMessage);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length]);

  const handleSend = async () => {
    if (!userId || !body.trim()) return;
    setSending(true);
    try {
      await send({
        groupId,
        senderId: userId as Id<"learnhub_users">,
        content: body.trim(),
      });
      setBody("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, display: "flex", flexDirection: "column", height: 480 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages === undefined ? (
          <p style={{ color: MUTED, fontSize: 12 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 12, textAlign: "center", margin: "auto" }}>
            No messages yet. {canSend ? "Be the first to say hi 👋" : "Members can chat here once they join."}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === userId;
            return (
              <div key={m._id} style={{ display: "flex", gap: 8, alignItems: "start", flexDirection: mine ? "row-reverse" : "row" }}>
                {m.sender && (
                  <img src={m.sender.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: 99, flexShrink: 0 }} />
                )}
                <div style={{ maxWidth: "70%" }}>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 2, textAlign: mine ? "right" : "left" }}>
                    {m.sender?.name ?? "Unknown"}
                  </div>
                  <div style={{
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: mine ? INDIGO : "rgba(255,255,255,0.06)",
                    color: TEXT,
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {canSend && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: 12, display: "flex", gap: 8 }}>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message your cohort…"
            style={{ flex: 1, padding: "8px 12px", borderRadius: 99, background: "rgba(0,0,0,0.3)", color: TEXT, border: `1px solid ${BORDER}`, outline: "none" }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            style={{ padding: "8px 16px", borderRadius: 99, background: INDIGO, color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
