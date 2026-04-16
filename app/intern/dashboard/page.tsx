"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { CheckCircle2, Clock, ListTodo, Calendar, Flame, BookOpen, Target, Trophy, AlertCircle, QrCode, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500", HIGH: "bg-orange-400", MEDIUM: "bg-amber-400", LOW: "bg-gray-400",
};
const TASK_BADGE: Record<string, string> = {
  PENDING: "text-gray-400 bg-white/[0.05]", IN_PROGRESS: "text-blue-400 bg-blue-500/10",
  COMPLETED: "text-green-400 bg-green-500/10", CANCELLED: "text-red-400 bg-red-500/10",
};

function Ring({ pct, size = 96, stroke = 9, color }: { pct: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

const MILESTONES = [
  { id: "first_checkin",  emoji: "🌱", label: "First Check-in",    check: (d: any) => d.attendance.length >= 1 },
  { id: "hours_25",       emoji: "⚡", label: "25 Hours",           check: (d: any) => d.totalHours >= 25 },
  { id: "hours_50",       emoji: "🏅", label: "Halfway There",      check: (d: any) => d.totalHours >= d.requiredHours * 0.5 },
  { id: "task_5",         emoji: "✅", label: "5 Tasks Done",       check: (d: any) => d.tasks.filter((t: any) => t.status === "COMPLETED").length >= 5 },
  { id: "hours_100",      emoji: "🏆", label: "Full Completion",    check: (d: any) => d.totalHours >= d.requiredHours },
];

export default function InternDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const data        = useQuery(api.internAuth.getMyData,           token ? { token } : "skip");
  const habitData   = useQuery(api.internPortal.getHabitsForToday, token ? { token } : "skip");
  const pastLogs    = useQuery(api.internPortal.listDailyLogs,     token ? { token } : "skip");
  const goals       = useQuery(api.internPortal.listGoals,         token ? { token } : "skip");
  const allMessages = useQuery(api.supervisorTools.getInternMessages, token ? { internToken: token } : "skip");
  const unreadMsgs  = useMemo(() => allMessages?.filter((m: any) => m.senderType === "supervisor" && !m.readAt).length ?? 0, [allMessages]);

  const today    = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayAtt = useMemo(() => data?.attendance.find(a => a.date === today), [data, today]);

  const stats = useMemo(() => {
    if (!data) return null;
    const pct      = data.requiredHours > 0 ? Math.min(100, Math.round((data.totalHours / data.requiredHours) * 100)) : 0;
    const pend     = data.tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
    const attDays  = data.attendance.filter(a => a.status === "PRESENT" || a.status === "HALF_DAY").length;
    const daysLeft = Math.max(0, Math.round((new Date(data.endDate).getTime() - Date.now()) / 86400000));
    return { pct, pend, attDays, daysLeft };
  }, [data]);

  const habitPct = habitData && habitData.totalToday > 0
    ? Math.round((habitData.completedToday / habitData.totalToday) * 100)
    : 0;

  const lastJournal = (pastLogs ?? []).find(l => l.date === today) ?? (pastLogs ?? [])[0] ?? null;
  const journaledToday = lastJournal?.date === today;

  const unlockedMilestones = useMemo(() => data ? MILESTONES.filter(m => m.check(data)) : [], [data]);

  const pendingGoals = (goals ?? []).filter(g => !g.isCompleted).slice(0, 3);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, []);

  const firstName = data?.fullName.split(" ")[0] ?? "Intern";

  if (data === undefined && token) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
      <AlertCircle className="w-10 h-10 text-white/20" />
      <p className="text-white/40 text-sm">Session expired.</p>
      <Link href="/intern/login" className="text-indigo-400 text-sm font-medium">Sign in again</Link>
    </div>
  );

  const activeTasks = data.tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS");

  return (
    <div className="px-4 md:px-8 py-5 md:py-8 space-y-4 md:space-y-0 max-w-7xl mx-auto">

      {/* ── Greeting header ── */}
      <div className="mb-5 md:mb-7">
        <p className="text-white/40 text-xs md:text-sm">{greeting},</p>
        <h1 className="text-white text-2xl md:text-3xl font-extrabold leading-tight">{firstName} 👋</h1>
        <p className="text-white/30 text-xs md:text-sm mt-0.5">{data.school} · {data.course ?? "OJT Intern"}</p>
      </div>

      {/* ── Desktop two-column / Mobile single-column ── */}
      <div className="md:grid md:grid-cols-[1fr_340px] md:gap-6">

        {/* ─── LEFT COLUMN ─── */}
        <div className="space-y-4">

          {/* Attendance banner */}
          <Link href="/intern/qr" className={cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all active:scale-[0.98] hover:brightness-110",
            todayAtt?.timeIn && !todayAtt.timeOut ? "bg-green-500/10 border-green-500/25" :
            todayAtt?.timeOut ? "bg-blue-500/10 border-blue-500/25" : "bg-white/[0.04] border-white/[0.08]"
          )}>
            {todayAtt?.timeIn && !todayAtt.timeOut ? (
              <><div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              <div className="flex-1"><p className="text-green-300 text-sm font-bold">Checked In</p>
              <p className="text-white/40 text-[11px]">Since {todayAtt.timeIn.slice(11,16)} · Tap to check out</p></div>
              <ArrowRight className="w-4 h-4 text-green-400/50" /></>
            ) : todayAtt?.timeOut ? (
              <><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="flex-1"><p className="text-blue-300 text-sm font-bold">Done for today 🎉</p>
              <p className="text-white/40 text-[11px]">{todayAtt.hours != null ? `${todayAtt.hours}h logged` : ""} · Out {todayAtt.timeOut.slice(11,16)}</p></div></>
            ) : (
              <><div className="w-2.5 h-2.5 rounded-full bg-white/20 shrink-0" />
              <div className="flex-1"><p className="text-white/50 text-sm font-bold">Not checked in yet</p>
              <p className="text-white/30 text-[11px]">Tap to log your GPS-verified attendance</p></div>
              <ArrowRight className="w-4 h-4 text-white/20" /></>
            )}
          </Link>

          {/* Quick actions grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link href="/intern/qr"
              className="bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/30 rounded-2xl p-4 flex flex-col gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-900/30">
              <QrCode className="w-6 h-6 text-indigo-200" />
              <div>
                <p className="text-white font-bold text-sm">QR Attendance</p>
                <p className="text-indigo-200/60 text-[11px]">Check in · Show QR</p>
              </div>
            </Link>
            <Link href="/intern/tasks"
              className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2 transition-all active:scale-95">
              <ListTodo className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-white font-bold text-sm">My Tasks</p>
                <p className="text-amber-400/60 text-[11px]">
                  {activeTasks.length > 0 ? `${activeTasks.length} active task${activeTasks.length > 1 ? "s" : ""}` : "All caught up ✓"}
                </p>
              </div>
            </Link>
            <Link href="/intern/journal"
              className={cn(
                "border rounded-2xl p-4 flex flex-col gap-2 transition-all active:scale-95",
                journaledToday ? "bg-green-500/10 border-green-500/20" : "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08]"
              )}>
              <BookOpen className={cn("w-6 h-6", journaledToday ? "text-green-400" : "text-white/50")} />
              <div>
                <p className="text-white font-bold text-sm">Daily Journal</p>
                <p className={cn("text-[11px]", journaledToday ? "text-green-400/70" : "text-white/30")}>
                  {journaledToday ? "✅ Logged today" : "Not logged yet"}
                </p>
              </div>
            </Link>
          </div>

          {/* Active tasks list */}
          {activeTasks.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ListTodo className="w-3 h-3" />Active Tasks
                </p>
                <Link href="/intern/tasks" className="text-indigo-400 text-[11px] font-semibold hover:text-indigo-300 flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {activeTasks.slice(0, 5).map(task => (
                  <Link key={task.id} href="/intern/tasks"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[task.priority] ?? "bg-gray-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{task.title}</p>
                      {task.dueDate && <p className="text-white/25 text-[10px]">Due {task.dueDate}</p>}
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", TASK_BADGE[task.status])}>
                      {task.status.replace("_"," ")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <Link href="/intern/messages" className={cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all active:scale-[0.98] hover:brightness-110",
            unreadMsgs > 0 ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/[0.03] border-white/[0.06]"
          )}>
            <div className="relative">
              <MessageSquare className={cn("w-5 h-5", unreadMsgs > 0 ? "text-indigo-400" : "text-white/30")} />
              {unreadMsgs > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">{unreadMsgs}</span>
              )}
            </div>
            <div className="flex-1">
              <p className={cn("text-xs font-bold", unreadMsgs > 0 ? "text-indigo-300" : "text-white/40")}>
                {unreadMsgs > 0 ? `${unreadMsgs} new message${unreadMsgs > 1 ? "s" : ""} from supervisor` : "Messages from Supervisor"}
              </p>
              <p className="text-white/25 text-[11px]">{allMessages ? `${allMessages.length} total` : "Tap to view"}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/20" />
          </Link>

          {/* Supervisor */}
          {data.supervisor && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-[11px] font-bold shrink-0">
                {data.supervisor.split(" ").map((w: string) => w[0]).slice(0,2).join("")}
              </div>
              <div>
                <p className="text-white/30 text-[10px]">Your Supervisor</p>
                <p className="text-white text-sm font-semibold">{data.supervisor}</p>
              </div>
              {data.department && <p className="ml-auto text-white/20 text-[11px]">{data.department}</p>}
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN (desktop) ─── */}
        <div className="space-y-4 mt-4 md:mt-0">

          {/* Dual progress rings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 flex flex-col items-center gap-2">
              <div className="relative">
                <Ring pct={stats?.pct ?? 0} size={88} color={stats?.pct ?? 0 >= 100 ? "#34d399" : "#818cf8"} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white font-extrabold text-base leading-none">{stats?.pct ?? 0}%</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-xs">{Math.floor(data.totalHours)}h / {data.requiredHours}h</p>
                <p className="text-white/30 text-[10px]">OJT Hours</p>
              </div>
            </div>
            <Link href="/intern/habits" className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-[0.98] transition-all">
              <div className="relative">
                <Ring pct={habitPct} size={88} color={habitPct === 100 ? "#f97316" : "#6366f1"} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white font-extrabold text-base leading-none">{habitPct}%</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-xs flex items-center gap-1 justify-center">
                  <Flame className={cn("w-3 h-3", habitPct === 100 ? "text-orange-400" : "text-indigo-400")} />Habits
                </p>
                <p className="text-white/30 text-[10px]">{habitData?.completedToday ?? 0}/{habitData?.totalToday ?? 0} today</p>
              </div>
            </Link>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: ListTodo, val: activeTasks.length,   label: "Active",  color: "text-amber-400"  },
              { icon: Calendar, val: stats?.attDays ?? 0,   label: "Days",    color: "text-green-400"  },
              { icon: Clock,    val: stats?.daysLeft ?? 0,  label: "Left",    color: "text-indigo-400" },
            ].map(({ icon: Icon, val, label, color }) => (
              <div key={label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-center">
                <Icon className={cn("w-4 h-4 mx-auto mb-1", color)} />
                <p className="text-white font-extrabold text-base leading-none">{val}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Milestones */}
          {unlockedMilestones.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3.5">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-amber-400" />Achievements
              </p>
              <div className="flex gap-2 flex-wrap">
                {unlockedMilestones.map(m => (
                  <div key={m.id} className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                    <span className="text-sm">{m.emoji}</span>
                    <span className="text-amber-300 text-[11px] font-semibold">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goals */}
          {pendingGoals.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider px-4 pt-3.5 pb-2 flex items-center gap-1.5">
                <Target className="w-3 h-3 text-indigo-400" />My Goals
              </p>
              <div className="divide-y divide-white/[0.04] pb-1">
                {pendingGoals.map(g => (
                  <div key={g._id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <p className="text-white/60 text-xs flex-1">{g.title}</p>
                    {g.targetDate && <span className="text-white/25 text-[10px]">{g.targetDate}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-4 md:h-6" />
    </div>
  );
}
