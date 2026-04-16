"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Flame, Plus, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

const EMOJI_PRESETS = ["✅","📚","💪","🧘","💧","🚶","📝","💡","🎯","🔥","⏰","💬","🍎","😴","🧠","✍️"];
const MOOD_LABELS: Record<string, string> = { DAILY: "Daily", WEEKDAYS: "Weekdays" };

function MiniCal({ last7 }: { last7: { date: string; completed: boolean }[] }) {
  return (
    <div className="flex gap-1">
      {last7.map(d => {
        const dayLetter = new Date(d.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "narrow" });
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-white/20">{dayLetter}</span>
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center",
              d.completed ? "bg-indigo-500" : "bg-white/[0.06]"
            )}>
              {d.completed && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HabitsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [showAdd, setShowAdd]  = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const data       = useQuery(api.internPortal.getHabitsForToday, token ? { token } : "skip");
  const seedMut    = useMutation(api.internPortal.seedDefaultHabits);
  const toggleMut  = useMutation(api.internPortal.toggleHabit);
  const addMut     = useMutation(api.internPortal.addHabit);
  const removeMut  = useMutation(api.internPortal.removeHabit);

  useEffect(() => {
    if (token && data !== undefined && data?.totalToday === 0) {
      seedMut({ token }).catch(() => {});
    }
  }, [token, data, seedMut]);

  async function handleToggle(habitId: string) {
    if (!token) return;
    await toggleMut({ token, habitId: habitId as Id<"internHabits"> });
  }

  async function handleAdd() {
    if (!token || !newTitle.trim()) return;
    setSaving(true);
    try {
      await addMut({ token, title: newTitle.trim(), emoji: newEmoji });
      setNewTitle(""); setNewEmoji("✨"); setShowAdd(false);
    } finally { setSaving(false); }
  }

  async function handleRemove(habitId: string) {
    if (!token || !confirm("Remove this habit?")) return;
    await removeMut({ token, habitId: habitId as Id<"internHabits"> });
  }

  const completed = data?.completedToday ?? 0;
  const total     = data?.totalToday ?? 0;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone   = total > 0 && completed === total;

  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-extrabold flex items-center gap-2">
            <Flame className={cn("w-5 h-5", allDone ? "text-orange-400" : "text-white/30")} />
            Daily Habits
          </h1>
          <p className="text-white/30 text-xs mt-0.5">{today}</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="w-8 h-8 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 flex items-center justify-center transition-all">
          {showAdd ? <X className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-xs font-semibold">Today&apos;s Progress</span>
          <span className={cn("text-sm font-extrabold", allDone ? "text-green-400" : "text-white")}>
            {completed}/{total}
            {allDone && " 🎉"}
          </span>
        </div>
        <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", allDone ? "bg-green-400" : "bg-indigo-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
        {allDone && (
          <p className="text-green-400/80 text-xs text-center mt-2 font-medium">
            Amazing! All habits done for today 🔥
          </p>
        )}
      </div>

      {/* Add habit form */}
      {showAdd && (
        <div className="bg-indigo-950/60 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-white/70 text-xs font-bold uppercase tracking-wider">New Habit</p>
          <input
            type="text" placeholder="e.g. Read for 20 minutes" value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 outline-none focus:border-indigo-500 transition-all"
          />
          <div>
            <p className="text-white/30 text-[11px] mb-2">Pick an emoji</p>
            <div className="flex flex-wrap gap-2">
              {EMOJI_PRESETS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all",
                    newEmoji === e ? "bg-indigo-500 ring-2 ring-indigo-400" : "bg-white/[0.05] hover:bg-white/[0.10]"
                  )}>{e}</button>
              ))}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl py-2.5 transition-all">
            {saving ? "Adding…" : "Add Habit"}
          </button>
        </div>
      )}

      {/* Habits list */}
      {data === undefined ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 bg-white/[0.04] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (data?.habits ?? []).length === 0 ? (
        <div className="text-center py-10">
          <Flame className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No habits yet. Add your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.habits ?? []).map(habit => (
            <div key={habit.id}
              className={cn(
                "rounded-2xl border p-4 transition-all",
                habit.completedToday
                  ? "bg-indigo-500/10 border-indigo-500/25"
                  : "bg-white/[0.04] border-white/[0.07]"
              )}>
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <button onClick={() => handleToggle(habit.id)}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all active:scale-90",
                    habit.completedToday
                      ? "bg-indigo-500 shadow-lg shadow-indigo-900/40"
                      : "bg-white/[0.06] hover:bg-white/[0.10]"
                  )}>
                  {habit.completedToday ? <Check className="w-5 h-5 text-white" /> : <span>{habit.emoji}</span>}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold leading-tight",
                    habit.completedToday ? "text-white/80 line-through" : "text-white"
                  )}>{habit.title}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-white/25 bg-white/[0.05] px-1.5 py-0.5 rounded-full">
                      {MOOD_LABELS[habit.frequency] ?? habit.frequency}
                    </span>
                    {habit.streak > 0 && (
                      <span className="text-[10px] font-bold text-orange-400 flex items-center gap-0.5">
                        🔥 {habit.streak}-day streak
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove */}
                <button onClick={() => handleRemove(habit.id)}
                  className="text-white/10 hover:text-red-400 transition-colors p-1 rounded-lg shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mini 7-day calendar */}
              <div className="mt-3 pl-12">
                <MiniCal last7={habit.last7} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Motivational footer */}
      {total > 0 && !allDone && completed > 0 && (
        <div className="text-center py-2">
          <p className="text-white/25 text-xs">Keep going! {total - completed} more to complete today 💪</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
