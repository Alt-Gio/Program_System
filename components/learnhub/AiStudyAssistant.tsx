"use client";

import { useState, useRef, useEffect } from "react";

interface Message { role: "user" | "assistant"; content: string; }

export function AiStudyAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); inputRef.current?.focus(); }
  }, [open, messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/learnhub/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setLoading(false); return; }
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #5b6cff 0%, #22d3a0 100%)" }}
          aria-label="Open AI Study Assistant"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15l-4-4h3V8h2v5h3l-4 4z" fill="white" />
          </svg>
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: "#22d3a0", color: "#0d0f1a" }}>AI</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 rounded-2xl overflow-hidden flex flex-col shadow-2xl" style={{ height: 480, background: "#131626", border: "1px solid rgba(91,108,255,0.25)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: "linear-gradient(135deg, rgba(91,108,255,0.15) 0%, rgba(34,211,160,0.1) 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #5b6cff, #22d3a0)" }}>
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>AI Study Assistant</p>
              <p className="text-[10px]" style={{ color: "#9ba3cc" }}>Powered by Groq · llama-3.1-8b</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg opacity-60 hover:opacity-100" style={{ color: "#9ba3cc" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(91,108,255,0.1)" }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M12 21v-1M17.657 17.657l-.707-.707M6.343 17.657l-.707.707M17.657 6.343l-.707-.707" stroke="#5b6cff" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </div>
                <p className="text-sm font-medium" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Ask me anything!</p>
                <p className="text-xs" style={{ color: "#9ba3cc" }}>I&apos;m here to help you study, understand concepts, or prepare for your ILCDB program assessments.</p>
                <div className="flex flex-col gap-1.5 w-full">
                  {["Explain cloud computing in simple terms", "What is digital literacy?", "How do I prepare for the SPARK assessment?"].map((q) => (
                    <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} className="text-left text-xs px-3 py-2 rounded-lg transition-all" style={{ background: "rgba(91,108,255,0.08)", color: "#7c8bff", border: "1px solid rgba(91,108,255,0.15)" }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm" style={{ background: msg.role === "user" ? "#5b6cff" : "#1a1d30", color: msg.role === "user" ? "#fff" : "#e8eaff" }}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-3" style={{ background: "#1a1d30" }}>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#5b6cff", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-center" style={{ color: "#ff5f6d" }}>{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a question… (Enter to send)"
                rows={1}
                className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff", maxHeight: 100 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#5b6cff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
              <button onClick={send} disabled={!input.trim() || loading} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40" style={{ background: "#5b6cff" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
