"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FolderOpen, Plus, Trash2, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { avatarColor, initials, DOC_TYPES, DOC_BADGE } from "../_utils";
import type { Id } from "@/convex/_generated/dataModel";

const EMPTY_FORM = { internId: "", name: "", type: "REPORT", url: "", uploadedBy: "" };

export default function DocumentsPage() {
  const interns       = useQuery(api.interns.list);
  const addDoc        = useMutation(api.interns.addDocument);
  const deleteDoc     = useMutation(api.interns.deleteDocument);

  const [typeFilter,   setTypeFilter]   = useState("ALL");
  const [internFilter, setInternFilter] = useState("ALL");
  const [open,  setOpen]  = useState(false);
  const [form,  setForm]  = useState({ ...EMPTY_FORM });
  const [saving,setSaving]= useState(false);

  const rows = useMemo(() => {
    if (!interns) return [];
    return interns
      .filter(i => internFilter === "ALL" || i.id === internFilter)
      .flatMap(i => i.documents
        .filter(d => typeFilter === "ALL" || d.type === typeFilter)
        .map(d => ({ ...d, internName: i.fullName, school: i.school }))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [interns, typeFilter, internFilter]);

  const stats = useMemo(() => {
    if (!interns) return null;
    const all = interns.flatMap(i => i.documents);
    const byType: Record<string, number> = {};
    all.forEach(d => { byType[d.type] = (byType[d.type] ?? 0) + 1; });
    return { total: all.length, byType };
  }, [interns]);

  async function handleSave() {
    if (!form.internId || !form.name || !form.url) return;
    setSaving(true);
    try {
      await addDoc({ internId: form.internId as Id<"interns">, name: form.name, type: form.type, url: form.url, uploadedBy: form.uploadedBy || undefined });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
    } finally { setSaving(false); }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;
    await deleteDoc({ docId: docId as Id<"internDocuments"> });
  }

  const loading = interns === undefined;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage intern files, certificates, and submitted forms</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow shrink-0" onClick={() => { setForm({ ...EMPTY_FORM }); setOpen(true); }}>
          <Plus className="w-4 h-4" />Add Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading
          ? [1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
          : [
              { label: "Total Documents", val: stats?.total ?? 0,                  color: "text-gray-900" },
              { label: "Reports",         val: stats?.byType["REPORT"] ?? 0,       color: "text-green-600" },
              { label: "Certificates",    val: stats?.byType["CERTIFICATE"] ?? 0,  color: "text-amber-600" },
              { label: "Work Plans",      val: stats?.byType["WORK_PLAN"] ?? 0,    color: "text-indigo-600" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                <p className={cn("text-2xl font-bold", s.color)}>{s.val}</p>
                <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
              </div>
            ))
        }
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {["ALL", ...DOC_TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                typeFilter === t ? "bg-blue-600 text-white border-blue-600 shadow" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}>{t === "ALL" ? "All" : t.replace("_", " ")}</button>
          ))}
        </div>
        <select value={internFilter} onChange={e => setInternFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 shadow-sm outline-none min-w-[160px]">
          <option value="ALL">All Interns</option>
          {(interns ?? []).map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
        </select>
      </div>

      {/* Document grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <FolderOpen className="w-9 h-9 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((doc, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 leading-tight truncate">{doc.name}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 inline-block", DOC_BADGE[doc.type] ?? DOC_BADGE.OTHER)}>
                      {doc.type.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors" title="Open document">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => handleDelete(doc.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: avatarColor(doc.internName) }}>
                  {initials(doc.internName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{doc.internName}</p>
                  {doc.uploadedBy && <p className="text-[10px] text-gray-400 truncate">by {doc.uploadedBy}</p>}
                </div>
                <p className="text-[10px] text-gray-400 tabular-nums shrink-0">{new Date(doc.createdAt).toLocaleDateString()}</p>
              </div>
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((tag, ti) => (
                    <span key={ti} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Document Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intern *</Label>
              <select value={form.internId} onChange={e => setForm(f => ({ ...f, internId: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select intern…</option>
                {(interns ?? []).map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Document Name *</Label>
                <Input placeholder="e.g. Work Plan Q1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Type</Label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">URL / Link *</Label>
              <Input placeholder="https://drive.google.com/…" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Uploaded By</Label>
              <Input placeholder="Name of uploader" value={form.uploadedBy} onChange={e => setForm(f => ({ ...f, uploadedBy: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.internId || !form.name || !form.url}
              className="bg-blue-600 hover:bg-blue-700 text-white">{saving ? "Saving…" : "Add Document"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
