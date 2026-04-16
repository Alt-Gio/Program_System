"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { avatarColor, initials, TASK_BADGE, PRIORITY_CFG } from "../_utils";
import type { Id } from "@/convex/_generated/dataModel";

const STATUSES   = ["ALL","PENDING","IN_PROGRESS","COMPLETED","CANCELLED"] as const;
const PRIORITIES = ["URGENT","HIGH","MEDIUM","LOW"] as const;
const EMPTY_FORM = { internId: "", title: "", description: "", priority: "MEDIUM", dueDate: "" };

export default function TasksPage() {
  const interns       = useQuery(api.interns.list);
  const addTask       = useMutation(api.interns.addTask);
  const updateStatus  = useMutation(api.interns.updateTaskStatus);
  const deleteTask    = useMutation(api.interns.deleteTask);

  const [statusFilter,   setStatusFilter]   = useState<string>("ALL");
  const [internFilter,   setInternFilter]   = useState("ALL");
  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    if (!interns) return [];
    return interns
      .filter(i => internFilter === "ALL" || i.id === internFilter)
      .flatMap(i => i.tasks
        .filter(t => statusFilter === "ALL" || t.status === statusFilter)
        .map(t => ({ ...t, internName: i.fullName, school: i.school, iid: i.id }))
      )
      .sort((a, b) => {
        const order: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
      });
  }, [interns, statusFilter, internFilter]);

  const stats = useMemo(() => {
    if (!interns) return null;
    const all = interns.flatMap(i => i.tasks);
    return {
      total:      all.length,
      pending:    all.filter(t => t.status === "PENDING").length,
      inProgress: all.filter(t => t.status === "IN_PROGRESS").length,
      done:       all.filter(t => t.status === "COMPLETED").length,
    };
  }, [interns]);

  async function handleSave() {
    if (!form.internId || !form.title) return;
    setSaving(true);
    try {
      await addTask({ internId: form.internId as Id<"interns">, title: form.title, description: form.description || undefined, priority: form.priority, dueDate: form.dueDate || undefined });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
    } finally { setSaving(false); }
  }

  async function handleStatusChange(taskId: string, status: string) {
    await updateStatus({ taskId: taskId as Id<"internTasks">, status });
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    await deleteTask({ taskId: taskId as Id<"internTasks"> });
  }

  const loading = interns === undefined;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks & Activities</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track tasks assigned to interns</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow shrink-0" onClick={() => { setForm({ ...EMPTY_FORM }); setOpen(true); }}>
          <Plus className="w-4 h-4" />Add Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",       val: stats?.total ?? 0,      color: "text-gray-900" },
          { label: "Pending",     val: stats?.pending ?? 0,    color: "text-amber-600" },
          { label: "In Progress", val: stats?.inProgress ?? 0, color: "text-blue-600" },
          { label: "Completed",   val: stats?.done ?? 0,       color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            {loading ? <Skeleton className="h-7 w-8 mx-auto mb-1" /> : <p className={cn("text-2xl font-bold", s.color)}>{s.val}</p>}
            <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                statusFilter === s ? "bg-blue-600 text-white border-blue-600 shadow" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}>{s === "ALL" ? "All" : s.replace("_", " ")}</button>
          ))}
        </div>
        <select value={internFilter} onChange={e => setInternFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 shadow-sm outline-none min-w-[160px]">
          <option value="ALL">All Interns</option>
          {(interns ?? []).map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <CheckSquare className="w-9 h-9 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No tasks found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold">
                <th className="px-4 py-3 text-left w-6"></th>
                <th className="px-4 py-3 text-left">Task</th>
                <th className="px-4 py-3 text-left">Intern</th>
                <th className="px-4 py-3 text-center">Priority</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Due Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => {
                const pcfg = PRIORITY_CFG[row.priority] ?? PRIORITY_CFG.LOW;
                return (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3"><div className={cn("w-2 h-2 rounded-full", pcfg.dot)} /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{row.title}</p>
                      {row.description && <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{row.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: avatarColor(row.internName) }}>{initials(row.internName)}</div>
                        <span className="text-gray-700 font-medium">{row.internName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", pcfg.badge)}>{pcfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell tabular-nums">{row.dueDate ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <select value={row.status}
                        onChange={e => handleStatusChange(row.id, e.target.value)}
                        className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border outline-none cursor-pointer", TASK_BADGE[row.status] ?? "bg-gray-50 text-gray-500 border-gray-200")}>
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(row.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length > 0 && <div className="px-4 py-2.5 border-t border-gray-50"><p className="text-[11px] text-gray-400">{rows.length} task{rows.length !== 1 ? "s" : ""}</p></div>}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intern *</Label>
              <select value={form.internId} onChange={e => setForm(f => ({ ...f, internId: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select intern…</option>
                {(interns ?? []).map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Title *</Label>
              <Input placeholder="Task title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Description</Label>
              <Textarea placeholder="Optional description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Priority</Label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.internId || !form.title}
              className="bg-blue-600 hover:bg-blue-700 text-white">{saving ? "Saving…" : "Add Task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
