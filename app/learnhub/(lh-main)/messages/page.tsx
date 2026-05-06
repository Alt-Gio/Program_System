"use client";
import { Suspense } from "react";

/**
 * LearnHub Messages — Meta Messenger / WhatsApp hybrid.
 *
 * Split-panel chat backed by Convex (`api.learnhub_conversations.*`):
 *
 *   • Left  — conversation list with search + Inbox/Unread tabs,
 *             unread badges, online dot, last-message preview.
 *   • Right — chat thread with bubble-style messages, timestamps,
 *             a sticky composer, and an empty state.
 *   • Modal — "New Message" user picker that calls
 *             `getOrCreateConversation` and selects the result.
 *
 * Deep-link support: `/learnhub/messages?to=<userId>` opens (or
 * creates) a DM with that user immediately. Used by RightPanel's
 * "Message" button on online peers.
 *
 * All styling uses the `.lh-msg-*` classes added to `learnhub.css`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Edit3, MessageCircle, Search, Send, X } from "lucide-react";

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

function MessagesPageInner() {
  const { userId } = useLearnhubSession();
  const sp = useSearchParams();
  const router = useRouter();
  const initialTo = sp.get("to");

  const [selectedConvId, setSelectedConvId] = useState<Id<"learnhub_conversations"> | null>(null);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"inbox" | "unread">("inbox");

  const convs = useQuery(
    api.learnhub_conversations.listMyConversations,
    userId ? { userId } : "skip"
  );
  const getOrCreate = useMutation(api.learnhub_conversations.getOrCreateConversation);

  // Deep-link handler: ?to=<userId> opens a DM with that user.
  useEffect(() => {
    if (!userId || !initialTo) return;
    let cancelled = false;
    (async () => {
      try {
        const id = await getOrCreate({
          userIdA: userId,
          userIdB: initialTo as Id<"learnhub_users">,
        });
        if (!cancelled) {
          setSelectedConvId(id as Id<"learnhub_conversations">);
          // Strip the param so refreshes don't reopen the same chat.
          router.replace("/learnhub/messages");
        }
      } catch {
        // Bad/unknown user id — silently ignore.
      }
    })();
    return () => { cancelled = true; };
  }, [userId, initialTo, getOrCreate, router]);

  // Filtered conversation list (search + Unread tab).
  const filteredConvs = useMemo(() => {
    if (!convs) return convs;
    const q = search.trim().toLowerCase();
    return convs.filter((c) => {
      if (tab === "unread" && (c.unreadCount ?? 0) === 0) return false;
      if (!q) return true;
      const name = (c.other?.name ?? "").toLowerCase();
      const last = (c.lastMsg?.content ?? "").toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [convs, search, tab]);

  const selectedConv = convs?.find((c) => c._id === selectedConvId) ?? null;

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 360 }}>
        <p style={{ color: "var(--lh-text-3)" }}>Loading…</p>
      </div>
    );
  }

  const unreadTotal = (convs ?? []).reduce((n, c) => n + (c.unreadCount ?? 0), 0);

  return (
    <div className={`lh-msg-shell${selectedConvId ? " has-thread" : ""}`}>
      {/* ── Conversation list ───────────────────────────────────── */}
      <aside className="lh-msg-list">
        <div className="lh-msg-list-header">
          <div className="lh-msg-list-title-row">
            <h1 className="lh-msg-list-title">Chats</h1>
            <button
              type="button"
              className="lh-msg-new-btn"
              onClick={() => setShowNewMsg(true)}
              aria-label="New message"
              title="New message"
            >
              <Edit3 size={16} />
            </button>
          </div>
          <div className="lh-msg-search">
            <Search size={14} style={{ color: "var(--lh-text-3)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Messenger"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--lh-text-3)", display: "flex" }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="lh-msg-tabs">
          <button
            type="button"
            className={`lh-msg-tab${tab === "inbox" ? " is-active" : ""}`}
            onClick={() => setTab("inbox")}
          >
            Inbox
          </button>
          <button
            type="button"
            className={`lh-msg-tab${tab === "unread" ? " is-active" : ""}`}
            onClick={() => setTab("unread")}
          >
            Unread{unreadTotal > 0 ? ` · ${unreadTotal}` : ""}
          </button>
        </div>

        <div className="lh-msg-conv-list">
          {convs === undefined && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 8px" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: 10, alignItems: "center" }}>
                  <div className="lh-skeleton" style={{ width: 48, height: 48, borderRadius: "50%" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="lh-skeleton" style={{ height: 11, width: "55%" }} />
                    <div className="lh-skeleton" style={{ height: 9, width: "75%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {convs !== undefined && (filteredConvs?.length ?? 0) === 0 && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <p style={{ color: "var(--lh-text-3)", fontSize: 13, margin: 0 }}>
                {search.trim()
                  ? "No conversations match that search."
                  : tab === "unread"
                  ? "No unread messages."
                  : "No conversations yet"}
              </p>
              {!search.trim() && tab === "inbox" && (
                <button
                  type="button"
                  onClick={() => setShowNewMsg(true)}
                  style={{
                    marginTop: 12, padding: "8px 16px", borderRadius: 10,
                    background: "var(--lh-accent)", color: "white", border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: 700,
                  }}
                >
                  Start a chat
                </button>
              )}
            </div>
          )}

          {filteredConvs?.map((conv) => {
            const isActive = conv._id === selectedConvId;
            const hasUnread = (conv.unreadCount ?? 0) > 0;
            const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.other?.name ?? "U")}`;
            const time = conv.lastMessageAt
              ? shortTime(conv.lastMessageAt)
              : "";
            return (
              <button
                key={conv._id}
                type="button"
                className={`lh-msg-conv-row${isActive ? " is-active" : ""}${hasUnread ? " has-unread" : ""}`}
                onClick={() => setSelectedConvId(conv._id as Id<"learnhub_conversations">)}
              >
                <div className="lh-msg-conv-avatar-wrap">
                  <img
                    src={conv.other?.avatarUrl ?? fallbackAvatar}
                    alt=""
                    className="lh-msg-conv-avatar"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar; }}
                  />
                  {/* Online dot is decorative only until presence ships. */}
                  <span className="lh-msg-conv-online" aria-hidden style={{ display: "none" }} />
                </div>
                <div className="lh-msg-conv-body">
                  <div className="lh-msg-conv-top">
                    <span className="lh-msg-conv-name">{conv.other?.name ?? "User"}</span>
                    {time && <span className="lh-msg-conv-time">{time}</span>}
                  </div>
                  <div className="lh-msg-conv-bottom">
                    <span className="lh-msg-conv-preview">
                      {conv.lastMsg
                        ? (conv.lastMsg.senderId === userId ? "You: " : "") + conv.lastMsg.content
                        : "Start the conversation"}
                    </span>
                    {hasUnread && (
                      <span className="lh-msg-conv-badge">{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Thread ─────────────────────────────────────────────── */}
      <section className="lh-msg-thread">
        {selectedConvId && selectedConv ? (
          <ChatThread
            key={selectedConvId}
            conversationId={selectedConvId}
            userId={userId}
            otherName={selectedConv.other?.name ?? "User"}
            otherAvatar={selectedConv.other?.avatarUrl ?? null}
            onBack={() => setSelectedConvId(null)}
          />
        ) : (
          <div className="lh-msg-empty">
            <div className="lh-msg-empty-icon">
              <MessageCircle size={28} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--lh-text)", fontSize: 17 }}>
                Your messages
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                Select a chat or start a new conversation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewMsg(true)}
              style={{
                padding: "10px 22px", borderRadius: 12,
                background: "var(--lh-accent)", color: "white",
                border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              New Message
            </button>
          </div>
        )}
      </section>

      {/* New conversation modal */}
      {showNewMsg && (
        <NewConversationPanel
          userId={userId}
          onOpen={(id) => setSelectedConvId(id)}
          onClose={() => setShowNewMsg(false)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Chat thread
// ────────────────────────────────────────────────────────────────────

function ChatThread({
  conversationId, userId, otherName, otherAvatar, onBack,
}: {
  conversationId: Id<"learnhub_conversations">;
  userId: Id<"learnhub_users">;
  otherName: string;
  otherAvatar: string | null;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messages = useQuery(api.learnhub_conversations.listMessages, { conversationId });
  const sendMessage = useMutation(api.learnhub_conversations.sendMessage);
  const markRead = useMutation(api.learnhub_conversations.markConversationRead);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    markRead({ conversationId, userId }).catch(() => {});
  }, [conversationId, userId, markRead]);

  // Re-focus on conversation switch.
  useEffect(() => { inputRef.current?.focus(); }, [conversationId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ conversationId, senderId: userId, content: text.trim() });
      setText("");
    } finally {
      setSending(false);
    }
  };

  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(otherName)}`;

  return (
    <>
      <header className="lh-msg-thread-header">
        <button
          type="button"
          className="lh-msg-thread-back"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} />
        </button>
        <img
          src={otherAvatar ?? fallbackAvatar}
          alt=""
          className="lh-msg-thread-avatar"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar; }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="lh-msg-thread-name">{otherName}</p>
          <p className="lh-msg-thread-status">
            {messages === undefined ? "Loading…" : "Active on LearnHub"}
          </p>
        </div>
      </header>

      <div className="lh-msg-thread-body">
        {messages === undefined && (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="lh-skeleton"
                style={{
                  height: 38,
                  width: `${50 + i * 15}%`,
                  borderRadius: 18,
                  alignSelf: i % 2 === 0 ? "flex-start" : "flex-end",
                }}
              />
            ))}
          </>
        )}

        {messages !== undefined && messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lh-text-3)", fontSize: 13 }}>
            <p style={{ margin: 0 }}>Say hi to {otherName.split(" ")[0]} 👋</p>
          </div>
        )}

        {messages?.map((msg, i) => {
          const isMe = msg.senderId === userId;
          const prev = messages[i - 1];
          const showTimestamp = !prev || msg.createdAt - prev.createdAt > 5 * 60 * 1000;
          return (
            <div key={msg._id} style={{ display: "contents" }}>
              {showTimestamp && (
                <div style={{ alignSelf: "center", color: "var(--lh-text-3)", fontSize: 10, padding: "8px 0 2px" }}>
                  {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
                </div>
              )}
              <div className={`lh-msg-row ${isMe ? "is-mine" : "is-theirs"}`}>
                <div className="lh-msg-bubble">{msg.content}</div>
                {i === (messages?.length ?? 0) - 1 && (
                  <span className="lh-msg-time">
                    {isMe && msg.read ? "Seen · " : ""}
                    {shortTime(msg.createdAt)}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="lh-msg-input-bar">
        <div className="lh-msg-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${otherName.split(" ")[0]}…`}
          />
        </div>
        <button
          type="button"
          className="lh-msg-send-btn"
          onClick={send}
          disabled={!text.trim() || sending}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// New conversation modal
// ────────────────────────────────────────────────────────────────────

function NewConversationPanel({
  userId, onOpen, onClose,
}: {
  userId: Id<"learnhub_users">;
  onOpen: (convId: Id<"learnhub_conversations">) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const allUsers = useQuery(api.learnhub_users.listUsers, {});
  const getOrCreate = useMutation(api.learnhub_conversations.getOrCreateConversation);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = (allUsers ?? [])
    .filter((u) => u._id !== userId)
    .filter((u) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    })
    .slice(0, 12);

  const handleSelect = async (otherId: Id<"learnhub_users">) => {
    const convId = await getOrCreate({ userIdA: userId, userIdB: otherId });
    onOpen(convId as Id<"learnhub_conversations">);
    onClose();
  };

  const ROLE_COLOR: Record<string, string> = {
    mentor: "#5b6cff",
    student: "#22d3a0",
    org_partner: "#ff8c42",
    admin: "#ff5f6d",
  };

  return (
    <div className="lh-msg-modal-backdrop" onClick={onClose}>
      <div className="lh-msg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lh-msg-modal-header">
          <h2 className="lh-msg-modal-title">New Message</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "var(--lh-surface-2)", border: "1px solid var(--lh-surface-3)", color: "var(--lh-text-2)", width: 32, height: 32, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="lh-msg-search">
          <Search size={14} style={{ color: "var(--lh-text-3)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            autoFocus
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", paddingRight: 4 }}>
          {allUsers === undefined && (
            <p style={{ color: "var(--lh-text-3)", fontSize: 13, textAlign: "center", padding: 16, margin: 0 }}>Loading…</p>
          )}
          {filtered.map((u) => {
            const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`;
            const c = ROLE_COLOR[u.role] ?? "#5b6cff";
            return (
              <button
                key={u._id}
                type="button"
                onClick={() => handleSelect(u._id)}
                className="lh-msg-user-row"
              >
                <img
                  src={u.avatarUrl ?? fallback}
                  alt=""
                  className="lh-msg-user-avatar"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--lh-text)", fontSize: 13.5, fontWeight: 700, margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{u.name}</p>
                  <p style={{ color: "var(--lh-text-3)", fontSize: 11, margin: 0 }}>{u.email}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: `${c}20`, color: c, textTransform: "capitalize" }}>
                  {u.role.replace("_", " ")}
                </span>
              </button>
            );
          })}
          {allUsers !== undefined && filtered.length === 0 && (
            <p style={{ color: "var(--lh-text-3)", fontSize: 13, textAlign: "center", padding: 16, margin: 0 }}>No users found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/** WhatsApp-style short timestamp: "now", "12:34", "Yesterday", "Tue", "Mar 4". */
function shortTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "now";
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (isYesterday) return "Yesterday";
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <MessagesPageInner />
    </Suspense>
  )
}
