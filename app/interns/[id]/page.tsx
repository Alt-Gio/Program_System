"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Mail, Phone, Calendar, Clock,
  CheckCircle2, Flame, BookOpen, Target, ListTodo, TrendingUp,
  FileText, Award, AlertCircle, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

/* ─── helpers ──────────────────────────────────────── */
const MOOD_LABEL: Record<string, { emoji: string; label: string; color: string }> = {
  GREAT: { emoji: "🌟", label: "Great",  color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  GOOD:  { emoji: "😊", label: "Good",   color: "text-green-600  bg-green-50  border-green-200"  },
  OKAY:  { emoji: "😐", label: "Okay",   color: "text-blue-600   bg-blue-50   border-blue-200"   },
  ROUGH: { emoji: "😔", label: "Rough",  color: "text-red-600    bg-red-50    border-red-200"    },
};

const ATT_COLOR: Record<string, string> = {
  PRESENT:  "bg-green-100 text-green-700 border-green-200",
  ABSENT:   "bg-red-100   text-red-700   border-red-200",
  HALF_DAY: "bg-amber-100 text-amber-700 border-amber-200",
  LEAVE:    "bg-purple-100 text-purple-700 border-purple-200",
  HOLIDAY:  "bg-sky-100   text-sky-700   border-sky-200",
};

const TASK_COLOR: Record<string, string> = {
  COMPLETED:   "bg-green-100 text-green-700 border-green-200",
  IN_PROGRESS: "bg-blue-100  text-blue-700  border-blue-200",
  PENDING:     "bg-gray-100  text-gray-600  border-gray-200",
  CANCELLED:   "bg-red-100   text-red-700   border-red-200",
};

const PRI_COLOR: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 border-red-200",
  HIGH:   "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW:    "bg-gray-100 text-gray-600 border-gray-200",
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", cls)}>{label}</span>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["from-blue-500 to-indigo-600", "from-purple-500 to-pink-600", "from-green-500 to-teal-600", "from-amber-500 to-orange-600"];
  return (
    <div className={cn("bg-gradient-to-br w-20 h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shrink-0", colors[name.charCodeAt(0) % colors.length])}>
      {initials}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 40, stroke = 8, circ = 2 * Math.PI * r;
  const color = pct >= 100 ? "#22c55e" : pct >= 60 ? "#818cf8" : "#f59e0b";
  return (
    <svg width="100" height="100" className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - (Math.min(pct, 100) / 100) * circ}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

const TABS = ["overview", "attendance", "tasks", "habits", "journal", "goals", "documents"] as const;
type Tab = typeof TABS[number];

/* ─── page ──────────────────────────────────────────── */
export default function InternDetailPage() {
  const { id } = useParams<{ id: string }>();
  const internId = id as Id<"interns">;

  const [tab, setTab] = useState<Tab>("overview");

  const intern   = useQuery(api.interns.getById, { internId });
  const habits   = useQuery(api.internPortal.getInternHabitsForSupervisor, { internId });
  const journal  = useQuery(api.internPortal.getInternJournalForSupervisor, { internId });
  const goals    = useQuery(api.internPortal.getInternGoalsForSupervisor, { internId });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => {
    if (!intern) return null;
    const pct      = intern.requiredHours > 0 ? Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100)) : 0;
    const done     = intern.tasks.filter(t => t.status === "COMPLETED").length;
    const active   = intern.tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
    const days     = intern.attendance.filter(a => a.status === "PRESENT" || a.status === "HALF_DAY").length;
    const daysLeft = Math.max(0, Math.round((new Date(intern.endDate).getTime() - Date.now()) / 86400000));
    const totalH   = intern.attendance.reduce((s, a) => s + (a.hours ?? 0), 0);
    return { pct, done, active, days, daysLeft, totalH };
  }, [intern]);

  /* ── export helpers ── */
  function fmtTime(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function exportDTR() {
    if (!intern) return;
    const header = "Daily Time Record (DTR)\n" +
      `Intern: ${intern.fullName}\nSchool: ${intern.school}\nDepartment: ${intern.department ?? "—"}\n` +
      `Supervisor: ${intern.supervisor ?? "—"}\nPeriod: ${intern.startDate} to ${intern.endDate}\n\n`;
    const csvRows = [
      ["Date", "Day", "Time In", "Time Out", "Hours", "Status", "Notes"],
      ...intern.attendance.sort((a, b) => a.date.localeCompare(b.date)).map(a => [
        a.date,
        new Date(a.date).toLocaleDateString("en-PH", { weekday: "short" }),
        fmtTime(a.timeIn), fmtTime(a.timeOut),
        a.hours != null ? `${a.hours}h` : "—",
        a.status,
        a.notes ?? "",
      ])
    ].map(r => r.join(",")).join("\n");
    const total = `\n\nTotal Hours Logged: ${Math.floor(stats?.totalH ?? 0)}\nRequired Hours: ${intern.requiredHours}\nProgress: ${stats?.pct ?? 0}%`;
    const blob = new Blob([header + csvRows + total], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `DTR_${intern.fullName.replace(/\s+/g, "_")}_${today}.csv`;
    a.click();
  }

  function exportJournal() {
    if (!journal || !intern) return;
    const lines = journal.map(log => [
      `${"═".repeat(58)}`,
      `📅  ${log.date}   ${MOOD_LABEL[log.mood]?.emoji ?? ""} Mood: ${log.mood}`,
      `${"═".repeat(58)}`,
      `📝 Accomplishments:\n${log.accomplishments ?? "—"}`,
      `\n💡 Learnings:\n${log.learnings ?? "—"}`,
      `\n⚠️  Challenges:\n${log.challenges ?? "—"}`,
      `\n📌 Tomorrow's Plan:\n${log.tomorrowPlan ?? "—"}`,
      "",
    ].join("\n")).join("\n\n");
    const header = `DAILY JOURNAL EXPORT\nIntern: ${intern.fullName}\nSchool: ${intern.school}\nExported: ${today}\n\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([header + lines], { type: "text/plain" }));
    a.download = `Journal_${intern.fullName.replace(/\s+/g, "_")}_${today}.txt`;
    a.click();
  }

  function exportTasks() {
    if (!intern) return;
    const rows = [
      ["Title", "Description", "Status", "Priority", "Due Date", "Completed At", "Created"],
      ...intern.tasks.map(t => [
        `"${t.title}"`, `"${t.description ?? ""}"`, t.status, t.priority,
        t.dueDate ?? "—", t.completedAt ?? "—", t.createdAt.slice(0, 10),
      ])
    ].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = `Tasks_${intern.fullName.replace(/\s+/g, "_")}_${today}.csv`;
    a.click();
  }

  /* ── loading / error ── */
  if (intern === undefined) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="w-9 h-9 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
  if (!intern) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
      <AlertCircle className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500 font-medium">Intern not found</p>
      <Link href="/intern-portal/list" className="text-blue-600 hover:text-blue-700 text-sm font-semibold">← Back to list</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <Link href="/intern-portal/list" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to Interns
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Identity */}
            <div className="flex items-start gap-4">
              <Avatar name={intern.fullName} />
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900">{intern.fullName}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{intern.school} · {intern.course}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {intern.email && (
                    <a href={`mailto:${intern.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      <Mail className="w-3 h-3" />{intern.email}
                    </a>
                  )}
                  {intern.phone && (
                    <a href={`tel:${intern.phone}`} className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium">
                      <Phone className="w-3 h-3" />{intern.phone}
                    </a>
                  )}
                  <Badge
                    label={intern.status}
                    cls={intern.status === "ACTIVE" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}
                  />
                </div>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={exportDTR}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors">
                <Download className="w-3.5 h-3.5" />DTR
              </button>
              <button onClick={exportJournal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors">
                <Download className="w-3.5 h-3.5" />Journal
              </button>
              <button onClick={exportTasks}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-colors">
                <Download className="w-3.5 h-3.5" />Tasks
              </button>
              <Link href={`/intern-portal/list`}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />Full Portal
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ── KPI Row ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Progress ring */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <ProgressRing pct={stats?.pct ?? 0} />
              <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
                <span className="text-xl font-extrabold text-gray-900">{stats?.pct ?? 0}%</span>
                <span className="text-[10px] text-gray-400 -mt-0.5">complete</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{Math.floor(intern.totalHours)}h</p>
              <p className="text-sm text-gray-500">of {intern.requiredHours}h required</p>
              <div className="w-full h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                <div style={{ width: `${stats?.pct ?? 0}%` }}
                  className={cn("h-full rounded-full", stats?.pct === 100 ? "bg-green-500" : "bg-indigo-500")} />
              </div>
            </div>
          </div>

          {[
            { icon: Calendar,   val: stats?.days     ?? 0, label: "Days Present",  sub: "attendance days",     color: "text-green-600"  },
            { icon: ListTodo,   val: stats?.done     ?? 0, label: "Tasks Done",    sub: `${stats?.active??0} active`,    color: "text-blue-600"   },
            { icon: Clock,      val: stats?.daysLeft ?? 0, label: "Days Left",     sub: `Until ${intern.endDate}`,color: "text-amber-600"  },
            { icon: Flame,      val: habits?.completedToday ?? 0, label: "Habits Today", sub: `of ${habits?.totalToday ?? 0} habits`, color: "text-orange-600" },
            { icon: BookOpen,   val: journal?.length ?? 0, label: "Journal Entries", sub: "total reflections", color: "text-indigo-600" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
              <p className={cn("text-2xl font-extrabold leading-none mb-1", s.color)}>{s.val}</p>
              <p className="text-xs font-semibold text-gray-700">{s.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-gray-100 bg-gray-50/80 flex overflow-x-auto gap-1 p-2">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-xl whitespace-nowrap transition-all capitalize",
                  tab === t
                    ? "bg-white text-blue-700 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-800 hover:bg-white/60"
                )}>{t}</button>
            ))}
          </div>

          <div className="p-5 md:p-6">

            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Intern Profile</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      ["Full Name",        intern.fullName],
                      ["School",           intern.school],
                      ["Course",           intern.course ?? "—"],
                      ["Department",       intern.department ?? "—"],
                      ["Supervisor",       intern.supervisor ?? "—"],
                      ["Start Date",       intern.startDate],
                      ["End Date",         intern.endDate],
                      ["Required Hours",   `${intern.requiredHours}h`],
                      ["Logged Hours",     `${Math.floor(intern.totalHours)}h`],
                      ["Email",            intern.email ?? "—"],
                      ["Phone",            intern.phone ?? "—"],
                      ["Status",           intern.status],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">{k}</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{v}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {intern.notes && (
                  <section>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Notes</h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-gray-700">{intern.notes}</div>
                  </section>
                )}

                <section>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Today's Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Check-in */}
                    {(() => {
                      const att = intern.attendance.find(a => a.date === today);
                      return (
                        <div className={cn("rounded-xl border p-4", att?.timeIn ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200")}>
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className={cn("w-4 h-4", att?.timeIn ? "text-green-600" : "text-gray-400")} />
                            <span className="text-xs font-bold text-gray-600">Attendance</span>
                          </div>
                          {att?.timeIn ? (
                            <div>
                              <p className="text-sm font-bold text-green-700">Checked In ✓</p>
                              <p className="text-xs text-gray-500">In: {fmtTime(att.timeIn)}{att.timeOut ? ` · Out: ${fmtTime(att.timeOut)}` : " · Still in"}</p>
                              {att.hours != null && <p className="text-xs text-gray-500">{att.hours}h logged</p>}
                            </div>
                          ) : <p className="text-sm text-gray-500">Not checked in today</p>}
                        </div>
                      );
                    })()}
                    {/* Habits */}
                    <div className={cn("rounded-xl border p-4", habits?.completedToday === habits?.totalToday && (habits?.totalToday ?? 0) > 0 ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200")}>
                      <div className="flex items-center gap-2 mb-1">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold text-gray-600">Habits</span>
                      </div>
                      <p className="text-sm font-bold text-gray-800">{habits?.completedToday ?? 0} / {habits?.totalToday ?? 0} complete</p>
                      <div className="flex gap-1 mt-1.5">
                        {Array.from({ length: habits?.totalToday ?? 0 }).map((_, i) => (
                          <div key={i} className={cn("h-1.5 flex-1 rounded-full max-w-[12px]", i < (habits?.completedToday ?? 0) ? "bg-orange-400" : "bg-gray-200")} />
                        ))}
                      </div>
                    </div>
                    {/* Journal */}
                    {(() => {
                      const todayLog = journal?.find(l => l.date === today);
                      return (
                        <div className={cn("rounded-xl border p-4", todayLog ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-200")}>
                          <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-bold text-gray-600">Journal</span>
                          </div>
                          {todayLog ? (
                            <div>
                              <p className="text-sm font-bold text-indigo-700">Logged today {MOOD_LABEL[todayLog.mood]?.emoji}</p>
                              <p className="text-xs text-gray-500 line-clamp-2">{todayLog.accomplishments}</p>
                            </div>
                          ) : <p className="text-sm text-gray-500">No journal entry yet today</p>}
                        </div>
                      );
                    })()}
                  </div>
                </section>

                {/* Recent attendance */}
                <section>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Attendance</h3>
                  <div className="space-y-1.5">
                    {intern.attendance.slice(0, 7).map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full shrink-0", att.status === "PRESENT" ? "bg-green-500" : att.status === "ABSENT" ? "bg-red-500" : "bg-amber-500")} />
                          <span className="text-sm font-medium text-gray-700">{att.date}</span>
                          <Badge label={att.status} cls={ATT_COLOR[att.status] ?? "bg-gray-100 text-gray-600 border-gray-200"} />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{fmtTime(att.timeIn)} – {fmtTime(att.timeOut)}</span>
                          {att.hours != null && <span className="font-semibold text-gray-600">{att.hours}h</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ── ATTENDANCE ── */}
            {tab === "attendance" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">Full DTR — {intern.attendance.length} Records</h3>
                  <button onClick={exportDTR} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg">
                    <Download className="w-3 h-3" />Export DTR
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Total Days",    val: intern.attendance.length },
                    { label: "Days Present",  val: intern.attendance.filter(a => a.status === "PRESENT").length },
                    { label: "Hours Logged",  val: `${Math.floor(stats?.totalH ?? 0)}h` },
                  ].map(s => (
                    <div key={s.label} className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                      <p className="text-xl font-extrabold text-blue-700">{s.val}</p>
                      <p className="text-xs text-blue-600 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {[...intern.attendance].sort((a, b) => b.date.localeCompare(a.date)).map(att => (
                    <div key={att.id} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", att.status === "PRESENT" ? "bg-green-500" : att.status === "ABSENT" ? "bg-red-500" : "bg-amber-500")} />
                          <span className="font-semibold text-gray-900">{att.date}</span>
                          <span className="text-xs text-gray-400">{new Date(att.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short" })}</span>
                          <Badge label={att.status} cls={ATT_COLOR[att.status] ?? "bg-gray-100 text-gray-600 border-gray-200"} />
                        </div>
                        <div className="flex items-center gap-5 text-sm">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400">Time In</p>
                            <p className="font-semibold text-gray-800">{fmtTime(att.timeIn)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400">Time Out</p>
                            <p className="font-semibold text-gray-800">{fmtTime(att.timeOut)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400">Hours</p>
                            <p className="font-bold text-gray-900">{att.hours != null ? `${att.hours}h` : "—"}</p>
                          </div>
                        </div>
                      </div>
                      {att.notes && <p className="text-xs text-gray-500 mt-2 ml-5">📝 {att.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TASKS ── */}
            {tab === "tasks" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">Tasks — {intern.tasks.length} total</h3>
                  <button onClick={exportTasks} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg">
                    <Download className="w-3 h-3" />Export
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  {(["COMPLETED", "IN_PROGRESS", "PENDING", "CANCELLED"] as const).map(s => (
                    <div key={s} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                      <p className="text-xl font-extrabold text-gray-800">{intern.tasks.filter(t => t.status === s).length}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{s.replace("_", " ")}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {intern.tasks.map(task => (
                    <div key={task.id} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                        <p className="font-semibold text-gray-900">{task.title}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge label={task.priority} cls={PRI_COLOR[task.priority] ?? "bg-gray-100 text-gray-600 border-gray-200"} />
                          <Badge label={task.status.replace("_", " ")} cls={TASK_COLOR[task.status] ?? "bg-gray-100 text-gray-600 border-gray-200"} />
                        </div>
                      </div>
                      {task.description && <p className="text-sm text-gray-500 mb-1.5">{task.description}</p>}
                      <div className="flex items-center gap-4 text-[11px] text-gray-400">
                        {task.dueDate && <span>Due: <strong className="text-gray-600">{task.dueDate}</strong></span>}
                        {task.completedAt && <span>✓ Completed: {task.completedAt.slice(0, 10)}</span>}
                        <span>Added: {task.createdAt.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── HABITS ── */}
            {tab === "habits" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">Daily Habits</h3>
                  <span className="text-sm text-gray-500">{habits?.completedToday ?? 0}/{habits?.totalToday ?? 0} done today</span>
                </div>

                {!habits ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Loading habits...</p>
                ) : habits.habits.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No habits set up yet</p>
                ) : (
                  <div className="space-y-3">
                    {habits.habits.map(habit => (
                      <div key={habit.habitId} className={cn(
                        "rounded-xl border p-4 transition-all",
                        habit.completed ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-100"
                      )}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{habit.emoji}</span>
                            <div>
                              <p className="font-semibold text-gray-900">{habit.title}</p>
                              <p className="text-xs text-gray-400">{habit.frequency}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {habit.streak > 0 && (
                              <div className="flex items-center gap-1 bg-orange-100 border border-orange-200 rounded-full px-2.5 py-1">
                                <Flame className="w-3 h-3 text-orange-500" />
                                <span className="text-xs font-bold text-orange-700">{habit.streak} day streak</span>
                              </div>
                            )}
                            {habit.completed
                              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                              : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                            }
                          </div>
                        </div>
                        {/* 7-day mini calendar */}
                        <div className="flex items-center gap-1.5">
                          {habit.last7Days.map((d, i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold", d.completed ? "bg-orange-400 text-white" : "bg-gray-200 text-gray-400")}>
                                {d.completed ? "✓" : "·"}
                              </div>
                              <span className="text-[9px] text-gray-400">{d.date.slice(5)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── JOURNAL ── */}
            {tab === "journal" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">Daily Journal — {journal?.length ?? 0} entries</h3>
                  <button onClick={exportJournal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg">
                    <Download className="w-3 h-3" />Export Journal
                  </button>
                </div>

                {!journal ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Loading journal...</p>
                ) : journal.length === 0 ? (
                  <div className="py-12 text-center">
                    <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No journal entries yet</p>
                  </div>
                ) : (
                  journal.map(log => {
                    const mood = MOOD_LABEL[log.mood] ?? { emoji: "😐", label: log.mood, color: "text-gray-600 bg-gray-50 border-gray-200" };
                    return (
                      <div key={log._id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-800">{log.date}</span>
                            <span className="text-gray-400 text-xs">{new Date(log.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long" })}</span>
                          </div>
                          <span className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border", mood.color)}>
                            {mood.emoji} {mood.label}
                          </span>
                        </div>
                        <div className="p-5 grid md:grid-cols-2 gap-4 text-sm">
                          {[
                            { icon: "📝", label: "Accomplishments",   val: log.accomplishments },
                            { icon: "💡", label: "Learnings",          val: log.learnings       },
                            { icon: "⚠️",  label: "Challenges",         val: log.challenges      },
                            { icon: "📌", label: "Tomorrow's Plan",    val: log.tomorrowPlan    },
                          ].map(s => (
                            <div key={s.label}>
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.icon} {s.label}</p>
                              <p className="text-gray-700 leading-relaxed">{s.val || <span className="text-gray-300 italic">not filled</span>}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── GOALS ── */}
            {tab === "goals" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">Goals</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="text-green-600 font-semibold">{goals?.filter(g => g.isCompleted).length ?? 0} achieved</span>
                    <span>/ {goals?.length ?? 0} total</span>
                  </div>
                </div>

                {!goals ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Loading goals...</p>
                ) : goals.length === 0 ? (
                  <div className="py-12 text-center">
                    <Target className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No goals set yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {goals.map(goal => (
                      <div key={goal._id} className={cn(
                        "rounded-xl border px-4 py-3.5",
                        goal.isCompleted ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"
                      )}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {goal.isCompleted
                              ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                              : <div className="w-5 h-5 rounded-full border-2 border-gray-300 mt-0.5 shrink-0" />
                            }
                            <div>
                              <p className={cn("font-semibold", goal.isCompleted ? "text-green-800 line-through" : "text-gray-900")}>{goal.title}</p>
                              {goal.description && <p className="text-sm text-gray-500 mt-0.5">{goal.description}</p>}
                              <div className="flex gap-3 text-[11px] text-gray-400 mt-1">
                                {goal.targetDate && <span>🎯 Target: {goal.targetDate}</span>}
                                {goal.completedAt && <span>✅ Achieved: {new Date(goal.completedAt).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          </div>
                          {goal.isCompleted && <Award className="w-5 h-5 text-yellow-500 shrink-0" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── DOCUMENTS ── */}
            {tab === "documents" && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-gray-900">Documents — {intern.documents.length} files</h3>

                {intern.documents.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {intern.documents.map(doc => (
                      <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3 hover:border-blue-300 hover:shadow-sm transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400">{doc.type} · {doc.createdAt.slice(0, 10)}</p>
                            {doc.tags.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {doc.tags.map(tag => (
                                  <span key={tag} className="text-[10px] bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0">
                          <Download className="w-3 h-3" />Open
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
