"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BarChart2, TrendingUp, Award, Users, Clock, CheckSquare, CalendarCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { avatarColor, initials, STATUS_CFG } from "../_utils";

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>{Math.min(100, pct)}%</span>
    </div>
  );
}

export default function ReportsPage() {
  const interns = useQuery(api.interns.list);
  const today   = new Date().toISOString().slice(0, 10);
  const loading = interns === undefined;

  const summary = useMemo(() => {
    if (!interns) return null;
    const active    = interns.filter(i => i.status === "ACTIVE");
    const completed = interns.filter(i => i.status === "COMPLETED");
    const totalHrs  = interns.reduce((s, i) => s + i.totalHours, 0);
    const allTasks  = interns.flatMap(i => i.tasks);
    const doneTasks = allTasks.filter(t => t.status === "COMPLETED");
    const allAtt    = interns.flatMap(i => i.attendance);
    const presentDays = allAtt.filter(a => a.status === "PRESENT" || a.status === "HALF_DAY").length;
    const attRate = allAtt.length > 0 ? Math.round((presentDays / allAtt.length) * 100) : 0;
    return { total: interns.length, active: active.length, completed: completed.length, totalHrs, doneTasks: doneTasks.length, allTasks: allTasks.length, attRate };
  }, [interns]);

  const internRows = useMemo(() => {
    if (!interns) return [];
    return interns.map(i => {
      const pct      = i.requiredHours > 0 ? Math.min(100, Math.round((i.totalHours / i.requiredHours) * 100)) : 0;
      const tasks    = i.tasks.length;
      const done     = i.tasks.filter(t => t.status === "COMPLETED").length;
      const attDays  = i.attendance.filter(a => a.status === "PRESENT" || a.status === "HALF_DAY").length;
      const totalAtt = i.attendance.length;
      const attRate  = totalAtt > 0 ? Math.round((attDays / totalAtt) * 100) : 0;
      const barC     = pct >= 100 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
      return { ...i, pct, tasks, done, attDays, attRate, barC };
    }).sort((a, b) => b.pct - a.pct);
  }, [interns]);

  const topPerformers = useMemo(
    () => internRows.filter(i => i.status === "ACTIVE").slice(0, 3),
    [internRows]
  );

  // Dept breakdown
  const deptBreakdown = useMemo(() => {
    if (!interns) return [];
    const map: Record<string, { count: number; hours: number }> = {};
    interns.forEach(i => {
      const key = i.department ?? "Unassigned";
      if (!map[key]) map[key] = { count: 0, hours: 0 };
      map[key].count++;
      map[key].hours += i.totalHours;
    });
    return Object.entries(map).map(([dept, v]) => ({ dept, ...v })).sort((a, b) => b.count - a.count);
  }, [interns]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Internship program performance overview</p>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { icon: Users,         color: "#6366f1", bg: "#eef2ff", label: "Total Interns",     val: summary?.total ?? 0,      sub: `${summary?.active ?? 0} active` },
          { icon: Clock,         color: "#0ea5e9", bg: "#f0f9ff", label: "Hours Logged",       val: summary ? `${Math.floor(summary.totalHrs)}h` : "—", sub: "total across all interns" },
          { icon: CheckSquare,   color: "#10b981", bg: "#f0fdf4", label: "Tasks Completed",   val: `${summary?.doneTasks ?? 0}/${summary?.allTasks ?? 0}`, sub: "completion rate" },
          { icon: CalendarCheck, color: "#f59e0b", bg: "#fffbeb", label: "Attendance Rate",   val: `${summary?.attRate ?? 0}%`,sub: "present / total days" },
        ] as const).map(({ icon: Icon, color, bg, label, val, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              {loading ? <Skeleton className="h-6 w-12 mb-1" /> : <p className="text-xl font-bold text-gray-900 leading-tight">{val}</p>}
              <p className="text-xs font-semibold text-gray-700">{label}</p>
              <p className="text-[11px] text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Top performers + Dept breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top performers */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-800">Top Performers</h3>
          </div>
          {loading ? (
            <div className="p-3 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : topPerformers.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No active interns</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {topPerformers.map((i, idx) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="text-lg font-black text-gray-200 tabular-nums w-6 shrink-0">{idx + 1}</div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: avatarColor(i.fullName) }}>{initials(i.fullName)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{i.fullName}</p>
                    <ProgressBar pct={i.pct} color={i.barC} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Department breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-gray-800">Department Breakdown</h3>
          </div>
          {loading ? (
            <div className="p-3 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : deptBreakdown.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No data</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {deptBreakdown.map(d => {
                const maxCount = deptBreakdown[0]?.count ?? 1;
                const pct = Math.round((d.count / maxCount) * 100);
                return (
                  <div key={d.dept} className="flex items-center gap-4 px-4 py-2.5">
                    <p className="text-xs font-medium text-gray-700 w-36 shrink-0 truncate">{d.dept}</p>
                    <div className="flex-1"><ProgressBar pct={pct} color="#3b82f6" /></div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-gray-800 tabular-nums">{d.count} intern{d.count !== 1 ? "s" : ""}</p>
                      <p className="text-[10px] text-gray-400 tabular-nums">{Math.floor(d.hours)}h total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full intern progress table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <h3 className="text-sm font-bold text-gray-800">Individual Progress</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : internRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No interns registered</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold">
                <th className="px-4 py-2.5 text-left">#</th>
                <th className="px-4 py-2.5 text-left">Intern</th>
                <th className="px-4 py-2.5 text-left hidden md:table-cell">School</th>
                <th className="px-4 py-2.5 text-left">Hours Progress</th>
                <th className="px-4 py-2.5 text-center hidden sm:table-cell">Tasks</th>
                <th className="px-4 py-2.5 text-center hidden sm:table-cell">Att. Rate</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {internRows.map((i, idx) => {
                const cfg = STATUS_CFG[i.status] ?? STATUS_CFG.INACTIVE;
                return (
                  <tr key={i.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-400 tabular-nums font-medium">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: avatarColor(i.fullName) }}>{initials(i.fullName)}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{i.fullName}</p>
                          <p className="text-[11px] text-gray-400 truncate">{i.course ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell truncate max-w-[140px]">{i.school}</td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <ProgressBar pct={i.pct} color={i.barC} />
                      <p className="text-[10px] text-gray-400 mt-0.5">{Math.floor(i.totalHours)}h / {i.requiredHours}h</p>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="font-bold text-gray-800">{i.done}</span>
                      <span className="text-gray-400">/{i.tasks}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={cn("font-bold tabular-nums", i.attRate >= 80 ? "text-green-600" : i.attRate >= 50 ? "text-amber-600" : "text-red-500")}>{i.attRate}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.badge)}>{cfg.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
