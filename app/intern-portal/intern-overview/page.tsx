"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Users, Flame, BookOpen, CheckCircle2, Clock, Search, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarColor, initials } from "../_utils";

const ENGAGEMENT_COLOR = (score: number) =>
  score >= 80 ? "text-green-400 bg-green-400/10 border-green-400/20" :
  score >= 50 ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
               "text-red-400 bg-red-400/10 border-red-400/20";

export default function InternOverviewPage() {
  const data   = useQuery(api.internPortal.getSupervisorOverview);
  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState<"engagement" | "progress" | "name">("engagement");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    let list = data.filter(i =>
      i.fullName.toLowerCase().includes(q) ||
      (i.school ?? "").toLowerCase().includes(q) ||
      (i.supervisor ?? "").toLowerCase().includes(q)
    );
    if (sort === "engagement") list = [...list].sort((a, b) => b.engagementScore - a.engagementScore);
    if (sort === "progress")   list = [...list].sort((a, b) => b.progressPct - a.progressPct);
    if (sort === "name")       list = [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
    return list;
  }, [data, search, sort]);

  const summary = useMemo(() => {
    if (!data) return null;
    const checkedIn    = data.filter(i => i.todayCheckedIn).length;
    const habitsActive = data.filter(i => i.habitsToday.total > 0 && i.habitsToday.completed === i.habitsToday.total).length;
    const journaledToday = (() => {
      const today = new Date().toISOString().slice(0, 10);
      return data.filter(i => i.lastJournalDate === today).length;
    })();
    const avgScore = data.length > 0 ? Math.round(data.reduce((s, i) => s + i.engagementScore, 0) / data.length) : 0;
    return { checkedIn, habitsActive, journaledToday, avgScore };
  }, [data]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />Intern Engagement Overview
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Real-time tracking of habits, journals, and attendance across all active interns</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Checked In Today", val: `${summary?.checkedIn ?? 0}/${data?.length ?? 0}`, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "All Habits Done",  val: summary?.habitsActive ?? 0,                          icon: Flame,        color: "text-orange-500", bg: "bg-orange-50" },
          { label: "Journaled Today",  val: summary?.journaledToday ?? 0,                        icon: BookOpen,     color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Avg Engagement",   val: `${summary?.avgScore ?? 0}%`,                        icon: TrendingUp,   color: "text-blue-600",   bg: "bg-blue-50"   },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", s.bg)}>
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            {data === undefined
              ? <div className="h-7 w-10 bg-gray-100 rounded animate-pulse mb-1" />
              : <p className={cn("text-2xl font-extrabold", s.color)}>{s.val}</p>}
            <p className="text-[11px] text-gray-400 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text" placeholder="Search intern, school, supervisor…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(["engagement","progress","name"] as const).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize",
                sort === s ? "bg-white shadow text-gray-800" : "text-gray-400 hover:text-gray-600"
              )}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <Users className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-800">Active Interns</h3>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} interns</span>
        </div>

        {data === undefined ? (
          <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No interns found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(intern => {
              const today = new Date().toISOString().slice(0, 10);
              const journaledToday = intern.lastJournalDate === today;
              const habitsDone = intern.habitsToday.total > 0 && intern.habitsToday.completed === intern.habitsToday.total;

              return (
                <div key={intern.id} className="px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: avatarColor(intern.fullName) }}>
                      {initials(intern.fullName)}
                    </div>

                    {/* Name + school */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{intern.fullName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{intern.school}</p>
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Check-in */}
                      <div title={intern.todayCheckedIn ? "Checked in today" : "Not checked in"}
                        className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                          intern.todayCheckedIn ? "bg-green-50" : "bg-gray-50"
                        )}>
                        <Clock className={cn("w-3.5 h-3.5", intern.todayCheckedIn ? "text-green-500" : "text-gray-300")} />
                      </div>

                      {/* Habits */}
                      <div title={`${intern.habitsToday.completed}/${intern.habitsToday.total} habits done`}
                        className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                          habitsDone ? "bg-orange-50" : intern.habitsToday.completed > 0 ? "bg-amber-50" : "bg-gray-50"
                        )}>
                        <Flame className={cn("w-3.5 h-3.5",
                          habitsDone ? "text-orange-500" : intern.habitsToday.completed > 0 ? "text-amber-400" : "text-gray-300"
                        )} />
                      </div>

                      {/* Journal */}
                      <div title={journaledToday ? "Journaled today" : `Last: ${intern.lastJournalDate ?? "never"}`}
                        className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                          journaledToday ? "bg-indigo-50" : "bg-gray-50"
                        )}>
                        <BookOpen className={cn("w-3.5 h-3.5", journaledToday ? "text-indigo-500" : "text-gray-300")} />
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-24 shrink-0 hidden sm:block">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400">{intern.progressPct}%</span>
                        <span className="text-[10px] text-gray-300">{Math.floor(intern.totalHours)}h</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all",
                          intern.progressPct >= 100 ? "bg-green-400" :
                          intern.progressPct >= 50  ? "bg-blue-400"  : "bg-amber-400"
                        )} style={{ width: `${intern.progressPct}%` }} />
                      </div>
                    </div>

                    {/* Engagement score */}
                    <div className={cn(
                      "text-xs font-extrabold px-2.5 py-1 rounded-full border tabular-nums shrink-0 hidden md:block",
                      ENGAGEMENT_COLOR(intern.engagementScore)
                    )}>
                      {intern.engagementScore}%
                    </div>

                    {/* Tasks */}
                    <div className="text-right shrink-0 hidden lg:block">
                      <p className="text-[11px] font-semibold text-gray-700">{intern.tasksCompleted} done</p>
                      <p className="text-[10px] text-gray-400">{intern.tasksActive} active</p>
                    </div>
                  </div>

                  {/* Habit detail mini bar */}
                  {intern.habitsToday.total > 0 && (
                    <div className="mt-2 ml-12 flex items-center gap-2">
                      <div className="flex gap-0.5 flex-1 max-w-[120px]">
                        {Array.from({ length: intern.habitsToday.total }).map((_, i) => (
                          <div key={i} className={cn("h-1 flex-1 rounded-full", i < intern.habitsToday.completed ? "bg-orange-400" : "bg-gray-100")} />
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400">{intern.habitsToday.completed}/{intern.habitsToday.total} habits</span>
                      {intern.weeklyHabitDays > 0 && (
                        <span className="text-[10px] text-orange-400 font-medium">{intern.weeklyHabitDays}🔥 days this week</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
