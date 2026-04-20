"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CalendarCheck, Plus, Trash2, CalendarDays, QrCode, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { avatarColor, initials, ATT_BADGE } from "../_utils";
import type { Id } from "@/convex/_generated/dataModel";

const ATT_STATUSES = ["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"] as const;

const EMPTY_FORM = { internId: "", date: new Date().toISOString().slice(0, 10), timeIn: "08:00", timeOut: "17:00", status: "PRESENT", notes: "" };

export default function AttendancePage() {
  const interns       = useQuery(api.interns.list);
  const addAtt        = useMutation(api.interns.addAttendance);
  const deleteAtt     = useMutation(api.interns.deleteAttendance);

  const [dateFilter,   setDateFilter]   = useState(new Date().toISOString().slice(0, 10));
  const [internFilter, setInternFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    if (!interns) return [];
    return interns
      .flatMap(i => i.attendance
        .filter(a =>
          (!dateFilter || a.date === dateFilter) &&
          (internFilter === "ALL" || i.id === internFilter) &&
          (methodFilter === "ALL" ||
           (methodFilter === "QR"      && a.checkInMethod === "QR") ||
           (methodFilter === "FACE_CV" && a.checkInMethod === "FACE_CV") ||
           (methodFilter === "MANUAL"  && !a.checkInMethod))
        )
        .map(a => ({ ...a, internName: i.fullName, school: i.school, iid: i.id }))
      )
      .sort((a, b) => (a.timeIn ?? "").localeCompare(b.timeIn ?? ""));
  }, [interns, dateFilter, internFilter, methodFilter]);

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!interns) return null;
    const active   = interns.filter(i => i.status === "ACTIVE");
    const attToday = active.filter(i => i.attendance.some(a => a.date === today));
    const present  = active.filter(i => i.attendance.some(a => a.date === today && (a.status === "PRESENT" || a.status === "HALF_DAY")));
    const absent   = active.filter(i => i.attendance.some(a => a.date === today && a.status === "ABSENT"));
    return { active: active.length, logged: attToday.length, present: present.length, absent: absent.length };
  }, [interns]);

  async function handleSave() {
    if (!form.internId || !form.date || !form.status) return;
    setSaving(true);
    try {
      const timeIn  = form.timeIn  ? `${form.date}T${form.timeIn}:00`  : undefined;
      const timeOut = form.timeOut ? `${form.date}T${form.timeOut}:00` : undefined;
      await addAtt({ internId: form.internId as Id<"interns">, date: form.date, timeIn, timeOut, status: form.status, notes: form.notes || undefined });
      setOpen(false);
      setForm({ ...EMPTY_FORM, date: form.date });
    } finally { setSaving(false); }
  }

  async function handleDelete(internId: string, recordId: string) {
    if (!confirm("Delete this attendance record?")) return;
    await deleteAtt({ internId: internId as Id<"interns">, recordId: recordId as Id<"internAttendance"> });
  }

  const loading = interns === undefined;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance / DTR</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily Time Record for all interns</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow shrink-0" onClick={() => { setForm({ ...EMPTY_FORM, date: dateFilter }); setOpen(true); }}>
          <Plus className="w-4 h-4" />Log Attendance
        </Button>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Interns", val: todayStats?.active ?? 0,  color: "text-gray-900" },
          { label: "Logged Today",   val: todayStats?.logged ?? 0,  color: "text-blue-600" },
          { label: "Present",        val: todayStats?.present ?? 0, color: "text-green-600" },
          { label: "Absent",         val: todayStats?.absent ?? 0,  color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            {loading ? <Skeleton className="h-7 w-8 mx-auto mb-1" /> : <p className={cn("text-2xl font-bold", s.color)}>{s.val}</p>}
            <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
          <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="text-sm font-medium text-gray-700 bg-transparent outline-none" />
        </div>
        <select value={internFilter} onChange={e => setInternFilter(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 shadow-sm outline-none">
          <option value="ALL">All Interns</option>
          {(interns ?? []).map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
        </select>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 shadow-sm outline-none shrink-0">
          <option value="ALL">All Methods</option>
          <option value="QR">QR Only</option>
          <option value="FACE_CV">Face Recognition</option>
          <option value="MANUAL">Manual</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => { setDateFilter(""); setInternFilter("ALL"); setMethodFilter("ALL"); }} className="text-xs shrink-0">Clear</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarCheck className="w-9 h-9 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No attendance records{dateFilter ? ` for ${dateFilter}` : ""}</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold">
                <th className="px-4 py-3 text-left">Intern</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">School</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Time In</th>
                <th className="px-4 py-3 text-left">Time Out</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Hours</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Method</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Notes</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: avatarColor(row.internName) }}>{initials(row.internName)}</div>
                      <span className="font-medium text-gray-800">{row.internName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{row.school}</td>
                  <td className="px-4 py-3 font-medium text-gray-700 tabular-nums">{row.date}</td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums font-medium">{row.timeIn ? row.timeIn.slice(11, 16) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums font-medium">{row.timeOut ? row.timeOut.slice(11, 16) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-600 hidden md:table-cell">{row.hours != null ? `${row.hours}h` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", ATT_BADGE[row.status] ?? "bg-gray-50 text-gray-500 border-gray-200")}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {row.checkInMethod === "FACE_CV" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200" title={row.faceConfidence != null ? `Confidence: ${Math.round(row.faceConfidence * 100)}%` : "Face Recognition"}>
                        <ScanFace className="w-3 h-3" />
                        {row.faceConfidence != null ? `${Math.round(row.faceConfidence * 100)}%` : "Face"}
                      </span>
                    ) : row.checkInMethod === "QR" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                        <QrCode className="w-3 h-3" />QR
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell max-w-[150px] truncate">{row.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(row.iid, row.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 && <div className="px-4 py-2.5 border-t border-gray-50"><p className="text-[11px] text-gray-400">{rows.length} record{rows.length !== 1 ? "s" : ""}</p></div>}
      </div>

      {/* Log Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Attendance</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intern *</Label>
              <select value={form.internId} onChange={e => setForm(f => ({ ...f, internId: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select intern…</option>
                {(interns ?? []).filter(i => i.status === "ACTIVE").map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Status *</Label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  {ATT_STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Time In</Label>
                <Input type="time" value={form.timeIn} onChange={e => setForm(f => ({ ...f, timeIn: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Time Out</Label>
                <Input type="time" value={form.timeOut} onChange={e => setForm(f => ({ ...f, timeOut: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.internId || !form.date}
              className="bg-blue-600 hover:bg-blue-700 text-white">{saving ? "Saving…" : "Save Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
