"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { format, subDays, addDays } from "date-fns";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

type ConvexUserId = (typeof api.learnhub_journal.getEntry extends (...args: infer A) => unknown ? A[1] extends { userId: infer U } ? U : never : never);

const TODAY = () => new Date().toISOString().split("T")[0];

function extractTags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g) ?? [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export default function JournalPage() {
  const { userId } = useLearnhubSession();
  const [date, setDate] = useState(TODAY());
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const entry = useQuery(
    api.learnhub_journal.getEntry,
    userId ? { userId: userId as ConvexUserId, date } : "skip"
  );

  const recentEntries = useQuery(
    api.learnhub_journal.listEntries,
    userId ? { userId: userId as ConvexUserId, limit: 10 } : "skip"
  );

  const upsert = useMutation(api.learnhub_journal.upsertEntry);

  // Load entry content when date or entry changes
  useEffect(() => {
    if (entry !== undefined) setContent(entry?.content ?? "");
  }, [entry, date]);

  const save = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await upsert({ userId: userId as ConvexUserId, date, content, tags: extractTags(content) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [userId, date, content, upsert]);

  // Auto-save every 30s
  useEffect(() => {
    if (!userId || !content) return;
    const t = setTimeout(save, 30000);
    return () => clearTimeout(t);
  }, [content, save, userId]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tags = extractTags(content);

  const navigate = (dir: -1 | 1) => {
    const current = new Date(date + "T12:00:00");
    const next = dir === -1 ? subDays(current, 1) : addDays(current, 1);
    setDate(next.toISOString().split("T")[0]);
  };

  // Simple markdown renderer
  const renderMarkdown = (text: string) =>
    text
      .replace(/^# (.+)$/gm, '<h1 style="font-size:1.5em;font-weight:700;color:#e8eaff;margin:0.5em 0">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:1.2em;font-weight:600;color:#e8eaff;margin:0.4em 0">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8eaff">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em style="color:#c8caf0">$1</em>')
      .replace(/#([\w\u00C0-\u024F]+)/g, '<span style="color:#5b6cff">#$1</span>')
      .replace(/\n/g, "<br/>");

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex gap-6">
      {/* Main editor */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Date navigation */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg transition-colors" style={{ color: "#9ba3cc", background: "rgba(255,255,255,0.04)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex-1 text-center">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={TODAY()} className="bg-transparent text-sm font-semibold outline-none cursor-pointer" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }} />
            <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>{format(new Date(date + "T12:00:00"), "EEEE")}</p>
          </div>
          <button onClick={() => navigate(1)} disabled={date >= TODAY()} className="p-2 rounded-lg transition-colors disabled:opacity-30" style={{ color: "#9ba3cc", background: "rgba(255,255,255,0.04)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {/* Editor card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={() => setPreview((p) => !p)} className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium" style={{ background: preview ? "rgba(91,108,255,0.15)" : "transparent", color: preview ? "#7c8bff" : "#9ba3cc", border: preview ? "1px solid rgba(91,108,255,0.3)" : "1px solid transparent" }}>
              {preview ? "Edit" : "Preview"}
            </button>
            <div className="flex-1" />
            <span className="text-xs" style={{ color: "#5c6490" }}>{wordCount} words</span>
            {tags.length > 0 && (
              <div className="flex gap-1">
                {tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(91,108,255,0.1)", color: "#7c8bff" }}>#{t}</span>)}
              </div>
            )}
          </div>

          {/* Content area */}
          {preview ? (
            <div className="px-5 py-4 min-h-64 prose" style={{ color: "#e8eaff", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(content) || '<p style="color:#5c6490">Nothing to preview yet.</p>' }} />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`What did you learn today?\n\nTip: Use #hashtags to tag topics, **bold** or *italic* for emphasis, # Heading for sections.\n\nExample: Today I practiced #python and learned about #loops...`}
              className="w-full resize-none outline-none px-5 py-4 text-sm leading-relaxed"
              style={{ background: "transparent", color: "#e8eaff", minHeight: 320, fontFamily: "var(--font-dm-sans)" }}
            />
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs" style={{ color: "#5c6490" }}>
              {date < TODAY() ? `Entry for ${format(new Date(date + "T12:00:00"), "MMM d")}` : "Today's entry"}
            </p>
            <button onClick={save} disabled={saving || !userId} className="text-xs px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-40" style={{ background: saved ? "#22d3a0" : "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Recent entries sidebar */}
      <div className="w-48 shrink-0 hidden md:block">
        <p className="text-xs font-semibold mb-3" style={{ color: "#9ba3cc", fontFamily: "var(--font-sora)" }}>Recent Entries</p>
        <div className="flex flex-col gap-2">
          {recentEntries?.map((e) => (
            <button key={e._id} onClick={() => setDate(e.date)} className="text-left rounded-xl px-3 py-2.5 transition-all" style={{ background: e.date === date ? "rgba(91,108,255,0.12)" : "rgba(255,255,255,0.03)", border: e.date === date ? "1px solid rgba(91,108,255,0.3)" : "1px solid transparent" }}>
              <p className="text-xs font-semibold" style={{ color: e.date === date ? "#7c8bff" : "#e8eaff" }}>{format(new Date(e.date + "T12:00:00"), "MMM d")}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#5c6490" }}>{e.wordCount} words</p>
            </button>
          ))}
          {recentEntries?.length === 0 && <p className="text-xs" style={{ color: "#5c6490" }}>No entries yet</p>}
        </div>
      </div>
    </div>
  );
}
