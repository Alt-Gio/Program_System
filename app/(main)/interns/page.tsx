"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  GraduationCap, UserPlus, Users, Clock, CheckCircle2,
  Search, Award, Star, Calendar, Building2,
  ChevronRight, ChevronLeft, RefreshCw, Trash2,
  Eye, Filter, TrendingUp, AlertCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────
const SECTIONS = ["OIS","ICT4E","DRRM","eGov","NBP","GovNet","Admin","Other"];
const STATUSES_OPTIONS = ["ACTIVE","COMPLETED","ON_LEAVE","INACTIVE"];
const CIVIL_STATUS_OPTIONS = ["Single","Married","Widowed","Separated"];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Active",    cls: "bg-green-100 text-green-700 border-green-200" },
  COMPLETED: { label: "Completed", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  ON_LEAVE:  { label: "On Leave",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
  INACTIVE:  { label: "Inactive",  cls: "bg-red-100 text-red-700 border-red-200" },
};

// ── Types ────────────────────────────────────────────────────
type InternRow = NonNullable<ReturnType<typeof useQuery<typeof api.interns.list>>>[number];

// ── Step-form state ──────────────────────────────────────────
const BLANK_FORM = {
  fullName: "", school: "", course: "", email: "", phone: "",
  sex: "" as "M" | "F" | "",
  age: "", civilStatus: "", isIndigenous: false, isPWD: false, isSoloParent: false,
  requiredHours: "486", department: "", supervisor: "", officeAssignment: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
  onboardingDate: "", estimatedCompletion: "",
};

// ── Sub-components ───────────────────────────────────────────
function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number | string; color: string;
}) {
  return (
    <Card className={cn("border-0 shadow-sm", color)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function ProgressBar({ done, required }: { done: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((done / required) * 100)) : 0;
  const color = pct >= 100 ? "bg-green-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 shrink-0">{pct}%</span>
    </div>
  );
}

// ── Register Dialog ──────────────────────────────────────────
function RegisterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof BLANK_FORM, v: any) =>
    setForm(prev => ({ ...prev, [k]: v }));

  function reset() { setStep(1); setForm(BLANK_FORM); }

  async function handleSubmit() {
    if (!form.fullName.trim() || !form.school.trim() || !form.course.trim()) {
      toast.error("Full name, school, and course are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/interns/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName:         form.fullName.trim(),
          school:           form.school.trim(),
          course:           form.course.trim(),
          email:            form.email || undefined,
          phone:            form.phone || undefined,
          sex:              form.sex || undefined,
          age:              form.age ? parseInt(form.age) : undefined,
          civilStatus:      form.civilStatus || undefined,
          isIndigenous:     form.isIndigenous || undefined,
          isPWD:            form.isPWD || undefined,
          isSoloParent:     form.isSoloParent || undefined,
          requiredHours:    parseInt(form.requiredHours) || 486,
          department:       form.department || undefined,
          supervisor:       form.supervisor || undefined,
          officeAssignment: form.officeAssignment || undefined,
          startDate:        form.startDate,
          endDate:          form.endDate,
          onboardingDate:   form.onboardingDate || undefined,
          estimatedCompletion: form.estimatedCompletion || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      toast.success(`✅ ${form.fullName} registered successfully!`);
      reset();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "h-9 text-sm border-gray-200 focus:ring-1 focus:ring-violet-300";
  const labelCls = "text-xs font-semibold text-gray-600 mb-1 block";

  const STEPS = [
    { num: 1, label: "Personal Info" },
    { num: 2, label: "School & Program" },
    { num: 3, label: "Office Assignment" },
    { num: 4, label: "Demographics" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-violet-700">
            <GraduationCap className="w-5 h-5" /> Register New Intern
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1 flex-1">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                step === s.num ? "bg-violet-600 text-white" :
                step > s.num  ? "bg-green-500 text-white"  : "bg-gray-200 text-gray-500"
              )}>
                {step > s.num ? "✓" : s.num}
              </div>
              {!open ? null : (
                <span className={cn("text-[10px] truncate", step === s.num ? "text-violet-700 font-semibold" : "text-gray-400")}>
                  {s.label}
                </span>
              )}
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1 min-w-[8px]", step > s.num ? "bg-green-300" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Personal Info ── */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full Name *</label>
              <Input className={inputCls} placeholder="e.g. Juan Dela Cruz" value={form.fullName}
                onChange={e => set("fullName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Email</label>
                <Input className={inputCls} type="email" placeholder="juan@school.edu.ph" value={form.email}
                  onChange={e => set("email", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <Input className={inputCls} placeholder="09XXXXXXXXX" value={form.phone}
                  onChange={e => set("phone", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: School & Program ── */}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>School / University *</label>
              <Input className={inputCls} placeholder="e.g. Bicol University" value={form.school}
                onChange={e => set("school", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Course / Program *</label>
              <Input className={inputCls} placeholder="e.g. BS Information Technology" value={form.course}
                onChange={e => set("course", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Required OJT Hours</label>
              <Input className={inputCls} type="number" min={1} max={1000} value={form.requiredHours}
                onChange={e => set("requiredHours", e.target.value)} />
              <p className="text-[10px] text-gray-400 mt-1">Default is 486 hours</p>
            </div>
          </div>
        )}

        {/* ── Step 3: Office Assignment ── */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Department / Section</label>
                <select className="w-full h-9 text-sm border border-gray-200 rounded-md px-3 bg-white focus:ring-1 focus:ring-violet-300 outline-none"
                  value={form.department} onChange={e => set("department", e.target.value)}>
                  <option value="">Select section...</option>
                  {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Supervisor</label>
                <Input className={inputCls} placeholder="Supervisor name" value={form.supervisor}
                  onChange={e => set("supervisor", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Office Assignment</label>
              <Input className={inputCls} placeholder="e.g. DICT Region V Main Office" value={form.officeAssignment}
                onChange={e => set("officeAssignment", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start Date *</label>
                <Input className={inputCls} type="date" value={form.startDate}
                  onChange={e => set("startDate", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>End Date *</label>
                <Input className={inputCls} type="date" value={form.endDate}
                  onChange={e => set("endDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Onboarding Date</label>
                <Input className={inputCls} type="date" value={form.onboardingDate}
                  onChange={e => set("onboardingDate", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Est. Completion</label>
                <Input className={inputCls} type="date" value={form.estimatedCompletion}
                  onChange={e => set("estimatedCompletion", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Demographics (optional) ── */}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 border border-gray-100">
              All fields in this step are optional. This information is used for demographic reporting only.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Sex</label>
                <select className="w-full h-9 text-sm border border-gray-200 rounded-md px-3 bg-white outline-none focus:ring-1 focus:ring-violet-300"
                  value={form.sex} onChange={e => set("sex", e.target.value as any)}>
                  <option value="">–</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Age</label>
                <Input className={inputCls} type="number" min={15} max={60} placeholder="–" value={form.age}
                  onChange={e => set("age", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Civil Status</label>
                <select className="w-full h-9 text-sm border border-gray-200 rounded-md px-3 bg-white outline-none focus:ring-1 focus:ring-violet-300"
                  value={form.civilStatus} onChange={e => set("civilStatus", e.target.value)}>
                  <option value="">–</option>
                  {CIVIL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2 p-3 bg-violet-50 rounded-xl border border-violet-100">
              <p className="text-xs font-semibold text-violet-700 mb-2">Special Classifications</p>
              {[
                ["isIndigenous", "Indigenous People (IP)"],
                ["isPWD",        "Person with Disability (PWD)"],
                ["isSoloParent", "Solo Parent"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-violet-600"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={e => set(key as keyof typeof BLANK_FORM, e.target.checked)} />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row gap-2 mt-4">
          {step > 1 && (
            <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} disabled={saving}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700"
              onClick={() => {
                if (step === 1 && !form.fullName.trim()) { toast.error("Enter full name"); return; }
                if (step === 2 && (!form.school.trim() || !form.course.trim())) { toast.error("School and course are required"); return; }
                setStep(s => s + 1);
              }}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700"
              onClick={handleSubmit} disabled={saving}>
              {saving ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Saving…</> : "✅ Register Intern"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Intern Row ───────────────────────────────────────────────
function InternRow({ intern, onDelete }: { intern: InternRow; onDelete: (id: string) => void }) {
  const pct = intern.requiredHours > 0
    ? Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100)) : 0;

  return (
    <tr className="border-b border-gray-100 hover:bg-violet-50/40 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
            {intern.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{intern.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{intern.email ?? "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        <p className="text-xs font-medium text-gray-700 truncate max-w-[160px]">{intern.school}</p>
        <p className="text-xs text-gray-400 truncate max-w-[160px]">{intern.course}</p>
      </td>
      <td className="px-3 py-3 hidden lg:table-cell">
        <p className="text-xs text-gray-600">{intern.department ?? "—"}</p>
        <p className="text-[10px] text-gray-400">{intern.supervisor ?? ""}</p>
      </td>
      <td className="px-3 py-3">
        <div className="min-w-[100px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700">{intern.totalHours.toFixed(1)}h</span>
            <span className="text-[10px] text-gray-400">/ {intern.requiredHours}h</span>
          </div>
          <ProgressBar done={intern.totalHours} required={intern.requiredHours} />
        </div>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={intern.status} />
      </td>
      <td className="px-3 py-3 hidden xl:table-cell">
        {intern.account ? (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
              <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-700">Lv {intern.account.level}</p>
              <p className="text-[10px] text-gray-400">{intern.account.xp} XP</p>
            </div>
          </div>
        ) : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="px-3 py-3 hidden lg:table-cell">
        <p className="text-[10px] text-gray-400">
          {intern.startDate} → {intern.endDate}
        </p>
      </td>
      <td className="px-3 py-3">
        <Button size="sm" variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50"
          onClick={() => onDelete(intern.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function InternsPage() {
  const interns = useQuery(api.interns.list, {});
  const removeIntern = useMutation(api.interns.remove);

  const [search, setSearch]         = useState("");
  const [filterStatus, setFilter]   = useState("ALL");
  const [showRegister, setRegister] = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const list = interns ?? [];

  const filtered = useMemo(() => {
    return list.filter(i => {
      const matchSearch = !search ||
        i.fullName.toLowerCase().includes(search.toLowerCase()) ||
        i.school.toLowerCase().includes(search.toLowerCase()) ||
        i.course.toLowerCase().includes(search.toLowerCase()) ||
        (i.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.department ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "ALL" || i.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [list, search, filterStatus]);

  const kpis = useMemo(() => ({
    total:     list.length,
    active:    list.filter(i => i.status === "ACTIVE").length,
    completed: list.filter(i => i.status === "COMPLETED").length,
    onLeave:   list.filter(i => i.status === "ON_LEAVE").length,
    avgPct:    list.length === 0 ? 0 : Math.round(
      list.reduce((s, i) => s + (i.requiredHours > 0 ? i.totalHours / i.requiredHours : 0), 0) / list.length * 100
    ),
  }), [list]);

  async function handleDelete(id: string) {
    if (!confirm("Remove this intern and all their records? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await removeIntern({ internId: id as any });
      toast.success("Intern removed");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-violet-600" />
            Intern Tracking System
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            DICT Region V — OJT Management Registry
          </p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 gap-2 shrink-0"
          onClick={() => setRegister(true)}
        >
          <UserPlus className="w-4 h-4" />
          Register Intern
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard icon={<Users className="w-5 h-5 text-violet-600" />}
          label="Total Interns" value={kpis.total} color="bg-violet-50" />
        <KpiCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="Active" value={kpis.active} color="bg-green-50" />
        <KpiCard icon={<Award className="w-5 h-5 text-blue-600" />}
          label="Completed OJT" value={kpis.completed} color="bg-blue-50" />
        <KpiCard icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
          label="On Leave" value={kpis.onLeave} color="bg-amber-50" />
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
          label="Avg. Progress" value={`${kpis.avgPct}%`} color="bg-purple-50 hidden xl:flex" />
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search by name, school, course…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {["ALL", ...STATUSES_OPTIONS].map(s => {
            const cfg = STATUS_MAP[s];
            return (
              <button key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                  filterStatus === s
                    ? "bg-white shadow text-violet-700"
                    : "text-gray-500 hover:text-gray-700"
                )}>
                {s === "ALL" ? "All" : (cfg?.label ?? s)}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {list.length} intern{list.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden shadow-sm">
        {interns === undefined ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-gray-300 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-400">Loading interns…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">
              {list.length === 0 ? "No interns registered yet" : "No results found"}
            </p>
            {list.length === 0 && (
              <Button size="sm" className="mt-4 bg-violet-600 hover:bg-violet-700 gap-2"
                onClick={() => setRegister(true)}>
                <UserPlus className="w-4 h-4" /> Register First Intern
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Intern</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">School / Course</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Section</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours Progress</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">XP / Level</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Period</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(intern => (
                  <InternRow key={intern.id} intern={intern} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Info note ── */}
      <div className="flex items-start gap-2 p-3 bg-violet-50 rounded-xl border border-violet-100 text-xs text-violet-700">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          <strong>DTR & Attendance</strong> — Time In/Out and activity logs are synced from the Google Apps Script tracker or via the Python CV Station (face recognition attendance). Hours are automatically accumulated in real-time.
        </p>
      </div>

      {/* ── Register Dialog ── */}
      <RegisterDialog open={showRegister} onClose={() => setRegister(false)} />
    </div>
  );
}
