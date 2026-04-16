"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import {
  Users, Clock, CheckSquare, CalendarCheck, Plus, ChevronRight,
  GraduationCap, TrendingUp, ClipboardList, BookOpen, LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────

const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f59e0b","#10b981","#3b82f6","#14b8a6"];
const avatarColor = (n: string) => AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (n: string) => n.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fmtH        = (h: number) => h <= 0 ? "0h" : `${Math.floor(h)}h`;

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE:    { label: "Active",   dot: "bg-green-400",  badge: "bg-green-50 text-green-700 border-green-200"  },
  COMPLETED: { label: "Done",     dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200"     },
  ON_LEAVE:  { label: "On Leave", dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200"  },
  INACTIVE:  { label: "Inactive", dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200"        },
};

const ATT_BADGE: Record<string, string> = {
  PRESENT:  "bg-green-50 text-green-700 border-green-200",
  HALF_DAY: "bg-amber-50 text-amber-700 border-amber-200",
  ABSENT:   "bg-red-50 text-red-700 border-red-200",
  LEAVE:    "bg-purple-50 text-purple-700 border-purple-200",
  HOLIDAY:  "bg-sky-50 text-sky-700 border-sky-200",
};

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-amber-400", LOW: "bg-gray-300",
};

const TASK_BADGE: Record<string, string> = {
  PENDING:     "bg-gray-50 text-gray-500 border-gray-200",
  IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-200",
  COMPLETED:   "bg-green-50 text-green-700 border-green-200",
  CANCELLED:   "bg-red-50 text-red-500 border-red-200",
};

const TABS = ["Overview", "DTR", "Activities", "Worksheet"] as const;
type Tab = typeof TABS[number];

// ── Page ──────────────────────────────────────────────────────

export default function InternPortalPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const interns = useQuery(api.interns.list);
  const today   = new Date().toISOString().slice(0, 10);
  const loading = interns === undefined;

  const stats = useMemo(() => {
    if (!interns) return null;
    const active       = interns.filter(i => i.status === "ACTIVE");
    const totalHours   = interns.reduce((s, i) => s + i.totalHours, 0);
    const pendingTasks = interns.flatMap(i => i.tasks).filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
    const presentToday = interns.filter(i => i.attendance.some(a => a.date === today && (a.status === "PRESENT" || a.status === "HALF_DAY"))).length;
    return { total: interns.length, active: active.length, totalHours, pendingTasks, presentToday };
  }, [interns, today]);

  const activeInterns = useMemo(() => (interns ?? []).filter(i => i.status === "ACTIVE"), [interns]);

  // DTR rows — last 30 days, most recent first
  const dtrRows = useMemo(() => (interns ?? [])
    .flatMap(i => i.attendance.map(a => ({ ...a, internName: i.fullName, school: i.school })))
    .filter(a => a.date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    .sort((a, b) => b.date.localeCompare(a.date)),
  [interns]);

  // Activity rows — all tasks, newest first
  const activityRows = useMemo(() => (interns ?? [])
    .flatMap(i => i.tasks.map(t => ({ ...t, internName: i.fullName, school: i.school })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [interns]);

  // Worksheet rows — attendance with timeIn logged (used as daily work log)
  const worksheetRows = useMemo(() => (interns ?? [])
    .flatMap(i => i.attendance
      .filter(a => a.timeIn || a.notes)
      .map(a => ({ ...a, internName: i.fullName, school: i.school }))
    )
    .sort((a, b) => b.date.localeCompare(a.date)),
  [interns]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Intern Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Summary of all Internship activity at DTC Region V</p>
        </div>
        <Link href="/intern-portal/list">
          <Button size="sm" className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow">
            <Plus className="w-4 h-4" />Manage Interns
          </Button>
        </Link>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { icon: Users,         color: "#6366f1", bg: "#eef2ff", label: "Total Interns",    val: stats?.total ?? 0,                       sub: `${stats?.active ?? 0} active` },
          { icon: Clock,         color: "#0ea5e9", bg: "#f0f9ff", label: "Hours Logged",     val: stats ? fmtH(stats.totalHours) : "—",    sub: "across all interns" },
          { icon: CheckSquare,   color: "#f59e0b", bg: "#fffbeb", label: "Pending Tasks",    val: stats?.pendingTasks ?? 0,                sub: "need attention" },
          { icon: CalendarCheck, color: "#10b981", bg: "#f0fdf4", label: "Today's Present",  val: stats?.presentToday ?? 0,               sub: `of ${stats?.active ?? 0} active` },
        ] as const).map(({ icon: Icon, color, bg, label, val, sub }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              {loading ? <Skeleton className="h-7 w-10 mb-1" /> : <p className="text-2xl font-bold text-gray-900 leading-tight">{val}</p>}
              <p className="text-xs font-semibold text-gray-700">{label}</p>
              <p className="text-[11px] text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-xs font-semibold transition-all border-b-2",
                tab === t
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              )}
            >
              {t === "Overview"    && <LayoutDashboard className="w-3.5 h-3.5" />}
              {t === "DTR"         && <CalendarCheck   className="w-3.5 h-3.5" />}
              {t === "Activities"  && <CheckSquare     className="w-3.5 h-3.5" />}
              {t === "Worksheet"   && <BookOpen        className="w-3.5 h-3.5" />}
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {tab === "Overview" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-700 flex items-center gap-2"><Users className="w-3.5 h-3.5" />Active Interns</p>
              <Link
                href="/intern-portal/list"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
              </div>
            ) : activeInterns.length === 0 ? (
              <div className="py-12 text-center">
                <GraduationCap className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No active interns</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeInterns.slice(0, 6).map(intern => {
                  const cfg   = STATUS_CFG[intern.status] ?? STATUS_CFG.INACTIVE;
                  const color = avatarColor(intern.fullName);
                  const pct   = intern.requiredHours > 0 ? Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100)) : 0;
                  const barC  = pct >= 100 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
                  const pending = intern.tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
                  return (
                    <Link key={intern.id} href={`/interns/${intern.id}`}>
                      <div className="bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all overflow-hidden group cursor-pointer">
                        <div className="h-1 bg-gray-200"><div className="h-full" style={{ width: `${pct}%`, backgroundColor: barC }} /></div>
                        <div className="p-3.5">
                          <div className="flex items-start justify-between mb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: color }}>{initials(intern.fullName)}</div>
                                <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white", cfg.dot)} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-blue-700 transition-colors truncate">{intern.fullName}</p>
                                <p className="text-[11px] text-gray-400 truncate">{intern.course ?? "—"}</p>
                              </div>
                            </div>
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ml-1", cfg.badge)}>{cfg.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                            <span className="text-[11px] font-bold" style={{ color }}>{intern.school}</span>
                            {intern.department && <span className="text-[11px] text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">{intern.department}</span>}
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                            <span>{fmtH(intern.totalHours)} / {intern.requiredHours}h</span>
                            <span className="font-bold" style={{ color: barC }}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-3">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barC }} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{fmtH(Math.max(0, intern.requiredHours - intern.totalHours))} left</span>
                            <span className="text-blue-500 font-semibold flex items-center gap-0.5">{pending} tasks <ChevronRight className="w-3 h-3" /></span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DTR tab ── */}
        {tab === "DTR" && (
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-700">Daily Time Record — Last 30 Days</p>
              <span className="text-[11px] text-gray-400 tabular-nums">{dtrRows.length} records</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
            ) : dtrRows.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No attendance records in the last 30 days</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold">
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Intern</th>
                    <th className="px-4 py-2.5 text-left hidden sm:table-cell">School</th>
                    <th className="px-4 py-2.5 text-left">Time In</th>
                    <th className="px-4 py-2.5 text-left">Time Out</th>
                    <th className="px-4 py-2.5 text-right">Hours</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-left hidden lg:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dtrRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-700 tabular-nums whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: avatarColor(row.internName) }}>{initials(row.internName)}</div>
                          <span className="font-medium text-gray-800 whitespace-nowrap">{row.internName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{row.school}</td>
                      <td className="px-4 py-2.5 text-gray-700 tabular-nums font-medium">{row.timeIn ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-gray-700 tabular-nums font-medium">{row.timeOut ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-blue-600">{row.hours != null ? `${row.hours}h` : "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", ATT_BADGE[row.status] ?? "bg-gray-50 text-gray-500 border-gray-200")}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 hidden lg:table-cell max-w-[180px] truncate">{row.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Activities tab ── */}
        {tab === "Activities" && (
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-700">All Intern Tasks & Activities</p>
              <span className="text-[11px] text-gray-400 tabular-nums">{activityRows.length} tasks</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
            ) : activityRows.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No tasks assigned yet</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold">
                    <th className="px-4 py-2.5 text-left w-4"></th>
                    <th className="px-4 py-2.5 text-left">Task</th>
                    <th className="px-4 py-2.5 text-left">Intern</th>
                    <th className="px-4 py-2.5 text-left hidden sm:table-cell">School</th>
                    <th className="px-4 py-2.5 text-center">Priority</th>
                    <th className="px-4 py-2.5 text-left hidden md:table-cell">Due Date</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activityRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className={cn("w-2 h-2 rounded-full", PRIORITY_DOT[row.priority] ?? "bg-gray-300")} />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{row.title}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: avatarColor(row.internName) }}>{initials(row.internName)}</div>
                          <span className="text-gray-700 whitespace-nowrap font-medium">{row.internName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{row.school}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                          row.priority === "URGENT" ? "bg-red-50 text-red-600" :
                          row.priority === "HIGH"   ? "bg-orange-50 text-orange-600" :
                          row.priority === "MEDIUM" ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500"
                        )}>{row.priority}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 tabular-nums hidden md:table-cell">{row.dueDate ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", TASK_BADGE[row.status] ?? "bg-gray-50 text-gray-500 border-gray-200")}>
                          {row.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Worksheet tab ── */}
        {tab === "Worksheet" && (
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-700">Daily Work Log &amp; Progress</p>
              <span className="text-[11px] text-gray-400 tabular-nums">{worksheetRows.length} entries</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
            ) : worksheetRows.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No worksheet entries yet</p>
                <p className="text-xs text-gray-300 mt-1">Entries appear when interns log time in/out</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold">
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Intern</th>
                    <th className="px-4 py-2.5 text-left hidden sm:table-cell">School</th>
                    <th className="px-4 py-2.5 text-left">Time In</th>
                    <th className="px-4 py-2.5 text-left">Time Out</th>
                    <th className="px-4 py-2.5 text-right">Hours</th>
                    <th className="px-4 py-2.5 text-left hidden md:table-cell">Progress Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {worksheetRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-700 tabular-nums whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: avatarColor(row.internName) }}>{initials(row.internName)}</div>
                          <span className="font-medium text-gray-800 whitespace-nowrap">{row.internName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{row.school}</td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium tabular-nums">{row.timeIn ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium tabular-nums">{row.timeOut ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-blue-600">{row.hours != null ? `${row.hours}h` : "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell max-w-[220px]">
                        {row.notes
                          ? <span className="line-clamp-1">{row.notes}</span>
                          : <span className="text-gray-300 italic">No notes</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
