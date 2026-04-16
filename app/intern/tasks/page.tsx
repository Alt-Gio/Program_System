"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  CheckCircle2, Clock, Play, Pause, AlertCircle, ChevronLeft,
  Plus, Send, Paperclip, X, Trophy, Star, Zap, Award,
  Upload, FileText, Image, Trash2, Shield, TriangleAlert,
  Loader2, Check, MessageSquare, Eye, Calendar, Flag,
  ArrowRight, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────
type Task = {
  _id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  completedAt?: string | null;
  progressNotes?: { note: string; createdAt: number }[];
  completionNote?: string | null;
  proofUrls?: { storageId: string; url: string }[];
  submittedAt?: number | null;
  supervisorNotified?: boolean;
  createdAt: number;
};

type Filter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

// ─── Constants ───────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; icon: any; ring: string; badge: string; bg: string }> = {
  PENDING:     { label: "Pending",     icon: Clock,         ring: "ring-gray-400/30",   badge: "bg-gray-100 text-gray-500 border-gray-200",    bg: "bg-gray-50"    },
  IN_PROGRESS: { label: "In Progress", icon: Play,          ring: "ring-blue-400/40",   badge: "bg-blue-50 text-blue-700 border-blue-200",     bg: "bg-blue-50/50" },
  COMPLETED:   { label: "Completed",   icon: CheckCircle2,  ring: "ring-green-400/40",  badge: "bg-green-50 text-green-700 border-green-200",  bg: "bg-green-50/50"},
  CANCELLED:   { label: "Cancelled",   icon: X,             ring: "ring-red-400/30",    badge: "bg-red-50 text-red-500 border-red-200",        bg: "bg-red-50/50"  },
};

const PRI_META: Record<string, { label: string; dot: string; border: string; badge: string }> = {
  URGENT: { label: "Urgent", dot: "bg-red-500",    border: "border-l-red-500",    badge: "bg-red-100 text-red-700 border-red-200"    },
  HIGH:   { label: "High",   dot: "bg-orange-500", border: "border-l-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  MEDIUM: { label: "Medium", dot: "bg-amber-400",  border: "border-l-amber-400",  badge: "bg-amber-100 text-amber-700 border-amber-200" },
  LOW:    { label: "Low",    dot: "bg-gray-300",   border: "border-l-gray-300",   badge: "bg-gray-100 text-gray-500 border-gray-200"  },
};

const STATUS_ORDER = ["PENDING", "IN_PROGRESS", "COMPLETED"];

const MILESTONES = [
  { id: "first_start",  emoji: "🌱", label: "First Step",      desc: "Started your first task",       check: (s: any) => s.inProgressCount >= 1 || s.completedCount >= 1 },
  { id: "first_done",   emoji: "✅", label: "Delivered",        desc: "Completed your first task",     check: (s: any) => s.completedCount >= 1  },
  { id: "three_done",   emoji: "⚡", label: "On a Roll",        desc: "Completed 3 tasks",             check: (s: any) => s.completedCount >= 3  },
  { id: "five_done",    emoji: "🏆", label: "Taskmaster",       desc: "Completed 5 tasks",             check: (s: any) => s.completedCount >= 5  },
  { id: "ten_done",     emoji: "🌟", label: "Exceptional",      desc: "Completed 10 tasks",            check: (s: any) => s.completedCount >= 10 },
  { id: "on_time",      emoji: "🎯", label: "Deadline Keeper",  desc: "Completed a task on time",      check: (s: any) => s.onTimeCount >= 1     },
  { id: "documented",   emoji: "📎", label: "Well Documented",  desc: "Uploaded proof of work",        check: (s: any) => s.proofCount >= 1      },
  { id: "thorough",     emoji: "📝", label: "Thorough",         desc: "Added 5+ progress notes",       check: (s: any) => s.totalNotes >= 5      },
];

// ─── Helpers ─────────────────────────────────────────────────
function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function isOverdue(task: Task) {
  return task.status !== "COMPLETED" && task.status !== "CANCELLED"
    && !!task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);
}
function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
}

// ─── Sub-components ──────────────────────────────────────────
function PriorityDot({ p }: { p: string }) {
  return <div className={cn("w-2 h-2 rounded-full shrink-0", PRI_META[p]?.dot ?? "bg-gray-300")} />;
}

function StatusBadge({ s }: { s: string }) {
  const m = STATUS_META[s];
  const Icon = m?.icon ?? Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border", m?.badge ?? "bg-gray-100 text-gray-500")}>
      <Icon className="w-2.5 h-2.5" />{m?.label ?? s}
    </span>
  );
}

function ProgressBar({ task }: { task: Task }) {
  const idx   = STATUS_ORDER.indexOf(task.status);
  const steps = [
    { label: "Assigned",    done: idx >= 0 },
    { label: "In Progress", done: idx >= 1 },
    { label: "Completed",   done: idx >= 2 },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-0">
          <div className={cn("flex flex-col items-center gap-1")}>
            <div className={cn(
              "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-extrabold transition-all",
              step.done ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-200 bg-white text-gray-300"
            )}>
              {step.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <p className="text-[9px] font-semibold text-gray-400 whitespace-nowrap">{step.label}</p>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("h-0.5 w-12 sm:w-20 mb-3.5 transition-all", idx > i ? "bg-indigo-500" : "bg-gray-100")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TaskCard ────────────────────────────────────────────────
function TaskCard({ task, active, onClick }: { task: Task; active: boolean; onClick: () => void }) {
  const overdue = isOverdue(task);
  const hasProof = (task.proofUrls?.length ?? 0) > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border-l-4 border border-gray-100 p-4 transition-all hover:shadow-md active:scale-[0.99]",
        PRI_META[task.priority]?.border ?? "border-l-gray-300",
        active ? "bg-indigo-50 border-indigo-200 shadow-md ring-1 ring-indigo-400/30" : "bg-white hover:bg-gray-50/80"
      )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={cn("font-semibold text-sm leading-snug", task.status === "COMPLETED" ? "text-gray-400 line-through" : "text-gray-900")}>
          {task.title}
        </p>
        <StatusBadge s={task.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", PRI_META[task.priority]?.badge ?? "bg-gray-100 text-gray-500")}>
          {PRI_META[task.priority]?.label ?? task.priority}
        </span>
        {task.dueDate && (
          <span className={cn("flex items-center gap-1 text-[10px] font-medium", overdue ? "text-red-500" : "text-gray-400")}>
            <Calendar className="w-3 h-3" />
            {overdue && <TriangleAlert className="w-3 h-3" />}
            {fmtDate(task.dueDate)}
          </span>
        )}
        {hasProof && <span className="text-[10px] text-indigo-500 flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{task.proofUrls!.length}</span>}
        {(task.progressNotes?.length ?? 0) > 0 && (
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{task.progressNotes!.length}</span>
        )}
      </div>
    </button>
  );
}

// ─── TaskDetail ──────────────────────────────────────────────
function TaskDetail({
  task, token, onBack, onUpdate,
}: {
  task: Task; token: string; onBack?: () => void; onUpdate: () => void;
}) {
  const [noteText, setNoteText]       = useState("");
  const [addingNote, setAddingNote]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [showSubmit, setShowSubmit]   = useState(false);
  const [compNote, setCompNote]       = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [err, setErr]                 = useState("");
  const fileRef                       = useRef<HTMLInputElement>(null);

  const addNote      = useMutation(api.internTasks.addProgressNote);
  const updateStatus = useMutation(api.internTasks.updateStatus);
  const genUrl       = useMutation(api.internTasks.generateUploadUrl);
  const saveProof    = useMutation(api.internTasks.saveProofFile);
  const removeProof  = useMutation(api.internTasks.removeProofFile);
  const submitComp   = useMutation(api.internTasks.submitCompletion);

  const overdue = isOverdue(task);
  const isDone  = task.status === "COMPLETED" || task.status === "CANCELLED";

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    try { await addNote({ token, taskId: task._id as Id<"internTasks">, note: noteText.trim() }); setNoteText(""); }
    catch (e: any) { setErr(e.message); }
    finally { setAddingNote(false); }
  }

  async function handleStatusChange(status: string) {
    setErr("");
    try { await updateStatus({ token, taskId: task._id as Id<"internTasks">, status }); onUpdate(); }
    catch (e: any) { setErr(e.message); }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setErr("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) { setErr("File too large (max 10 MB)."); continue; }
        const uploadUrl = await genUrl({ token });
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("Upload failed");
        const { storageId } = await res.json();
        await saveProof({ token, taskId: task._id as Id<"internTasks">, storageId });
      }
      onUpdate();
    } catch (e: any) { setErr(e.message); }
    finally { setUploading(false); }
  }

  async function handleSubmitCompletion(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr("");
    try {
      await submitComp({ token, taskId: task._id as Id<"internTasks">, completionNote: compNote.trim() || undefined });
      setShowSubmit(false); onUpdate();
    } catch (e: any) { setErr(e.message); }
    finally { setSubmitting(false); }
  }

  async function handleRemoveProof(storageId: string) {
    try { await removeProof({ token, taskId: task._id as Id<"internTasks">, storageId }); onUpdate(); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors md:hidden">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className={cn("font-extrabold text-gray-900 text-lg leading-tight", task.status === "COMPLETED" && "line-through text-gray-400")}>
            {task.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <StatusBadge s={task.status} />
            <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", PRI_META[task.priority]?.badge ?? "bg-gray-100 text-gray-500")}>
              {PRI_META[task.priority]?.label ?? task.priority}
            </span>
            {task.dueDate && (
              <span className={cn("flex items-center gap-1 text-xs font-medium", overdue ? "text-red-500" : "text-gray-500")}>
                <Calendar className="w-3.5 h-3.5" />
                {overdue && "Overdue · "}Due {fmtDate(task.dueDate)}
              </span>
            )}
            {task.supervisorNotified && (
              <span className="flex items-center gap-1 text-[11px] text-green-600 font-semibold">
                <Shield className="w-3 h-3" />Supervisor notified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 space-y-6">

          {/* Progress stepper */}
          {task.status !== "CANCELLED" && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Progress</p>
              <ProgressBar task={task} />
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Status Actions */}
          {!isDone && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {task.status === "PENDING" && (
                  <button onClick={() => handleStatusChange("IN_PROGRESS")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm">
                    <Play className="w-4 h-4" />Start Working
                  </button>
                )}
                {task.status === "IN_PROGRESS" && (
                  <>
                    <button onClick={() => handleStatusChange("PENDING")}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors">
                      <Pause className="w-4 h-4" />Pause
                    </button>
                    <button onClick={() => setShowSubmit(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />Mark Complete
                    </button>
                  </>
                )}
                {task.status === "PENDING" && (
                  <button onClick={() => setShowSubmit(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm">
                    <CheckCircle2 className="w-4 h-4" />Mark Complete
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Completion note (if completed) */}
          {task.status === "COMPLETED" && task.completionNote && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3.5">
              <p className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />Completion Summary
              </p>
              <p className="text-sm text-green-800 whitespace-pre-wrap">{task.completionNote}</p>
              {task.submittedAt && <p className="text-[11px] text-green-600/60 mt-2">Submitted {fmtTime(task.submittedAt)}</p>}
            </div>
          )}

          {/* Proof Files */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Proof of Work</p>
              {!isDone && (
                <button onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:text-indigo-700 disabled:opacity-50">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? "Uploading…" : "Upload File"}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden" onChange={e => handleFileUpload(e.target.files)} />

            {(task.proofUrls?.length ?? 0) === 0 ? (
              !isDone ? (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group">
                  <Upload className="w-7 h-7 text-gray-300 group-hover:text-indigo-400 mx-auto mb-2 transition-colors" />
                  <p className="text-sm font-semibold text-gray-400 group-hover:text-indigo-500">Upload proof of work</p>
                  <p className="text-xs text-gray-300 mt-0.5">Images, PDFs, documents · Max 10 MB each</p>
                </button>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No files uploaded</p>
              )
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {task.proofUrls!.map(({ storageId, url }) => (
                  <div key={storageId} className="relative group rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                    {isImageUrl(url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="proof" className="w-full h-28 object-cover" />
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center h-28 gap-2 hover:bg-gray-100 transition-colors">
                        <FileText className="w-8 h-8 text-indigo-400" />
                        <p className="text-[10px] text-gray-500 font-medium px-2 text-center truncate w-full">Open File</p>
                      </a>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 bg-white rounded-lg shadow text-gray-700 hover:text-indigo-600">
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      {!isDone && (
                        <button onClick={() => handleRemoveProof(storageId)}
                          className="p-1.5 bg-white rounded-lg shadow text-gray-700 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!isDone && (
                  <button onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-gray-300 hover:text-indigo-400 gap-1">
                    <Plus className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Add more</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress Notes */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Progress Log</p>
            {(task.progressNotes?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 italic">No updates yet. Add one below.</p>
            ) : (
              <div className="space-y-2.5 mb-3">
                {[...task.progressNotes!].reverse().map((n, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 shrink-0 flex flex-col items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                      {i < task.progressNotes!.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-sm text-gray-700 leading-relaxed">{n.note}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{fmtTime(n.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isDone && (
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a progress update…"
                  className="flex-1 px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                />
                <button type="submit" disabled={!noteText.trim() || addingNote}
                  className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 flex items-center justify-center text-white transition-colors shrink-0">
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            )}
          </div>

          {err && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{err}</p>
            </div>
          )}
        </div>
      </div>

      {/* Submit Completion Modal */}
      {showSubmit && (
        <div className="absolute inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900">Submit Completion</h3>
                <p className="text-xs text-gray-500">Your supervisor will be notified immediately</p>
              </div>
            </div>
            <form onSubmit={handleSubmitCompletion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Completion Summary <span className="text-gray-300">(optional)</span></label>
                <textarea
                  value={compNote}
                  onChange={e => setCompNote(e.target.value)}
                  rows={4}
                  placeholder="Briefly describe what you accomplished, challenges faced, and any handover notes…"
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400 resize-none"
                />
              </div>
              {(task.proofUrls?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  {task.proofUrls!.length} proof file{task.proofUrls!.length > 1 ? "s" : ""} will be included
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSubmit(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-extrabold rounded-2xl transition-colors shadow">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {submitting ? "Submitting…" : "Submit & Notify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function InternTasksPage() {
  const [token, setToken]   = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false); // mobile: show detail panel
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const tasks      = useQuery(api.internTasks.getMyTasks, token ? { token } : "skip");
  const milestones = useQuery(api.internTasks.getTaskMilestones, token ? { token } : "skip");

  // Force re-read after mutations
  const onUpdate = useCallback(() => setRefreshKey(k => k + 1), []);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    let list = [...tasks] as Task[];
    if (filter !== "ALL") list = list.filter(t => t.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    // Sort: overdue first, then by priority, then by createdAt
    const PRI_W: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    list.sort((a, b) => {
      if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
      if (b.status === "COMPLETED" && a.status !== "COMPLETED") return -1;
      const aOD = isOverdue(a) ? 1 : 0, bOD = isOverdue(b) ? 1 : 0;
      if (bOD !== aOD) return bOD - aOD;
      return (PRI_W[b.priority] ?? 0) - (PRI_W[a.priority] ?? 0);
    });
    return list;
  }, [tasks, filter, search, refreshKey]);

  const activeTask = useMemo(
    () => (tasks as Task[] | undefined)?.find(t => t._id === activeId) ?? null,
    [tasks, activeId, refreshKey]
  );

  const unlockedMilestones = useMemo(
    () => milestones ? MILESTONES.filter(m => m.check(milestones)) : [],
    [milestones]
  );

  const stats = useMemo(() => {
    if (!tasks) return null;
    const t = tasks as Task[];
    return {
      total:       t.length,
      pending:     t.filter(x => x.status === "PENDING").length,
      inProgress:  t.filter(x => x.status === "IN_PROGRESS").length,
      completed:   t.filter(x => x.status === "COMPLETED").length,
      overdue:     t.filter(isOverdue).length,
    };
  }, [tasks, refreshKey]);

  if (!token || tasks === undefined) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "ALL",         label: "All",         count: stats?.total ?? 0 },
    { key: "PENDING",     label: "Pending",     count: stats?.pending ?? 0 },
    { key: "IN_PROGRESS", label: "In Progress", count: stats?.inProgress ?? 0 },
    { key: "COMPLETED",   label: "Completed",   count: stats?.completed ?? 0 },
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 7rem)" }}>
      {/* ── Mobile: show detail overlay ── */}
      {showDetail && activeTask && token && (
        <div className="md:hidden fixed inset-0 z-30 bg-white">
          <TaskDetail
            task={activeTask}
            token={token}
            onBack={() => setShowDetail(false)}
            onUpdate={onUpdate}
          />
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="px-4 pt-4 pb-0 md:px-6 shrink-0">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total",    val: stats?.total ?? 0,      color: "text-gray-900"   },
            { label: "Active",   val: stats?.inProgress ?? 0, color: "text-blue-600"   },
            { label: "Done",     val: stats?.completed ?? 0,  color: "text-green-600"  },
            { label: "Overdue",  val: stats?.overdue ?? 0,    color: "text-red-500"    },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
              <p className={cn("text-xl font-extrabold", s.color)}>{s.val}</p>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Milestones bar ── */}
      {unlockedMilestones.length > 0 && (
        <div className="px-4 md:px-6 pt-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-500" />Earned
            </p>
            {unlockedMilestones.map(m => (
              <div key={m.id} title={m.desc}
                className="shrink-0 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1">
                <span className="text-sm">{m.emoji}</span>
                <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters + Search ── */}
      <div className="px-4 md:px-6 pt-3 shrink-0 space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                filter === f.key
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
              )}>
              {f.label}
              <span className={cn("text-[10px] font-extrabold px-1.5 py-0.5 rounded-full",
                filter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
        />
      </div>

      {/* ── Main content: two-column on desktop ── */}
      <div className="flex-1 overflow-hidden flex gap-4 px-4 md:px-6 pt-3 pb-4">
        {/* Task list */}
        <div className={cn(
          "flex flex-col gap-2 overflow-y-auto",
          activeTask ? "hidden md:flex md:w-80 lg:w-96 shrink-0" : "w-full"
        )}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-gray-200 mb-3" />
              <p className="font-semibold text-gray-400 text-sm">
                {filter === "ALL" ? "No tasks assigned yet" : `No ${filter.toLowerCase().replace("_"," ")} tasks`}
              </p>
              <p className="text-xs text-gray-300 mt-1">Your supervisor will assign tasks here</p>
            </div>
          ) : (
            filtered.map(task => (
              <TaskCard
                key={task._id}
                task={task}
                active={task._id === activeId}
                onClick={() => { setActiveId(task._id); setShowDetail(true); }}
              />
            ))
          )}
        </div>

        {/* Task detail (desktop: inline panel, mobile: handled via overlay above) */}
        {activeTask && token ? (
          <div className="hidden md:flex flex-1 rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative">
            <TaskDetail
              task={activeTask}
              token={token}
              onUpdate={onUpdate}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-gray-100">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">Select a task to view details</p>
              <p className="text-xs text-gray-300 mt-1">Track progress, upload proof, and notify your supervisor</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
