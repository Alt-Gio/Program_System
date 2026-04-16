"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Send, MessageSquare, ArrowLeft, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

function Avatar({ name, size = "sm" }: { name: string; size?: "xs" | "sm" }) {
  const i = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const c = ["from-blue-500 to-indigo-600","from-purple-500 to-pink-600","from-green-500 to-teal-600","from-amber-500 to-orange-600"];
  const sz = size === "xs" ? "w-6 h-6 text-[9px]" : "w-9 h-9 text-xs";
  return (
    <div className={cn(`bg-gradient-to-br ${c[name.charCodeAt(0)%c.length]} rounded-full flex items-center justify-center text-white font-bold shrink-0`, sz)}>
      {i}
    </div>
  );
}

export default function InternMessagesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [activeSupervisorId, setActiveSupervisorId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem("intern_token"));
  }, []);

  const allMessages = useQuery(
    api.supervisorTools.getInternMessages,
    token ? { internToken: token } : "skip"
  );
  const replyMessage = useMutation(api.supervisorTools.internReplyMessage);

  // Group messages by supervisor
  const conversations = useMemo(() => {
    if (!allMessages) return [];
    const map = new Map<string, { supervisorId: string; supervisorName: string; messages: any[]; lastAt: number; unread: number }>();
    for (const msg of allMessages) {
      const sid = msg.supervisorId as string;
      if (!map.has(sid)) {
        map.set(sid, {
          supervisorId: sid,
          supervisorName: (msg as any).supervisorName ?? "Supervisor",
          messages: [],
          lastAt: msg.createdAt,
          unread: 0,
        });
      }
      const conv = map.get(sid)!;
      conv.messages.push(msg);
      if (msg.createdAt > conv.lastAt) conv.lastAt = msg.createdAt;
      if (msg.senderType === "supervisor" && !msg.readAt) conv.unread++;
    }
    return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
  }, [allMessages]);

  const activeConv = useMemo(
    () => conversations.find(c => c.supervisorId === activeSupervisorId) ?? null,
    [conversations, activeSupervisorId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending || !token || !activeSupervisorId) return;
    setSending(true);
    try {
      await replyMessage({
        internToken: token,
        supervisorId: activeSupervisorId as Id<"supervisors">,
        message: draft.trim(),
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  if (!token) return null;

  // ── Conversation list ──
  if (!activeSupervisorId) {
    return (
      <div className="px-4 py-5 space-y-4">
        <div>
          <h1 className="text-white text-xl font-extrabold">Messages 💬</h1>
          <p className="text-white/30 text-xs mt-0.5">Direct messages from your supervisor</p>
        </div>

        {!allMessages ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">No messages yet</p>
            <p className="text-white/20 text-xs">When your supervisor sends you a message,<br />it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(conv => {
              const last = conv.messages[conv.messages.length - 1];
              return (
                <button
                  key={conv.supervisorId}
                  onClick={() => setActiveSupervisorId(conv.supervisorId)}
                  className="w-full flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.98]"
                >
                  <Avatar name={conv.supervisorName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-white font-semibold text-sm truncate">{conv.supervisorName}</p>
                      <span className="text-white/25 text-[10px] shrink-0 ml-2">
                        {new Date(conv.lastAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs truncate">
                      {last?.senderType === "intern" ? "You: " : ""}{last?.message ?? ""}
                    </p>
                  </div>
                  {conv.unread > 0 && (
                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0">
                      {conv.unread}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Active chat thread ──
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] shrink-0">
        <button onClick={() => setActiveSupervisorId(null)} className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {activeConv && <Avatar name={activeConv.supervisorName} />}
        <div>
          <p className="text-white font-bold text-sm">{activeConv?.supervisorName ?? "Supervisor"}</p>
          <p className="text-white/30 text-[10px]">Your Supervisor</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {(activeConv?.messages ?? []).map((msg: any) => {
          const isMe = msg.senderType === "intern";
          return (
            <div key={msg._id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
              {!isMe && activeConv && <Avatar name={activeConv.supervisorName} size="xs" />}
              <div className={cn(
                "max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm",
                isMe
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-white/[0.08] text-white border border-white/[0.1] rounded-tl-sm"
              )}>
                <p className="leading-relaxed">{msg.message}</p>
                <div className={cn("flex items-center gap-1 mt-1 text-[10px]", isMe ? "justify-end text-indigo-300" : "text-white/30")}>
                  {new Date(msg.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                  {isMe && <CheckCheck className="w-3 h-3" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <form onSubmit={sendReply} className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.07] bg-[#0f172a] shrink-0">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Type a reply…"
          className="flex-1 px-4 py-2.5 text-sm bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/25 rounded-xl outline-none focus:border-indigo-500/50 focus:bg-white/[0.09] transition-all"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 flex items-center justify-center text-white transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
