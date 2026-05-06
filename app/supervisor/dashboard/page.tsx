"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, TrendingUp, Clock, CheckCircle2, AlertCircle,
  Download, Flame, BookOpen, Search, Award,
  ArrowRight, LogOut, GraduationCap, BarChart3,
  Plus, X, Send, MessageSquare, FolderOpen,
  ListTodo, ChevronDown, ChevronUp, Trash2, Edit3,
  Crown, UserPlus, UserMinus, Calendar, MapPin, Shield,
  Navigation, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { useQueryWithSnapshot } from "@/lib/useQueryWithSnapshot";

// ─── colours & helpers ────────────────────────────────────────
const PRI_COLOR: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 border-red-200",
  HIGH:   "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW:    "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  PAUSED:    "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function Avatar({ name, size = "md" }: { name: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const i = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const c = ["from-blue-500 to-indigo-600","from-purple-500 to-pink-600","from-green-500 to-teal-600","from-amber-500 to-orange-600","from-rose-500 to-red-600"];
  const sz = size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-8 h-8 text-xs" : size === "xs" ? "w-6 h-6 text-[10px]" : "w-10 h-10 text-sm";
  return (
    <div className={cn(`bg-gradient-to-br ${c[name.charCodeAt(0)%c.length]} rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow`, sz)}>
      {i}
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 20, circ = 2 * Math.PI * r;
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="52" height="52" className="-rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ - (Math.min(pct,100)/100)*circ} strokeLinecap="round" />
    </svg>
  );
}

// ─── sub-panels ───────────────────────────────────────────────
type OverviewIntern = {
  id: string; fullName: string; school: string; department: string | null;
  supervisor: string | null; status: string; totalHours: number; requiredHours: number;
  progressPct: number; todayCheckedIn: boolean; todayCheckedOut: boolean;
  habitsToday: { completed: number; total: number }; weeklyHabitDays: number;
  lastJournalDate: string | null; tasksCompleted: number; tasksActive: number;
  engagementScore: number;
};

// ═══════════ ASSIGN TASK MODAL ═══════════════════════════════
function AssignTaskModal({ token, intern, onClose }: {
  token: string; intern: OverviewIntern; onClose: () => void;
}) {
  const assignTask = useMutation(api.supervisorTools.assignTask);
  const [title, setTitle]       = useState("");
  const [desc, setDesc]         = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await assignTask({
        token, internId: intern.id as Id<"interns">,
        title: title.trim(), description: desc.trim() || undefined,
        priority, dueDate: dueDate || undefined,
      });
      setDone(true);
      setTimeout(onClose, 800);
    } catch { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <ListTodo className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-bold text-gray-900">Assign Task</p>
              <p className="text-xs text-gray-400">to {intern.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {done && <p className="text-center text-green-600 font-semibold py-2">✓ Task assigned!</p>}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Task Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Prepare weekly report"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Additional details..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 bg-white">
                {["LOW","MEDIUM","HIGH","URGENT"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
            </div>
          </div>
          <button type="submit" disabled={loading || done}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60">
            {loading ? "Assigning…" : "Assign Task"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════ CHAT DRAWER ═════════════════════════════════════
function ChatDrawer({ token, intern, onClose }: {
  token: string; intern: OverviewIntern; onClose: () => void;
}) {
  const messages     = useQuery(api.supervisorTools.getMessages, { token, internId: intern.id as Id<"interns"> });
  const sendMessage  = useMutation(api.supervisorTools.sendMessage);
  const markRead     = useMutation(api.supervisorTools.markMessagesRead);
  const [text, setText]     = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    markRead({ token, internId: intern.id as Id<"interns"> }).catch(() => {});
  }, [intern.id, token, markRead]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ token, internId: intern.id as Id<"interns">, message: text.trim() });
      setText("");
    } finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-end p-0 md:p-4">
      <div className="bg-white w-full md:w-[400px] md:rounded-2xl shadow-2xl flex flex-col h-[85vh] md:h-[600px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 md:rounded-t-2xl">
          <Avatar name={intern.fullName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{intern.fullName}</p>
            <p className="text-xs text-white/60 truncate">{intern.school}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {!messages ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <MessageSquare className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">No messages yet.<br />Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isSupervisor = msg.senderType === "supervisor";
              return (
                <div key={msg._id} className={cn("flex gap-2", isSupervisor ? "flex-row-reverse" : "flex-row")}>
                  {!isSupervisor && <Avatar name={intern.fullName} size="xs" />}
                  <div className={cn(
                    "max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm",
                    isSupervisor
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                  )}>
                    <p className="leading-relaxed">{msg.message}</p>
                    <p className={cn("text-[10px] mt-1", isSupervisor ? "text-blue-200 text-right" : "text-gray-400")}>
                      {new Date(msg.createdAt).toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={send} className="flex items-center gap-2 px-3 py-3 border-t border-gray-100 bg-white md:rounded-b-2xl">
          <input
            value={text} onChange={e => setText(e.target.value)}
            placeholder={`Message ${intern.fullName.split(" ")[0]}…`}
            className="flex-1 px-4 py-2.5 text-sm bg-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 border border-transparent focus:border-blue-300 transition-all"
          />
          <button type="submit" disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════ CREATE PROJECT MODAL ═══════════════════════════
function CreateProjectModal({ token, allInterns, onClose }: {
  token: string; allInterns: OverviewIntern[]; onClose: () => void;
}) {
  const createProject = useMutation(api.supervisorTools.createProject);
  const [title, setTitle]         = useState("");
  const [desc, setDesc]           = useState("");
  const [priority, setPriority]   = useState("MEDIUM");
  const [dueDate, setDueDate]     = useState("");
  const [tags, setTags]           = useState("");
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [leadId, setLeadId]       = useState<string>("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  function toggleIntern(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (leadId === id) setLeadId(""); }
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || selected.size === 0) return;
    setLoading(true);
    try {
      await createProject({
        token, title: title.trim(), description: desc.trim() || undefined,
        priority, dueDate: dueDate || undefined,
        memberInternIds: Array.from(selected) as Id<"interns">[],
        leadInternId: leadId ? leadId as Id<"interns"> : undefined,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
      });
      setDone(true);
      setTimeout(onClose, 900);
    } catch { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-purple-600" />
            <p className="font-bold text-gray-900">Create Group Project</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {done && <p className="text-center text-green-600 font-semibold py-1">✓ Project created!</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Project Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Q2 Data Digitization"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Project goals and details..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-400/30 bg-white">
                {["LOW","MEDIUM","HIGH","URGENT"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-400/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. data entry, reporting"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-400/30" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Select Interns * <span className="text-purple-600">({selected.size} selected)</span>
            </label>
            <div className="border border-gray-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-gray-50">
              {allInterns.map(intern => (
                <div key={intern.id}
                  className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-purple-50 transition-colors", selected.has(intern.id) ? "bg-purple-50/60" : "")}
                  onClick={() => toggleIntern(intern.id)}>
                  <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                    selected.has(intern.id) ? "bg-purple-600 border-purple-600" : "border-gray-300")}>
                    {selected.has(intern.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <Avatar name={intern.fullName} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{intern.fullName}</p>
                    <p className="text-xs text-gray-400 truncate">{intern.school}</p>
                  </div>
                  {selected.has(intern.id) && (
                    <button type="button"
                      onClick={e => { e.stopPropagation(); setLeadId(leadId === intern.id ? "" : intern.id); }}
                      className={cn("shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                        leadId === intern.id ? "bg-yellow-400 border-yellow-500 text-yellow-900" : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-yellow-50")}>
                      <Crown className="w-2.5 h-2.5" />
                      {leadId === intern.id ? "Lead" : "Set Lead"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || done || selected.size === 0 || !title.trim()}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
            {loading ? "Creating…" : `Create Project with ${selected.size} intern${selected.size !== 1 ? "s" : ""}`}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════ PROJECT CARD ═════════════════════════════════════
function ProjectCard({ project, token, onStatusChange, onDelete }: {
  project: any; token: string; onStatusChange: (id: string, status: string) => void; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn("bg-white border rounded-2xl shadow-sm overflow-hidden transition-all", project.status === "COMPLETED" ? "border-green-200" : "border-gray-200")}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(x => !x)}>
        <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", project.status === "ACTIVE" ? "bg-green-500" : project.status === "COMPLETED" ? "bg-blue-500" : "bg-amber-500")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-gray-900">{project.title}</p>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STATUS_COLOR[project.status] ?? "bg-gray-100 text-gray-600")}>{project.status}</span>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", PRI_COLOR[project.priority] ?? "bg-gray-100 text-gray-600 border-gray-200")}>{project.priority}</span>
          </div>
          {project.description && <p className="text-xs text-gray-500 line-clamp-1">{project.description}</p>}
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex -space-x-1.5">
              {project.members.slice(0, 5).map((m: any) => m && (
                <div key={m.internId} title={`${m.fullName}${m.role === "LEAD" ? " (Lead)" : ""}`}>
                  <Avatar name={m.fullName} size="xs" />
                </div>
              ))}
              {project.members.length > 5 && <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-500">+{project.members.length-5}</div>}
            </div>
            <span className="text-[11px] text-gray-400">{project.members.length} member{project.members.length !== 1 ? "s" : ""}</span>
            {project.dueDate && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{project.dueDate}</span>}
          </div>
          {project.tags?.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {project.tags.map((t: string) => <span key={t} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5">{t}</span>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Team Members</p>
          <div className="space-y-1.5 mb-3">
            {project.members.map((m: any) => m && (
              <div key={m.internId} className="flex items-center gap-2">
                <Avatar name={m.fullName} size="xs" />
                <Link href={`/interns/${m.internId}`} className="text-sm font-medium text-blue-700 hover:underline flex-1">{m.fullName}</Link>
                {m.role === "LEAD" && <div className="flex items-center gap-0.5 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full"><Crown className="w-2.5 h-2.5" />Lead</div>}
                <span className="text-xs text-gray-400">{m.school}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={project.status}
              onChange={e => onStatusChange(project.id, e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none">
              {["ACTIVE","PAUSED","COMPLETED","CANCELLED"].map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => onDelete(project.id)}
              className="flex items-center gap-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors">
              <Trash2 className="w-3 h-3" />Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════ MAIN PAGE ═══════════════════════════════════════
type View = "interns" | "projects" | "settings";

export default function SupervisorDashboardPage() {
  const router = useRouter();
  const [token, setToken]         = useState<string | null>(null);
  const [view, setView]           = useState<View>("interns");
  const [search, setSearch]       = useState("");
  const [sortBy, setSortBy]       = useState<"engagement"|"progress"|"name">("engagement");
  const [filterBy, setFilterBy]   = useState<"all"|"present"|"attention">("all");

  // modals/drawers
  const [assignTarget, setAssignTarget] = useState<OverviewIntern | null>(null);
  const [chatTarget, setChatTarget]     = useState<OverviewIntern | null>(null);
  const [showCreateProj, setShowCreateProj] = useState(false);
  const [showAddFence, setShowAddFence]     = useState(false);
  const [fenceName, setFenceName]           = useState("");
  const [fenceLat, setFenceLat]             = useState("");
  const [fenceLng, setFenceLng]             = useState("");
  const [fenceRadius, setFenceRadius]       = useState("200");
  const [fenceLoading, setFenceLoading]     = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("supervisor_token");
    if (!t) { router.push("/login"); return; }
    setToken(t);
  }, [router]);

  const snapKey = token ? `supervisor:${token.slice(0, 16)}` : null;
  const supervisor  = useQueryWithSnapshot(api.supervisors.getMyProfile, token ? { token } : "skip", snapKey && `${snapKey}:me`);
  const overview    = useQueryWithSnapshot(api.internPortal.getSupervisorOverview, {}, snapKey && `${snapKey}:overview`);
  const projects    = useQueryWithSnapshot(api.supervisorTools.getProjects, token ? { token } : "skip", snapKey && `${snapKey}:projects`);
  const unreadCounts = useQueryWithSnapshot(api.supervisorTools.getUnreadCounts, token ? { token } : "skip", snapKey && `${snapKey}:unread`);
  const updateProject  = useMutation(api.supervisorTools.updateProject);
  const deleteProject  = useMutation(api.supervisorTools.deleteProject);
  const allFences      = useQueryWithSnapshot(api.supervisorTools.getAllGeoFences, token ? { token } : "skip", snapKey && `${snapKey}:fences`);
  const createFence    = useMutation(api.supervisorTools.createGeoFence);
  const updateFence    = useMutation(api.supervisorTools.updateGeoFence);
  const deleteFence    = useMutation(api.supervisorTools.deleteGeoFence);

  async function handleAddFence(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !fenceName.trim() || !fenceLat || !fenceLng) return;
    setFenceLoading(true);
    try {
      await createFence({
        token, name: fenceName.trim(),
        lat: parseFloat(fenceLat), lng: parseFloat(fenceLng),
        radiusMeters: parseInt(fenceRadius) || 200,
      });
      setFenceName(""); setFenceLat(""); setFenceLng(""); setFenceRadius("200");
      setShowAddFence(false);
    } finally { setFenceLoading(false); }
  }

  function useCurrentLocationForFence() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      setFenceLat(pos.coords.latitude.toFixed(6));
      setFenceLng(pos.coords.longitude.toFixed(6));
    });
  }

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const processed = useMemo(() => {
    if (!overview) return [];
    let list = [...overview] as OverviewIntern[];
    if (search) { const q = search.toLowerCase(); list = list.filter(i => i.fullName.toLowerCase().includes(q)||(i.school??"").toLowerCase().includes(q)); }
    if (filterBy === "present")   list = list.filter(i => i.todayCheckedIn);
    if (filterBy === "attention") list = list.filter(i => i.engagementScore < 50);
    if (sortBy === "engagement")  list.sort((a,b) => b.engagementScore - a.engagementScore);
    if (sortBy === "progress")    list.sort((a,b) => b.progressPct - a.progressPct);
    if (sortBy === "name")        list.sort((a,b) => a.fullName.localeCompare(b.fullName));
    return list;
  }, [overview, search, sortBy, filterBy]);

  const stats = useMemo(() => {
    if (!overview) return null;
    return {
      total:     overview.length,
      present:   overview.filter(i => i.todayCheckedIn).length,
      avgScore:  overview.length > 0 ? Math.round(overview.reduce((s,i)=>s+i.engagementScore,0)/overview.length) : 0,
      needAttn:  overview.filter(i => i.engagementScore < 50).length,
      habitsAll: overview.filter(i => i.habitsToday.total > 0 && i.habitsToday.completed === i.habitsToday.total).length,
      journaled: overview.filter(i => i.lastJournalDate === today).length,
    };
  }, [overview, today]);

  const totalUnread = useMemo(() => {
    if (!unreadCounts) return 0;
    return Object.values(unreadCounts).reduce((s, n) => s + n, 0);
  }, [unreadCounts]);

  function handleLogout() {
    localStorage.removeItem("supervisor_token");
    localStorage.removeItem("supervisor_data");
    router.push("/login");
  }

  function exportCSV() {
    if (!overview) return;
    const rows = [
      ["Name","School","Progress%","Hours","Required","Engagement","Present Today","Habits","Journaled","Active Tasks","Done Tasks"],
      ...overview.map(i => [i.fullName,i.school,i.progressPct,Math.floor(i.totalHours),i.requiredHours,i.engagementScore,
        i.todayCheckedIn?"Yes":"No",`${i.habitsToday.completed}/${i.habitsToday.total}`,
        i.lastJournalDate===today?"Yes":"No",i.tasksActive,i.tasksCompleted])
    ].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows],{type:"text/csv"}));
    a.download = `interns-${today}.csv`; a.click();
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      {/* ── Top Nav ── */}
      <header className="bg-[#0d1b2a] text-white h-14 flex items-center px-5 gap-4 shrink-0 shadow-xl z-30">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-extrabold tracking-widest text-white leading-none">DTC REGION V</p>
            <p className="text-[9px] text-white/30 tracking-widest leading-none">SUPERVISOR PORTAL</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
          <button onClick={() => setView("interns")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view==="interns" ? "bg-white text-gray-900 shadow" : "text-white/60 hover:text-white")}>
            <Users className="w-3.5 h-3.5" />Interns
          </button>
          <button onClick={() => setView("projects")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view==="projects" ? "bg-white text-gray-900 shadow" : "text-white/60 hover:text-white")}>
            <FolderOpen className="w-3.5 h-3.5" />Projects
            {(projects?.length ?? 0) > 0 && <span className="bg-purple-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-extrabold">{projects!.length}</span>}
          </button>
          <button onClick={() => setView("settings")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view==="settings" ? "bg-white text-gray-900 shadow" : "text-white/60 hover:text-white")}>
            <MapPin className="w-3.5 h-3.5" />Zones
            {(allFences?.length ?? 0) > 0 && <span className="bg-green-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-extrabold">{allFences!.length}</span>}
          </button>
        </div>

        {totalUnread > 0 && (
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-white/60" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white">{totalUnread}</div>
          </div>
        )}

        {supervisor && (
          <div className="hidden md:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold">
              {supervisor.fullName.split(" ").map((w:string)=>w[0]).slice(0,2).join("")}
            </div>
            <span className="text-xs text-white/70">{supervisor.fullName}</span>
          </div>
        )}
        <Link href="/intern-portal" className="text-xs text-white/40 hover:text-white transition-colors hidden md:block">Portal</Link>
        <button onClick={handleLogout} className="text-white/40 hover:text-white/80 transition-colors"><LogOut className="w-4 h-4" /></button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                {view === "interns"
                  ? `Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${supervisor?.fullName.split(" ")[0] ?? "Supervisor"} 👋`
                  : view === "projects" ? "Group Projects 📁"
                  : "Check-In Zones 📍"}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
            </div>
            <div className="flex items-center gap-2">
              {view === "interns" ? (
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow transition-colors">
                  <Download className="w-3.5 h-3.5" />Export CSV
                </button>
              ) : view === "projects" ? (
                <button onClick={() => setShowCreateProj(true)} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow transition-colors">
                  <Plus className="w-3.5 h-3.5" />New Project
                </button>
              ) : (
                <button onClick={() => setShowAddFence(true)} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow transition-colors">
                  <Plus className="w-3.5 h-3.5" />Add Zone
                </button>
              )}
            </div>
          </div>

          {/* ── KPI CARDS (always visible) ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label:"Total Interns",   val: stats?.total    ?? "—", icon: Users,        color:"text-blue-600",   bg:"bg-blue-50"   },
              { label:"Present Today",   val: `${stats?.present??0}/${stats?.total??0}`, icon: CheckCircle2, color:"text-green-600", bg:"bg-green-50" },
              { label:"Avg Engagement",  val: `${stats?.avgScore??0}%`, icon: TrendingUp, color:"text-indigo-600",bg:"bg-indigo-50" },
              { label:"Need Attention",  val: stats?.needAttn ?? 0,  icon: AlertCircle,  color:"text-red-600",    bg:"bg-red-50"    },
              { label:"All Habits Done", val: stats?.habitsAll?? 0,  icon: Flame,        color:"text-orange-600", bg:"bg-orange-50" },
              { label:"Projects Active", val: projects?.filter(p=>p.status==="ACTIVE").length ?? 0, icon: FolderOpen, color:"text-purple-600",bg:"bg-purple-50" },
            ].map((s,i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2.5", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
                {overview === undefined
                  ? <div className="h-7 w-10 bg-gray-100 animate-pulse rounded mb-1" />
                  : <p className={cn("text-2xl font-extrabold leading-none mb-1", s.color)}>{s.val}</p>}
                <p className="text-xs text-gray-500 font-medium leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ═══════════ INTERNS VIEW ═══════════ */}
          {view === "interns" && (
            <>
              {/* Search + Filter */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search intern or school..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400" />
                </div>
                <div className="flex gap-1">
                  {(["all","present","attention"] as const).map(f => (
                    <button key={f} onClick={()=>setFilterBy(f)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                        filterBy===f ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}>{f}</button>
                  ))}
                </div>
                <div className="flex gap-1 ml-auto">
                  {(["engagement","progress","name"] as const).map(s => (
                    <button key={s} onClick={()=>setSortBy(s)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                        sortBy===s ? "bg-indigo-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Intern List */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />Interns
                  </h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{processed.length}</span>
                </div>

                {overview === undefined ? (
                  <div className="p-10 text-center"><div className="w-8 h-8 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-gray-400">Loading…</p></div>
                ) : processed.length === 0 ? (
                  <div className="p-14 text-center"><AlertCircle className="w-9 h-9 text-gray-200 mx-auto mb-3" /><p className="text-sm text-gray-400">No interns found</p></div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {processed.map(intern => {
                      const journaledToday = intern.lastJournalDate === today;
                      const allHabitsDone  = intern.habitsToday.total > 0 && intern.habitsToday.completed === intern.habitsToday.total;
                      const scoreColor = intern.engagementScore >= 80 ? "text-green-600" : intern.engagementScore >= 50 ? "text-amber-600" : "text-red-600";
                      const ringColor  = intern.engagementScore >= 80 ? "#22c55e" : intern.engagementScore >= 50 ? "#f59e0b" : "#ef4444";
                      const unread = (unreadCounts as any)?.[intern.id] ?? 0;

                      return (
                        <div key={intern.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                          {/* Avatar + Name */}
                          <Link href={`/interns/${intern.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar name={intern.fullName} />
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate text-sm">{intern.fullName}</p>
                              <p className="text-xs text-gray-400 truncate">{intern.school}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", intern.todayCheckedIn ? "bg-green-100":"bg-gray-100")} title="Check-in">
                                  <Clock className={cn("w-3 h-3", intern.todayCheckedIn ? "text-green-600":"text-gray-400")} />
                                </div>
                                <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", allHabitsDone ? "bg-orange-100":"bg-gray-100")} title="Habits">
                                  <Flame className={cn("w-3 h-3", allHabitsDone ? "text-orange-600":"text-gray-400")} />
                                </div>
                                <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", journaledToday ? "bg-indigo-100":"bg-gray-100")} title="Journal">
                                  <BookOpen className={cn("w-3 h-3", journaledToday ? "text-indigo-600":"text-gray-400")} />
                                </div>
                              </div>
                            </div>
                          </Link>

                          {/* Progress */}
                          <div className="hidden md:flex flex-col gap-1 w-24 shrink-0">
                            <div className="flex justify-between text-[11px] text-gray-400">
                              <span>{intern.progressPct}%</span><span>{Math.floor(intern.totalHours)}h</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div style={{width:`${Math.min(intern.progressPct,100)}%`}}
                                className={cn("h-full rounded-full", intern.progressPct>=100?"bg-green-500":"bg-blue-500")} />
                            </div>
                          </div>

                          {/* Engagement ring */}
                          <div className="relative hidden lg:flex shrink-0">
                            <Ring pct={intern.engagementScore} />
                            <div className="absolute inset-0 flex items-center justify-center rotate-90">
                              <span className={cn("text-[11px] font-extrabold", scoreColor)}>{intern.engagementScore}</span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setAssignTarget(intern)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                              title="Assign Task">
                              <ListTodo className="w-3 h-3" />
                              <span className="hidden sm:block">Task</span>
                            </button>
                            <button
                              onClick={() => setChatTarget(intern)}
                              className={cn(
                                "relative flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all border",
                                unread > 0
                                  ? "text-white bg-blue-600 hover:bg-blue-700 border-blue-600 shadow"
                                  : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                              )}
                              title="Direct Message">
                              <MessageSquare className="w-3 h-3" />
                              <span className="hidden sm:block">Chat</span>
                              {unread > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">{unread}</span>
                              )}
                            </button>
                            <Link href={`/interns/${intern.id}`}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-all">
                              <ArrowRight className="w-3 h-3" />
                              <span className="hidden sm:block">View</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════════ PROJECTS VIEW ═══════════ */}
          {view === "projects" && (
            <div className="space-y-4">
              {!projects ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <div className="w-8 h-8 mx-auto border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-400">Loading projects…</p>
                </div>
              ) : projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                  <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-base font-semibold text-gray-500 mb-1">No projects yet</p>
                  <p className="text-sm text-gray-400 mb-4">Create a group project to assign interns to collaborate together.</p>
                  <button onClick={() => setShowCreateProj(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm mx-auto transition-colors shadow">
                    <Plus className="w-4 h-4" />Create First Project
                  </button>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    {(["ACTIVE","PAUSED","COMPLETED","CANCELLED"] as const).map(s => (
                      <div key={s} className={cn("rounded-2xl border p-3 text-center", STATUS_COLOR[s] ? "bg-white" : "bg-gray-50", "border-gray-100 shadow-sm")}>
                        <p className="text-xl font-extrabold text-gray-900">{projects.filter(p=>p.status===s).length}</p>
                        <p className="text-xs font-medium text-gray-500 capitalize">{s.toLowerCase()}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {projects.map(proj => (
                      <ProjectCard
                        key={proj.id}
                        project={proj}
                        token={token!}
                        onStatusChange={async (id, status) => {
                          await updateProject({ token: token!, projectId: id as Id<"internProjects">, status });
                        }}
                        onDelete={async (id) => {
                          if (confirm("Delete this project?")) {
                            await deleteProject({ token: token!, projectId: id as Id<"internProjects"> });
                          }
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══════════ SETTINGS / GEOFENCE VIEW ═══════════ */}
          {view === "settings" && (
            <div className="space-y-4">
              {/* Info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">GPS Check-In Zones</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Define office locations where interns are allowed to check in. When zones are active, interns must be within the specified radius to log attendance. Coordinates and addresses are recorded for full transparency.
                    </p>
                  </div>
                </div>
              </div>

              {/* Add fence form */}
              {showAddFence && token && (
                <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-green-50">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <p className="font-bold text-gray-900 text-sm">Add New Check-In Zone</p>
                    </div>
                    <button onClick={() => setShowAddFence(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                  <form onSubmit={handleAddFence} className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Zone Name *</label>
                      <input value={fenceName} onChange={e => setFenceName(e.target.value)} required placeholder="e.g. DICT R5 Main Office"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Latitude *</label>
                        <input value={fenceLat} onChange={e => setFenceLat(e.target.value)} required placeholder="13.621000" type="number" step="any"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400 font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Longitude *</label>
                        <input value={fenceLng} onChange={e => setFenceLng(e.target.value)} required placeholder="123.194000" type="number" step="any"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400 font-mono" />
                      </div>
                    </div>
                    <button type="button" onClick={useCurrentLocationForFence}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold">
                      <Navigation className="w-3.5 h-3.5" />Use my current location
                    </button>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Allowed Radius (meters)</label>
                      <input value={fenceRadius} onChange={e => setFenceRadius(e.target.value)} type="number" min="10" max="5000" placeholder="200"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400" />
                      <p className="text-[11px] text-gray-400 mt-1">Interns must be within this distance from the coordinates to check in.</p>
                    </div>
                    <button type="submit" disabled={fenceLoading}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                      {fenceLoading ? "Saving…" : "Save Zone"}
                    </button>
                  </form>
                </div>
              )}

              {/* Fence list */}
              {!allFences ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <div className="w-7 h-7 mx-auto border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-sm text-gray-400">Loading zones…</p>
                </div>
              ) : allFences.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
                  <MapPin className="w-11 h-11 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-500 mb-1">No zones configured</p>
                  <p className="text-xs text-gray-400 mb-4">Add a check-in zone to enable GPS-verified attendance. Interns outside the zone won't be able to check in.</p>
                  <button onClick={() => setShowAddFence(true)} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm mx-auto transition-colors">
                    <Plus className="w-4 h-4" />Add First Zone
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {allFences.map((fence: any) => (
                    <div key={fence._id} className={cn("bg-white border rounded-2xl shadow-sm p-4", fence.isActive ? "border-green-200" : "border-gray-200 opacity-60")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", fence.isActive ? "bg-green-100" : "bg-gray-100")}>
                            <MapPin className={cn("w-4 h-4", fence.isActive ? "text-green-600" : "text-gray-400")} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900">{fence.name}</p>
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", fence.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                                {fence.isActive ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-gray-400 mt-0.5">{fence.lat.toFixed(6)}, {fence.lng.toFixed(6)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Radius: <strong>{fence.radiusMeters}m</strong> · Set by {fence.createdBy}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => token && updateFence({ token, fenceId: fence._id, isActive: !fence.isActive })}
                            className={cn("text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors",
                              fence.isActive
                                ? "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
                                : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                            )}>
                            {fence.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete "${fence.name}"?`) && token) deleteFence({ token, fenceId: fence._id }); }}
                            className="text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Modals / Drawers ── */}
      {assignTarget && token && (
        <AssignTaskModal token={token} intern={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
      {chatTarget && token && (
        <ChatDrawer token={token} intern={chatTarget} onClose={() => setChatTarget(null)} />
      )}
      {showCreateProj && token && overview && (
        <CreateProjectModal token={token} allInterns={overview as OverviewIntern[]} onClose={() => setShowCreateProj(false)} />
      )}
    </div>
  );
}
