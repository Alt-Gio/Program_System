"use client";

/**
 * /learnhub/journal â€” prompted reflection with today's-activity context.
 *
 * Three columns on desktop:
 *   • Left:  recent-entries list + 12-week heatmap
 *   • Middle: rotating prompt cards â†’ markdown editor â†’ "Today's activity" panel
 *   • Right:  mood / energy / confidence stack + "Weekly insight" button
 *
 * Reads `getEntry`, `listEntries`, and `getDayContext` from the extended
 * `convex/learnhub_journal` module. Save is a single `upsertEntry` call
 * that now persists mood/energy/confidence/promptResponses/linkedSessionIds.
 * The weekly insight runs through Groq via `requestWeeklySummary` and
 * no-ops gracefully when the API key isn't configured.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { format, subDays, addDays, startOfWeek } from "date-fns";
import { Smile, Frown, Meh, Sparkles, Calendar, BookMarked, Play, Save, Eye, EyeOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const ORANGE = "#f97316";
const INDIGO = "#5b6cff";
const GREEN = "#22d3a0";
const AMBER = "#fbbf24";

const TODAY = () => new Date().toISOString().split("T")[0];

type Mood = "low" | "ok" | "good" | "great";

const MOOD_OPTIONS: { id: Mood; label: string; emoji: string; color: string }[] = [
  { id: "low",   label: "Low",   emoji: "ðŸ˜ž", color: "#fb7185" },
  { id: "ok",    label: "OK",    emoji: "ðŸ˜", color: "var(--lh-text-2)" },
  { id: "good",  label: "Good",  emoji: "ðŸ™‚", color: GREEN },
  { id: "great", label: "Great", emoji: "ðŸ¤©", color: ORANGE },
];

function extractTags(text: string): string[] {
  const matches = text.match(/#[\wÀ-ɏ]+/g) ?? [];
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase())));
}

// Lightweight markdown â†’ HTML (same rules as the previous page; kept
// inline to avoid pulling in a markdown library for one preview pane).
function renderMarkdown(text: string): string {
  return text
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.5em;font-weight:700;color:var(--lh-text);margin:0.5em 0">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.2em;font-weight:600;color:var(--lh-text);margin:0.4em 0">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--lh-text)">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#c8caf0">$1</em>')
    .replace(/#([\wÀ-ɏ]+)/g, '<span style="color:#5b6cff">#$1</span>')
    .replace(/\n/g, "<br/>");
}

export default function JournalPage() {
  const { userId } = useLearnhubSession();
  const uid = userId ? (userId as Id<"learnhub_users">) : null;

  const [date, setDate] = useState(TODAY());
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<Mood | undefined>(undefined);
  const [energy, setEnergy] = useState<number | undefined>(undefined);
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [insight, setInsight] = useState<{
    status: "ok" | "not_configured" | "no_entries" | "error";
    text?: string;
    message?: string;
  } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const entry = useQuery(
    api.learnhub_journal.getEntry,
    uid ? { userId: uid, date } : "skip",
  );
  const recentEntries = useQuery(
    api.learnhub_journal.listEntries,
    uid ? { userId: uid, limit: 84 } : "skip", // 12 weeks of one-a-day
  );
  const dayContext = useQuery(
    api.learnhub_journal.getDayContext,
    uid ? { userId: uid, date, promptCount: 3 } : "skip",
  );

  const upsert = useMutation(api.learnhub_journal.upsertEntry);
  const requestSummary = useAction(api.learnhub_journal.requestWeeklySummary);

  // When the loaded entry changes (date switch / Convex refresh), pull its
  // values into the editor's local state.
  useEffect(() => {
    if (entry === undefined) return;
    setContent(entry?.content ?? "");
    setMood(entry?.mood ?? undefined);
    setEnergy(entry?.energy ?? undefined);
    setConfidence(entry?.confidence ?? undefined);
    setInsight(null);
  }, [entry, date]);

  const linkedSessionIds = useMemo<Id<"learnhub_video_sessions">[]>(() => {
    if (!dayContext) return [];
    return dayContext.sessions.map((s) => s.id as Id<"learnhub_video_sessions">);
  }, [dayContext]);

  const save = useCallback(async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await upsert({
        userId: uid,
        date,
        content,
        tags: extractTags(content),
        mood,
        energy,
        confidence,
        linkedSessionIds: linkedSessionIds.length > 0 ? linkedSessionIds : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }, [uid, date, content, mood, energy, confidence, linkedSessionIds, upsert]);

  // Auto-save 30s after the last edit (kept from previous version).
  useEffect(() => {
    if (!uid || !content) return;
    const t = setTimeout(save, 30000);
    return () => clearTimeout(t);
  }, [content, save, uid]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tags = extractTags(content);

  const navigate = (dir: -1 | 1) => {
    const current = new Date(date + "T12:00:00");
    const next = dir === -1 ? subDays(current, 1) : addDays(current, 1);
    setDate(next.toISOString().split("T")[0]);
  };

  const insertPrompt = (text: string, slug: string) => {
    const heading = `**${text}**`;
    const next = content
      ? `${content}\n\n${heading}\n`
      : `${heading}\n`;
    setContent(next);
    // Note: promptResponses persistence is a follow-up â€” for now the
    // prompt text lives inline in `content` like a markdown heading. Slug
    // is kept here so a future structured-response form can wire it.
    void slug;
  };

  const runWeeklyInsight = async () => {
    if (!uid) return;
    setInsightLoading(true);
    try {
      const weekStart = format(startOfWeek(new Date(date + "T12:00:00"), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const result = await requestSummary({ userId: uid, weekStart });
      setInsight(result);
    } catch (e) {
      setInsight({ status: "error", message: e instanceof Error ? e.message : "Failed" });
    } finally {
      setInsightLoading(false);
    }
  };

  if (!uid) {
    return (
      <div className="px-4 py-6" style={{ color: "var(--lh-text)" }}>
        <p>Sign in to use your journal.</p>
        <Link href="/learnhub/login" style={{ color: INDIGO }}>â† Sign in</Link>
      </div>
    );
  }

  // 12-week heatmap data â€” group recentEntries by date and bucket
  // intensity by wordCount.
  const heatmap = useMemo(() => {
    if (!recentEntries) return [] as Array<{ date: string; intensity: number; mood?: Mood }>;
    const byDate = new Map(recentEntries.map((e) => [e.date, e]));
    const out: Array<{ date: string; intensity: number; mood?: Mood }> = [];
    for (let i = 83; i >= 0; i--) {
      const d = subDays(new Date(), i).toISOString().split("T")[0];
      const e = byDate.get(d);
      let intensity = 0;
      if (e) {
        const wc = e.wordCount ?? 0;
        if (wc > 0) intensity = 1;
        if (wc > 60) intensity = 2;
        if (wc > 200) intensity = 3;
      }
      out.push({ date: d, intensity, mood: (e?.mood as Mood) ?? undefined });
    }
    return out;
  }, [recentEntries]);

  return (
    <div style={{
      padding: "20px 16px", color: "var(--lh-text)",
      fontFamily: "var(--font-dm-sans, 'Inter', sans-serif)",
      display: "grid",
      gridTemplateColumns: "260px 1fr 220px",
      gap: 18,
      alignItems: "flex-start",
      maxWidth: 1280, margin: "0 auto",
    }} className="lh-journal-grid">

      {/* â”€â”€ Left rail â”€â”€ */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 18 }} className="lh-journal-side">
        <section>
          <h2 style={{ margin: "0 0 8px", fontSize: 11, color: "var(--lh-text-2)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>
            12-week heatmap
          </h2>
          <div className="lh-journal-heatmap" style={{
            display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3,
            background: "rgba(255,255,255,0.02)", padding: 8, borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
            {Array.from({ length: 12 }).map((_, weekIdx) => (
              <div key={weekIdx} style={{ display: "grid", gridTemplateRows: "repeat(7, 1fr)", gap: 3 }}>
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cell = heatmap[weekIdx * 7 + dayIdx];
                  if (!cell) return <span key={dayIdx} style={{ width: 12, height: 12 }} />;
                  const colorByIntensity = ["var(--lh-card-3)", "#1e2240", "#3a3e6e", ORANGE];
                  return (
                    <button
                      key={dayIdx}
                      onClick={() => setDate(cell.date)}
                      title={`${cell.date} Â· ${cell.intensity > 0 ? "wrote" : "skipped"}`}
                      style={{
                        width: 12, height: 12, padding: 0, borderRadius: 3, cursor: "pointer",
                        border: cell.date === date ? `1.5px solid ${ORANGE}` : "1px solid transparent",
                        background: colorByIntensity[cell.intensity],
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ margin: "0 0 8px", fontSize: 11, color: "var(--lh-text-2)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>
            Recent entries
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
            {recentEntries === undefined && (
              <div style={{ color: "var(--lh-text-3)", fontSize: 12 }}>Loading…</div>
            )}
            {recentEntries && recentEntries.length === 0 && (
              <div style={{ color: "var(--lh-text-3)", fontSize: 12 }}>No entries yet</div>
            )}
            {recentEntries?.map((e) => {
              const isActive = e.date === date;
              return (
                <button key={e._id as unknown as string} onClick={() => setDate(e.date)} style={{
                  textAlign: "left", padding: "9px 11px", borderRadius: 10,
                  background: isActive ? "rgba(91,108,255,0.14)" : "rgba(255,255,255,0.03)",
                  border: isActive ? "1px solid rgba(91,108,255,0.35)" : "1px solid transparent",
                  cursor: "pointer",
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: isActive ? "#cdd2e6" : "var(--lh-text)", fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)" }}>
                    {format(new Date(e.date + "T12:00:00"), "EEE Â· MMM d")}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--lh-text-3)", display: "flex", gap: 6, alignItems: "center" }}>
                    <span>{e.wordCount} words</span>
                    {e.mood && <span>Â· {MOOD_OPTIONS.find((m) => m.id === e.mood)?.emoji}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      {/* â”€â”€ Middle column â”€â”€ */}
      <main style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        {/* Date navigation */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", borderRadius: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <button onClick={() => navigate(-1)} style={navBtnStyle()}>â€¹</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)} max={TODAY()}
              style={{
                background: "transparent", color: "var(--lh-text)",
                border: 0, outline: "none", fontSize: 14, fontWeight: 700,
                fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)",
                cursor: "pointer",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--lh-text-2)", marginTop: 2 }}>
              {format(new Date(date + "T12:00:00"), "EEEE")}
            </div>
          </div>
          <button onClick={() => navigate(1)} disabled={date >= TODAY()} style={{
            ...navBtnStyle(),
            opacity: date >= TODAY() ? 0.3 : 1,
          }}>â€º</button>
        </div>

        {/* Prompts */}
        <section>
          <h2 style={{ margin: "0 0 8px", fontSize: 11, color: "var(--lh-text-2)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={12} /> Today&rsquo;s prompts
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {dayContext === undefined && (
              <div style={{ height: 64, background: "rgba(255,255,255,0.03)", borderRadius: 10 }} />
            )}
            {dayContext?.prompts.map((p) => (
              <button key={p.slug} onClick={() => insertPrompt(p.text, p.slug)} style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(91,108,255,0.06)", border: "1px solid rgba(91,108,255,0.18)",
                color: "#cdd2e6", fontSize: 12.5, lineHeight: 1.4, cursor: "pointer",
                textAlign: "left", fontFamily: "inherit",
              }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: INDIGO, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  {p.category}
                </span>
                {p.text}
              </button>
            ))}
          </div>
        </section>

        {/* Editor */}
        <div style={{
          borderRadius: 14, overflow: "hidden",
          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <button onClick={() => setPreview((p) => !p)} style={{
              fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer",
              background: preview ? "rgba(91,108,255,0.18)" : "transparent",
              color: preview ? "#cdd2e6" : "var(--lh-text-2)",
              border: preview ? "1px solid rgba(91,108,255,0.35)" : "1px solid transparent",
              display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600,
            }}>
              {preview ? <Eye size={12} /> : <EyeOff size={12} />} {preview ? "Preview" : "Edit"}
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--lh-text-3)" }}>{wordCount} words</span>
            {tags.length > 0 && (
              <div style={{ display: "flex", gap: 4 }}>
                {tags.slice(0, 3).map((t) => (
                  <span key={t} style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 999,
                    background: "rgba(91,108,255,0.12)", color: "#7c8bff",
                  }}>#{t}</span>
                ))}
              </div>
            )}
          </div>
          {preview ? (
            <div
              style={{ padding: "14px 18px", minHeight: 280, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(content) || '<p style="color:#5c6490">Nothing to preview yet.</p>',
              }}
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`What did you learn today?\n\nTip: Use #hashtags to tag topics, **bold** or *italic* for emphasis, # Heading for sections. Click a prompt above to jumpstart your entry.`}
              style={{
                width: "100%", minHeight: 280, padding: "14px 18px",
                background: "transparent", color: "var(--lh-text)", outline: "none",
                border: 0, resize: "vertical", fontSize: 14, lineHeight: 1.65,
                fontFamily: "var(--font-dm-sans, 'Inter', sans-serif)",
              }}
            />
          )}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: 11, color: "var(--lh-text-3)" }}>
              {date < TODAY() ? `Entry for ${format(new Date(date + "T12:00:00"), "MMM d")}` : "Today's entry"}
              {linkedSessionIds.length > 0 && ` Â· ${linkedSessionIds.length} video${linkedSessionIds.length === 1 ? "" : "s"} linked`}
            </span>
            <button onClick={save} disabled={saving} style={{
              padding: "8px 16px", borderRadius: 999, border: 0,
              background: saved ? GREEN : `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
              color: "white", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Save size={12} /> {saving ? "Saving…" : saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        {/* Today's activity */}
        <section>
          <h2 style={{ margin: "0 0 8px", fontSize: 11, color: "var(--lh-text-2)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={12} /> Today&rsquo;s activity
            {dayContext && dayContext.sessions.length === 0 && dayContext.bookmarks.length === 0 && (
              <span style={{ color: "var(--lh-text-3)", letterSpacing: 0, textTransform: "none", fontWeight: 500, marginLeft: 6 }}>
                Â· nothing yet
              </span>
            )}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayContext?.sessions.map((s) => (
              <div key={s.id as unknown as string} style={{
                display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10,
                background: "rgba(34,211,160,0.06)", border: `1px solid ${GREEN}22`,
              }}>
                <span style={{ width: 64, aspectRatio: "16/9", borderRadius: 4, overflow: "hidden", background: "#10121e", flexShrink: 0 }}>
                  {s.thumbnail ? (
                    <img src={s.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : <Play size={14} style={{ color: "var(--lh-text-2)" }} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--lh-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--lh-text-2)", marginTop: 2 }}>{s.progressPct}% watched</div>
                </div>
              </div>
            ))}
            {dayContext?.bookmarks.map((b) => (
              <div key={b.id as unknown as string} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10,
                background: "rgba(91,108,255,0.06)", border: `1px solid ${INDIGO}22`, fontSize: 12, color: "#cdd2e6",
              }}>
                <BookMarked size={12} style={{ color: INDIGO }} />
                Saved a post Â· {b.status.replace("_", " ")}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* â”€â”€ Right rail â”€â”€ */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 14 }} className="lh-journal-side">
        <section style={{
          padding: 14, borderRadius: 12,
          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 11, color: "var(--lh-text-2)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>
            How was today?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
            {MOOD_OPTIONS.map((m) => {
              const active = mood === m.id;
              return (
                <button key={m.id} onClick={() => setMood(active ? undefined : m.id)} title={m.label} style={{
                  padding: "10px 4px", borderRadius: 10,
                  background: active ? `${m.color}1c` : "var(--lh-card-3)",
                  border: active ? `1px solid ${m.color}66` : "1px solid rgba(255,255,255,0.06)",
                  color: active ? m.color : "var(--lh-text-2)",
                  cursor: "pointer", fontSize: 20,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}>
                  {m.emoji}
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <UnitSlider label="Energy" icon={<Smile size={12} />} value={energy} onChange={setEnergy} hue={AMBER} />
        <UnitSlider label="Confidence" icon={<Meh size={12} />} value={confidence} onChange={setConfidence} hue={INDIGO} />

        <section style={{
          padding: 14, borderRadius: 12,
          background: `linear-gradient(180deg, ${AMBER}10, rgba(255,255,255,0.025))`,
          border: `1px solid ${AMBER}33`,
        }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 11, color: AMBER, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>
            Weekly insight
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--lh-text-2)", lineHeight: 1.45 }}>
            Ask the coach to summarize this week&rsquo;s journal â€” themes, wins, and one suggestion.
          </p>
          <button onClick={runWeeklyInsight} disabled={insightLoading} style={{
            width: "100%", padding: "9px 12px", borderRadius: 10,
            background: AMBER, color: "var(--lh-bg)", border: 0,
            fontWeight: 700, fontSize: 12, cursor: insightLoading ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Sparkles size={12} /> {insightLoading ? "Generating…" : "Generate insight"}
          </button>
          {insight && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.3)", fontSize: 12, color: "var(--lh-text)", lineHeight: 1.55 }}>
              {insight.status === "ok" && (insight.text ?? "").split("\n").map((line, i) => (
                <p key={i} style={{ margin: "0 0 4px" }}>{line}</p>
              ))}
              {insight.status === "not_configured" && (
                <span style={{ color: "var(--lh-text-2)" }}>
                  Insights aren&rsquo;t configured for this deployment. Ask an admin to set <code style={{ color: AMBER }}>LEARNHUB_GROQ_API_KEY</code>.
                </span>
              )}
              {insight.status === "no_entries" && (
                <span style={{ color: "var(--lh-text-2)" }}>Write a few entries first â€” there&rsquo;s nothing to summarize yet.</span>
              )}
              {insight.status === "error" && (
                <span style={{ color: "#fb7185" }}>{insight.message ?? "Insight failed."}</span>
              )}
            </div>
          )}
        </section>
      </aside>

      {/* Stack to single column on narrow viewports */}
      <style>{`
        @media (max-width: 1024px) {
          .lh-journal-grid { grid-template-columns: 1fr !important; }
          .lh-journal-side { order: 2; }
        }
      `}</style>
    </div>
  );
}

function navBtnStyle(): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 8, padding: 0,
    background: "var(--lh-card-3)", border: "1px solid rgba(255,255,255,0.06)",
    color: "var(--lh-text-2)", cursor: "pointer", fontSize: 16, fontWeight: 700,
  };
}

function UnitSlider({
  label, icon, value, onChange, hue,
}: {
  label: string; icon: React.ReactNode;
  value: number | undefined; onChange: (n: number | undefined) => void; hue: string;
}) {
  return (
    <section style={{
      padding: 12, borderRadius: 12,
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ color: hue }}>{icon}</span>
        <span style={{ fontSize: 11, color: "var(--lh-text-2)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800 }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: value ? hue : "var(--lh-text-3)" }}>
          {value ?? "â€”"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = value !== undefined && value >= n;
          return (
            <button key={n} onClick={() => onChange(value === n ? undefined : n)} style={{
              padding: 8, borderRadius: 8, cursor: "pointer",
              background: filled ? `${hue}28` : "var(--lh-card-3)",
              border: filled ? `1px solid ${hue}66` : "1px solid rgba(255,255,255,0.06)",
              color: filled ? hue : "var(--lh-text-3)",
              fontSize: 11, fontWeight: 700,
            }}>{n}</button>
          );
        })}
      </div>
    </section>
  );
}
