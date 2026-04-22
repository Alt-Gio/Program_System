"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel";

// ── User Search Panel ──────────────────────────────────────────────────────────
function NewConversationPanel({ userId, onOpen, onClose }: {
  userId: Id<"learnhub_users">;
  onOpen: (convId: Id<"learnhub_conversations">) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const allUsers = useQuery(api.learnhub_users.listUsers, {});
  const getOrCreate = useMutation(api.learnhub_conversations.getOrCreateConversation);

  const filtered = (allUsers ?? [])
    .filter((u) => u._id !== userId && (
      !query.trim() || u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
    ))
    .slice(0, 12);

  const handleSelect = async (otherId: Id<"learnhub_users">) => {
    const convId = await getOrCreate({ userIdA: userId, userIdB: otherId });
    onOpen(convId as Id<"learnhub_conversations">);
    onClose();
  };

  const ROLE_COLOR: Record<string, string> = { mentor: "#5b6cff", student: "#22d3a0", org_partner: "#ff8c42", admin: "#ff5f6d" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0d1025", borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ color: "#e8eaff", fontWeight: 700, fontSize: 16, fontFamily: "var(--font-sora)" }}>New Message</p>
          <button onClick={onClose} style={{ color: "#5c6490", background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          autoFocus
          style={{ width: "100%", background: "#131626", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px", color: "#e8eaff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {allUsers === undefined && <p style={{ color: "#5c6490", fontSize: 13, textAlign: "center", padding: 16 }}>Loading…</p>}
          {filtered.map((u) => (
            <button key={u._id} onClick={() => handleSelect(u._id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left" }}>
              <img src={u.avatarUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`} width={36} height={36} style={{ borderRadius: "50%", background: "#1a1d30" }} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`; }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#e8eaff", fontSize: 14, fontWeight: 600, margin: 0 }}>{u.name}</p>
                <p style={{ color: "#5c6490", fontSize: 11, margin: 0 }}>{u.email}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: (ROLE_COLOR[u.role] ?? "#5b6cff") + "20", color: ROLE_COLOR[u.role] ?? "#5b6cff" }}>{u.role}</span>
            </button>
          ))}
          {allUsers !== undefined && filtered.length === 0 && <p style={{ color: "#5c6490", fontSize: 13, textAlign: "center", padding: 16 }}>No users found</p>}
        </div>
      </div>
    </div>
  );
}

// ── Chat Thread ────────────────────────────────────────────────────────────────
function ChatThread({ conversationId, userId, otherName }: {
  conversationId: Id<"learnhub_conversations">;
  userId: Id<"learnhub_users">;
  otherName: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = useQuery(api.learnhub_conversations.listMessages, { conversationId });
  const sendMessage = useMutation(api.learnhub_conversations.sendMessage);
  const markRead = useMutation(api.learnhub_conversations.markConversationRead);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    markRead({ conversationId, userId }).catch(() => {});
  }, [conversationId, userId, markRead]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ conversationId, senderId: userId, content: text.trim() });
      setText("");
    } finally { setSending(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d0f1a" }}>
      {/* Thread header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, background: "#131626" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#5b6cff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
          {otherName.charAt(0).toUpperCase()}
        </div>
        <p style={{ color: "#e8eaff", fontWeight: 700, fontSize: 15, fontFamily: "var(--font-sora)" }}>{otherName}</p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages === undefined && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 40, borderRadius: 16, background: "#131626", opacity: 0.5 + i * 0.2, width: `${50 + i * 20}%`, alignSelf: i % 2 === 0 ? "flex-start" : "flex-end" }} />)}
          </div>
        )}
        {(messages ?? []).map((msg) => {
          const isMe = msg.senderId === userId;
          return (
            <div key={msg._id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "72%", padding: "9px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "#5b6cff" : "#1a1d30", color: isMe ? "#fff" : "#e8eaff", fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>
                {msg.content}
              </div>
              <span style={{ color: "#5c6490", fontSize: 10, marginTop: 3 }}>{formatDistanceToNow(msg.createdAt, { addSuffix: true })}</span>
            </div>
          );
        })}
        {messages?.length === 0 && (
          <p style={{ color: "#5c6490", fontSize: 13, textAlign: "center", marginTop: 32 }}>Start the conversation 👋</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={`Message ${otherName}…`}
          style={{ flex: 1, background: "#131626", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 16px", color: "#e8eaff", fontSize: 14, outline: "none" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <button onClick={send} disabled={!text.trim() || sending} style={{ padding: "10px 16px", borderRadius: 14, background: "#5b6cff", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: !text.trim() || sending ? 0.4 : 1 }}>
          →
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const { userId } = useLearnhubSession();
  const [selectedConvId, setSelectedConvId] = useState<Id<"learnhub_conversations"> | null>(null);
  const [showNewMsg, setShowNewMsg] = useState(false);

  const convs = useQuery(
    api.learnhub_conversations.listMyConversations,
    userId ? { userId } : "skip"
  );

  const selectedConv = convs?.find((c) => c._id === selectedConvId);
  const otherName = selectedConv?.other?.name ?? "User";

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <p style={{ color: "#5c6490" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden", background: "#0d0f1a" }}>
      {showNewMsg && (
        <NewConversationPanel
          userId={userId}
          onOpen={(id) => setSelectedConvId(id)}
          onClose={() => setShowNewMsg(false)}
        />
      )}

      {/* Left: conversation list */}
      <div style={{ width: 280, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", background: "#131626", flexShrink: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "#e8eaff", fontWeight: 700, fontSize: 15, fontFamily: "var(--font-sora)" }}>Messages</p>
          <button onClick={() => setShowNewMsg(true)} title="New conversation" style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(91,108,255,0.15)", border: "none", cursor: "pointer", color: "#7c8bff", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {convs === undefined && (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map(i => <div key={i} className="animate-pulse" style={{ height: 64, borderRadius: 12, background: "#1a1d30" }} />)}
            </div>
          )}
          {convs?.length === 0 && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <p style={{ color: "#5c6490", fontSize: 13 }}>No conversations yet</p>
              <button onClick={() => setShowNewMsg(true)} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 10, background: "#5b6cff", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Start one</button>
            </div>
          )}
          {convs?.map((conv) => {
            const isSelected = conv._id === selectedConvId;
            const hasUnread = conv.unreadCount > 0;
            return (
              <button key={conv._id} onClick={() => setSelectedConvId(conv._id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: isSelected ? "rgba(91,108,255,0.1)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img src={conv.other?.avatarUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.other?.name ?? "U")}`} width={40} height={40} style={{ borderRadius: "50%", background: "#1a1d30" }} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=U`; }} />
                  {hasUnread && <span style={{ position: "absolute", top: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#5b6cff", border: "2px solid #131626" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ color: isSelected ? "#7c8bff" : "#e8eaff", fontWeight: 600, fontSize: 13, margin: 0, fontFamily: "var(--font-sora)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conv.other?.name ?? "User"}</p>
                    {hasUnread && <span style={{ fontSize: 10, fontWeight: 700, background: "#5b6cff", color: "#fff", borderRadius: 8, padding: "1px 5px" }}>{conv.unreadCount}</span>}
                  </div>
                  <p style={{ color: "#5c6490", fontSize: 11, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {conv.lastMsg ? conv.lastMsg.content : "No messages yet"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: chat thread */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {selectedConvId ? (
          <ChatThread conversationId={selectedConvId} userId={userId} otherName={otherName} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
            <div style={{ width: 60, height: 60, borderRadius: 20, background: "rgba(91,108,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#5b6cff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p style={{ color: "#e8eaff", fontWeight: 700, fontSize: 16, fontFamily: "var(--font-sora)" }}>Your messages</p>
            <p style={{ color: "#9ba3cc", fontSize: 13 }}>Select a conversation or start a new one</p>
            <button onClick={() => setShowNewMsg(true)} style={{ padding: "10px 20px", borderRadius: 12, background: "#5b6cff", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "var(--font-sora)" }}>
              New Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
