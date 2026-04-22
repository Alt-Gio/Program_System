"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookOpen, Plus, Check, Trash2, Target, ChevronDown, ChevronUp, WifiOff, CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import {
  enqueue,
  countQueued,
  generateClientId,
  requestSwDrain,
  drainQueue,
} from "@/lib/offline-queue";

const JOURNAL_ENDPOINT = "/api/intern/journal/upsert";
const JOURNAL_STORE = "internJournalQueue" as const;

const MOODS = [
  { key: "GREAT", emoji: "🌟", label: "Great",  color: "bg-yellow-400/20 border-yellow-400/30 text-yellow-300" },
  { key: "GOOD",  emoji: "😊", label: "Good",   color: "bg-green-400/20 border-green-400/30 text-green-300"   },
  { key: "OKAY",  emoji: "😐", label: "Okay",   color: "bg-blue-400/20 border-blue-400/30 text-blue-300"      },
  { key: "ROUGH", emoji: "😔", label: "Rough",  color: "bg-red-400/20 border-red-400/30 text-red-300"         },
];

const MOOD_MAP = Object.fromEntries(MOODS.map(m => [m.key, m]));

const SECTIONS = [
  { key: "accomplishments", label: "What did I accomplish today?", placeholder: "List what you completed, tasks done, goals met…", emoji: "✅" },
  { key: "learnings",       label: "What did I learn?",            placeholder: "New skills, insights, knowledge gained…",          emoji: "💡" },
  { key: "challenges",      label: "What challenges did I face?",  placeholder: "Difficulties, blockers, things to improve…",       emoji: "🚧" },
  { key: "tomorrowPlan",    label: "Plan for tomorrow",            placeholder: "Top 3 things you want to accomplish tomorrow…",    emoji: "🎯" },
] as const;

type SectionKey = typeof SECTIONS[number]["key"];
type LogForm = Record<SectionKey, string> & { mood: string };

const EMPTY: LogForm = { accomplishments: "", learnings: "", challenges: "", tomorrowPlan: "", mood: "" };

export default function JournalPage() {
  const [token, setToken] = useState<string | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const todayLog  = useQuery(api.internPortal.getDailyLog,  token ? { token, date: today } : "skip");
  const pastLogs  = useQuery(api.internPortal.listDailyLogs, token ? { token } : "skip");
  const goals     = useQuery(api.internPortal.listGoals,     token ? { token } : "skip");

  const addGoalMut = useMutation(api.internPortal.addGoal);
  const toggleGoal = useMutation(api.internPortal.toggleGoal);
  const deleteGoal = useMutation(api.internPortal.deleteGoal);

  const [form,       setForm]       = useState<LogForm>({ ...EMPTY });
  const [saved,      setSaved]      = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [goalInput,  setGoalInput]  = useState("");
  const [showGoals,  setShowGoals]  = useState(true);
  const [showPast,   setShowPast]   = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsOnline(navigator.onLine);
    const onOnline = () => {
      setIsOnline(true);
      requestSwDrain();
      drainQueue(JOURNAL_STORE, JOURNAL_ENDPOINT).then(() =>
        countQueued(JOURNAL_STORE).then(setQueuedCount)
      );
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    countQueued(JOURNAL_STORE).then(setQueuedCount);
    const onSw = (e: MessageEvent) => {
      if (e.data?.type === "dtc-sync-result") {
        countQueued(JOURNAL_STORE).then(setQueuedCount);
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSw);
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSw);
      }
    };
  }, []);

  useEffect(() => {
    if (todayLog === undefined) return;
    if (todayLog) {
      setForm({
        accomplishments: todayLog.accomplishments ?? "",
        learnings:       todayLog.learnings ?? "",
        challenges:      todayLog.challenges ?? "",
        tomorrowPlan:    todayLog.tomorrowPlan ?? "",
        mood:            todayLog.mood ?? "",
      });
    }
  }, [todayLog]);

  const handleChange = useCallback((key: SectionKey, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setSaved(false);
  }, []);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSavedOffline(false);
    const payload = {
      clientId: generateClientId(),
      token,
      date: today,
      accomplishments: form.accomplishments || undefined,
      mood:            form.mood            || undefined,
      learnings:       form.learnings       || undefined,
      challenges:      form.challenges      || undefined,
      tomorrowPlan:    form.tomorrowPlan    || undefined,
      submittedOffline: typeof navigator !== "undefined" && !navigator.onLine,
    };
    try {
      const res = await fetch(JOURNAL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 202) {
        setSavedOffline(true);
        setSaved(true);
        countQueued(JOURNAL_STORE).then(setQueuedCount);
      } else if (res.ok) {
        setSaved(true);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Save failed");
      }
    } catch {
      try {
        await enqueue(JOURNAL_STORE, payload);
        setSavedOffline(true);
        setSaved(true);
        countQueued(JOURNAL_STORE).then(setQueuedCount);
      } catch {
        // last-ditch: leave `saved` false so user can retry
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddGoal() {
    if (!token || !goalInput.trim()) return;
    await addGoalMut({ token, title: goalInput.trim() });
    setGoalInput("");
  }

  const hasContent = SECTIONS.some(s => form[s.key].trim().length > 0) || form.mood;

  const pendingGoals   = (goals ?? []).filter(g => !g.isCompleted);
  const completedGoals = (goals ?? []).filter(g => g.isCompleted);

  const displayDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-white text-xl font-extrabold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          Daily Journal
        </h1>
        <p className="text-white/30 text-xs mt-0.5">
          {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {(!isOnline || queuedCount > 0) && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
            !isOnline
              ? "bg-amber-500/10 border border-amber-500/30 text-amber-200"
              : "bg-indigo-500/10 border border-indigo-500/30 text-indigo-200"
          )}
        >
          {!isOnline ? <WifiOff className="w-4 h-4" /> : <CloudUpload className="w-4 h-4" />}
          <span className="flex-1">
            {!isOnline && queuedCount === 0 && "You're offline. Entries save locally."}
            {!isOnline && queuedCount > 0 &&
              `You're offline. ${queuedCount} entry${queuedCount === 1 ? "" : "ies"} waiting to sync.`}
            {isOnline && queuedCount > 0 && `Syncing ${queuedCount} saved entry${queuedCount === 1 ? "" : "ies"}…`}
          </span>
          {isOnline && queuedCount > 0 && (
            <button
              onClick={() => {
                requestSwDrain();
                drainQueue(JOURNAL_STORE, JOURNAL_ENDPOINT).then(() =>
                  countQueued(JOURNAL_STORE).then(setQueuedCount)
                );
              }}
              className="text-indigo-200 font-semibold underline"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      {/* Mood selector */}
      <div>
        <p className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2.5">How are you feeling today?</p>
        <div className="grid grid-cols-4 gap-2">
          {MOODS.map(m => (
            <button key={m.key}
              onClick={() => { setForm(f => ({ ...f, mood: f.mood === m.key ? "" : m.key })); setSaved(false); }}
              className={cn(
                "rounded-2xl border py-2.5 flex flex-col items-center gap-1 transition-all active:scale-95",
                form.mood === m.key ? m.color : "bg-white/[0.04] border-white/[0.07] hover:bg-white/[0.07]"
              )}>
              <span className="text-xl">{m.emoji}</span>
              <span className={cn("text-[10px] font-semibold", form.mood === m.key ? "" : "text-white/30")}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Journal sections */}
      <div className="space-y-3">
        {SECTIONS.map(section => (
          <div key={section.key} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center gap-2">
              <span className="text-base">{section.emoji}</span>
              <p className="text-white/60 text-xs font-semibold">{section.label}</p>
            </div>
            <textarea
              rows={3}
              placeholder={section.placeholder}
              value={form[section.key]}
              onChange={e => handleChange(section.key, e.target.value)}
              className="w-full bg-transparent px-4 py-3 text-white text-sm placeholder:text-white/15 outline-none resize-none leading-relaxed"
            />
          </div>
        ))}
      </div>

      {/* Save button */}
      <button onClick={handleSave} disabled={saving || !hasContent}
        className={cn(
          "w-full rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-all",
          saved && savedOffline
            ? "bg-amber-500/20 border border-amber-500/30 text-amber-200"
            : saved
            ? "bg-green-500/20 border border-green-500/30 text-green-300"
            : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
        )}>
        {saving
          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : saved && savedOffline
            ? <><CloudUpload className="w-4 h-4" />Saved offline — will sync</>
            : saved
            ? <><Check className="w-4 h-4" />Saved!</>
            : "Save Today's Entry"
        }
      </button>

      {/* Goals section */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <button onClick={() => setShowGoals(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-all">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-white/70 text-sm font-bold">My Goals</span>
            {pendingGoals.length > 0 && (
              <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                {pendingGoals.length}
              </span>
            )}
          </div>
          {showGoals ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </button>

        {showGoals && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
            {/* Add goal */}
            <div className="flex gap-2">
              <input type="text" placeholder="Add a goal…" value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddGoal(); }}
                className="flex-1 bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 outline-none focus:border-indigo-500 transition-all" />
              <button onClick={handleAddGoal} disabled={!goalInput.trim()}
                className="w-9 h-9 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 flex items-center justify-center disabled:opacity-40 transition-all">
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Pending goals */}
            {pendingGoals.length > 0 && (
              <div className="space-y-2">
                {pendingGoals.map(g => (
                  <div key={g._id} className="flex items-center gap-2 group">
                    <button onClick={() => token && toggleGoal({ token, goalId: g._id as Id<"internGoals"> })}
                      className="w-5 h-5 rounded-md border border-white/20 hover:border-indigo-400 flex items-center justify-center shrink-0 transition-all">
                    </button>
                    <p className="flex-1 text-white/70 text-xs">{g.title}</p>
                    {g.targetDate && <span className="text-white/25 text-[10px]">{g.targetDate}</span>}
                    <button onClick={() => deleteGoal({ goalId: g._id as Id<"internGoals"> })}
                      className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Completed goals */}
            {completedGoals.length > 0 && (
              <div className="space-y-1.5 mt-1">
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-wider">Completed</p>
                {completedGoals.map(g => (
                  <div key={g._id} className="flex items-center gap-2 opacity-50">
                    <div className="w-5 h-5 rounded-md bg-green-500/30 border border-green-400/30 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-green-400" />
                    </div>
                    <p className="text-white/40 text-xs line-through">{g.title}</p>
                  </div>
                ))}
              </div>
            )}

            {pendingGoals.length === 0 && completedGoals.length === 0 && (
              <p className="text-white/20 text-xs text-center py-2">No goals yet. Set your first goal! 🎯</p>
            )}
          </div>
        )}
      </div>

      {/* Past entries */}
      <div>
        <button onClick={() => setShowPast(v => !v)}
          className="w-full flex items-center justify-between py-2 hover:opacity-80 transition-opacity">
          <span className="text-white/40 text-[11px] font-bold uppercase tracking-wider">
            Past Entries ({(pastLogs ?? []).filter(l => l.date !== today).length})
          </span>
          {showPast ? <ChevronUp className="w-4 h-4 text-white/20" /> : <ChevronDown className="w-4 h-4 text-white/20" />}
        </button>

        {showPast && (
          <div className="space-y-2 mt-2">
            {(pastLogs ?? []).filter(l => l.date !== today).map(log => {
              const mood = log.mood ? MOOD_MAP[log.mood] : null;
              const isExp = expandedLog === log._id;
              return (
                <div key={log._id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <button onClick={() => setExpandedLog(isExp ? null : log._id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-all">
                    <div className="flex items-center gap-2.5">
                      {mood && <span className="text-base">{mood.emoji}</span>}
                      <p className="text-white/60 text-xs font-semibold">{displayDate(log.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.accomplishments && <span className="text-[10px] text-indigo-400/60 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">✅ Done</span>}
                      {isExp ? <ChevronUp className="w-3.5 h-3.5 text-white/20" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
                    </div>
                  </button>

                  {isExp && (
                    <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-3">
                      {SECTIONS.filter(s => (log as any)[s.key]).map(s => (
                        <div key={s.key}>
                          <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">
                            {s.emoji} {s.label}
                          </p>
                          <p className="text-white/60 text-xs leading-relaxed whitespace-pre-wrap">{(log as any)[s.key]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {(pastLogs ?? []).filter(l => l.date !== today).length === 0 && (
              <p className="text-white/20 text-xs text-center py-4">No past entries yet. Keep journaling daily!</p>
            )}
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}
