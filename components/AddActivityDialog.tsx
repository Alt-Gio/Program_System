"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExtraFieldDef, ProjectDefinition } from "@/lib/types";
import {
  MapPin, CalendarDays, Users, Building2, FileText, Link2,
  CheckCircle2, ChevronRight, Loader2, Sparkles, FileSpreadsheet,
  Tag, ClipboardList, Search, ImageIcon, Upload, X,
} from "lucide-react";

// ── Mapbox Venue Search ───────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function VenueSearchInput({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [query, setQuery]       = useState(value);
  const [results, setResults]   = useState<{ name: string; place: string }[]>([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback((q: string) => {
    if (!q.trim() || q.length < 3) { setResults([]); return; }
    if (!MAPBOX_TOKEN) return;
    setLoading(true);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=PH&limit=6&proximity=123.75,13.4`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        const feats = (d.features ?? []) as any[];
        setResults(feats.map((f: any) => ({
          name:  f.text ?? f.place_name,
          place: f.place_name,
        })));
        setOpen(feats.length > 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (MAPBOX_TOKEN) debounceRef.current = setTimeout(() => search(v), 350);
  }

  function pick(place: string) {
    setQuery(place); onChange(place); setResults([]); setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={MAPBOX_TOKEN ? "Search for a venue or place…" : "Enter venue or location name"}
          className="h-9 text-sm pr-8"
        />
        {loading
          ? <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-gray-400" />
          : MAPBOX_TOKEN
            ? <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-300" />
            : null}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((r, i) => (
            <button key={i} type="button" onMouseDown={() => pick(r.place)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start gap-2 border-b border-gray-100 last:border-0">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
              <div>
                <p className="text-sm font-medium text-gray-800 leading-tight">{r.name}</p>
                <p className="text-[11px] text-gray-400 leading-tight">{r.place}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helper: render a single extra-field input ─────────────────
function ExtraFieldInput({
  field, value, onChange, color,
}: {
  field: ExtraFieldDef;
  value: string | number;
  onChange: (v: string | number) => void;
  color: string;
}) {
  if (field.type === "select") {
    return (
      <Select value={String(value ?? "")} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        value={String(value ?? "")}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder ?? field.label}
        rows={3}
        className="text-sm resize-none"
      />
    );
  }
  return (
    <Input
      type={
        field.type === "number" ? "number" :
        field.type === "date"   ? "date"   :
        field.type === "url"    ? "url"    : "text"
      }
      value={String(value ?? "")}
      onChange={e => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
      placeholder={field.placeholder ?? field.label}
      className="h-9 text-sm"
    />
  );
}

// ── Participant row ────────────────────────────────────────────
function ParticipantRow({
  label, male, female, onMale, onFemale, color,
}: {
  label: string; male: number; female: number;
  onMale: (v: number) => void; onFemale: (v: number) => void;
  color: string;
}) {
  const total = male + female;
  return (
    <div className="grid grid-cols-[1fr_80px_80px_56px] gap-2 items-center">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <Input
        type="number" min={0} value={male || ""}
        onChange={e => onMale(Math.max(0, Number(e.target.value)))}
        placeholder="M" className="h-8 text-center text-sm"
      />
      <Input
        type="number" min={0} value={female || ""}
        onChange={e => onFemale(Math.max(0, Number(e.target.value)))}
        placeholder="F" className="h-8 text-center text-sm"
      />
      <div className="text-sm font-bold text-center" style={{ color: total > 0 ? color : "#9ca3af" }}>
        {total}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ── Main Dialog ────────────────────────────────────────────────
interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectDef: ProjectDefinition;
  projectId: string;
  onSuccess?: (activityId: string) => void;
}

export function AddActivityDialog({
  open, onOpenChange, projectDef, projectId, onSuccess,
}: AddActivityDialogProps) {
  const provinces        = useQuery(api.provinces.list, {});
  const sheetConn        = useQuery(api.sheetsSync.getConnection, { projectId: projectId as any });
  const createActivity   = useMutation(api.activities.createActivity);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [tab, setTab]     = useState("basic");
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [provinceId,   setProvinceId]   = useState("");
  const [lguId,        setLguId]        = useState("");
  const [barangay,     setBarangay]     = useState("");
  const [title,        setTitle]        = useState("");
  const [venue,        setVenue]        = useState("");
  const [partners,     setPartners]     = useState("");
  const [startDate,    setStartDate]    = useState("");
  const [endDate,      setEndDate]      = useState("");
  const [mode,         setMode]         = useState(projectDef.modeOptions[0] ?? "On-Site");
  const [personnelRaw, setPersonnelRaw] = useState("");
  const [month,        setMonth]        = useState(new Date().getMonth() + 1);
  const [year,         setYear]         = useState(new Date().getFullYear());

  // Image upload
  const fileInputRef                         = useRef<HTMLInputElement>(null);
  const [uploadedStorageId, setUploadedStorageId] = useState<string | null>(null);
  const [imageUploading,    setImageUploading]    = useState(false);
  const uploadedImageUrl = useQuery(
    api.files.getUrl,
    uploadedStorageId ? { storageId: uploadedStorageId } : "skip",
  ) as string | null | undefined;

  // Participants
  const [pax, setPax] = useState({
    nga:    { male: 0, female: 0 },
    lgu:    { male: 0, female: 0 },
    suc:    { male: 0, female: 0 },
    others: { male: 0, female: 0, label: "Others" },
  });

  // Project-specific extra fields
  const [extra, setExtra] = useState<Record<string, string | number>>({});

  // Documentation links
  const [afterReport, setAfterReport] = useState("");
  const [fbLink,      setFbLink]      = useState("");
  const [photosLink,  setPhotosLink]  = useState("");
  const [testimLink,  setTestimLink]  = useState("");
  const [remarks,     setRemarks]     = useState("");

  // LGU list filtered by province
  const lguList = useQuery(
    api.provinces.lgusByProvince,
    provinceId ? { provinceId: provinceId as any } : "skip",
  );

  // Auto-update month/year from startDate
  useEffect(() => {
    if (!startDate) return;
    const d = new Date(startDate);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    if (!endDate) setEndDate(startDate);
  }, [startDate]);

  // Group extra fields by their group property
  const groupedExtra: Record<string, ExtraFieldDef[]> = {};
  for (const f of projectDef.extraFieldSchema) {
    const g = f.group ?? "General";
    if (!groupedExtra[g]) groupedExtra[g] = [];
    groupedExtra[g].push(f);
  }

  const totalPax =
    pax.nga.male + pax.nga.female +
    pax.lgu.male + pax.lgu.female +
    pax.suc.male + pax.suc.female +
    pax.others.male + pax.others.female;

  // Selected province name for sheet sync
  const selectedProvince = provinces?.find(p => p._id === provinceId);
  const selectedLgu      = lguList?.find(l => l._id === lguId);

  function reset() {
    setTab("basic");
    setProvinceId(""); setLguId(""); setBarangay(""); setTitle(""); setVenue(""); setPartners("");
    setStartDate(""); setEndDate(""); setMode(projectDef.modeOptions[0] ?? "On-Site");
    setPersonnelRaw(""); setMonth(new Date().getMonth() + 1); setYear(new Date().getFullYear());
    setPax({ nga: {male:0,female:0}, lgu: {male:0,female:0}, suc: {male:0,female:0}, others: {male:0,female:0,label:"Others"} });
    setExtra({});
    setAfterReport(""); setFbLink(""); setPhotosLink(""); setTestimLink(""); setRemarks("");
    setUploadedStorageId(null);
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB."); return; }
    setImageUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await resp.json();
      setUploadedStorageId(storageId);
      toast.success("Image uploaded!");
    } catch (e) {
      toast.error("Image upload failed: " + String(e));
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSubmit() {
    if (!provinceId) { toast.error("Please select a province."); setTab("basic"); return; }
    if (!title.trim()) { toast.error("Activity title is required."); setTab("basic"); return; }
    if (!startDate) { toast.error("Start date is required."); setTab("basic"); return; }
    if (!venue.trim()) { toast.error("Venue is required."); setTab("basic"); return; }

    // Validate required extra fields
    for (const f of projectDef.extraFieldSchema) {
      if (f.required && !extra[f.key]) {
        toast.error(`"${f.label}" is required.`);
        setTab("project");
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Save to Convex
      const imageUrl = uploadedImageUrl ?? undefined;
      const activityId = await createActivity({
        projectId: projectId as any,
        provinceId: provinceId as any,
        lguId: (lguId && lguId !== "none") ? (lguId as any) : undefined,
        barangay: barangay.trim() || undefined,
        month,
        year,
        activityTitle: title.trim(),
        venue: venue.trim(),
        partnerOrganizations: partners.split(",").map(s => s.trim()).filter(Boolean),
        startDate,
        endDate: endDate || startDate,
        modeOfConduct: mode,
        personnelIds: [],
        personnelRaw: personnelRaw || undefined,
        participants: pax,
        images: imageUrl ? [{ url: imageUrl, uploadedAt: Date.now() }] : undefined,
        afterActivityReport: afterReport || undefined,
        fbPostingLink: fbLink || undefined,
        rawPhotosLink: photosLink || uploadedImageUrl || undefined,
        testimonialsLink: testimLink || undefined,
        remarks: remarks || undefined,
        extraFields: Object.keys(extra).length > 0 ? JSON.stringify(extra) : undefined,
        createdBy: (() => {
          try { return JSON.parse(localStorage.getItem("user") || "{}").email ?? "system"; }
          catch { return "system"; }
        })(),
      });

      toast.success("Activity saved to database!");

      // 2. Sync to Google Sheet if connected
      if (sheetConn?.sheetId && sheetConn?.syncEnabled) {
        try {
          const res = await fetch("/api/activity-to-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectCode: projectDef.code,
              sheetId: sheetConn.sheetId,
              sheetName: sheetConn.sheetName,
              activity: {
                month,
                year,
                provinceName: selectedProvince?.name ?? "",
                lguName: selectedLgu?.name ?? "",
                barangay: barangay.trim() || undefined,
                activityTitle: title.trim(),
                venue: venue.trim(),
                partnerOrganizations: partners.split(",").map(s => s.trim()).filter(Boolean),
                startDate,
                endDate: endDate || startDate,
                modeOfConduct: mode,
                personnelRaw: personnelRaw || undefined,
                status: "Draft",
                remarks: remarks || undefined,
                afterActivityReport: afterReport || undefined,
                fbPostingLink: fbLink || undefined,
                rawPhotosLink: photosLink || undefined,
                imageUrl: uploadedImageUrl ?? undefined,
                testimonialsLink: testimLink || undefined,
                extraFields: extra,
                participants: pax,
              },
            }),
          });

          if (res.ok) {
            toast.success(`Row appended to Google Sheet: "${sheetConn.sheetName}"`, {
              icon: "📊",
            });
          } else {
            const err = await res.json();
            const detail = err.details ? ` — ${err.details}` : "";
            toast.warning(`Sheet sync failed: ${err.error}${detail}`, {
              duration: 8000,
            });
          }
        } catch (sheetErr) {
          toast.warning("Saved to DB, but could not reach sheet sync API.");
          console.error("[sheet-sync]", sheetErr);
        }
      }

      onSuccess?.(activityId);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save activity: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  const hasProjectFields = projectDef.extraFieldSchema.length > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!saving) { if (!v) reset(); onOpenChange(v); } }}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0"
          style={{ background: `linear-gradient(135deg, ${projectDef.color}08, transparent)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${projectDef.color}15`, border: `1.5px solid ${projectDef.color}30` }}>
              <Sparkles className="w-5 h-5" style={{ color: projectDef.color }} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold leading-tight">
                Add Activity — {projectDef.shortName}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {projectDef.name} · {projectDef.division}
              </DialogDescription>
            </div>
            {sheetConn?.syncEnabled && (
              <Badge variant="outline" className="ml-auto text-xs gap-1 shrink-0"
                style={{ color: projectDef.color, borderColor: `${projectDef.color}40` }}>
                <FileSpreadsheet className="w-3 h-3" />
                Sheet sync ON
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* ── Tabs ── */}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className={`shrink-0 mx-6 mt-4 grid ${hasProjectFields ? "grid-cols-4" : "grid-cols-3"} h-8 text-xs`}>
            <TabsTrigger value="basic"    className="text-xs gap-1"><MapPin className="w-3 h-3" />Basic</TabsTrigger>
            <TabsTrigger value="pax"      className="text-xs gap-1"><Users className="w-3 h-3" />Participants</TabsTrigger>
            {hasProjectFields && (
              <TabsTrigger value="project"  className="text-xs gap-1"><Tag className="w-3 h-3" />Program</TabsTrigger>
            )}
            <TabsTrigger value="docs"     className="text-xs gap-1 col-span-1"><Link2 className="w-3 h-3" />Links</TabsTrigger>
          </TabsList>

          {/* scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">

            {/* ── TAB: Basic Info ── */}
            <TabsContent value="basic" className="mt-0 space-y-5">
              <SectionHeader icon={ClipboardList} label="Activity Details" color={projectDef.color} />
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Activity Title <span className="text-red-500">*</span>
                  </Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Enter a descriptive activity title…"
                    className="h-9 text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Province <span className="text-red-500">*</span>
                    </Label>
                    <Select value={provinceId} onValueChange={v => { setProvinceId(v); setLguId(""); }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces?.map(p => (
                          <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">LGU / Municipality</Label>
                    <Select value={lguId} onValueChange={setLguId} disabled={!provinceId}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={provinceId ? "Select LGU" : "Select province first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {lguList?.map(l => (
                          <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">Barangay</Label>
                    <Input value={barangay} onChange={e => setBarangay(e.target.value)}
                      placeholder="e.g. Brgy. San Roque"
                      className="h-9 text-sm" />
                  </div>
                  <div />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Venue <span className="text-red-500">*</span>
                  </Label>
                  <VenueSearchInput value={venue} onChange={setVenue} color={projectDef.color} />
                  {!MAPBOX_TOKEN && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to .env for place search autocomplete.
                    </p>
                  )}
                </div>
              </div>

              <SectionHeader icon={CalendarDays} label="Schedule & Mode" color={projectDef.color} />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Start Date <span className="text-red-500">*</span>
                    </Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">End Date</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      min={startDate} className="h-9 text-sm" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">Mode of Conduct</Label>
                  <div className="flex flex-wrap gap-2">
                    {projectDef.modeOptions.map(m => (
                      <button key={m} type="button"
                        onClick={() => setMode(m)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                          mode === m
                            ? "border-transparent text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                        style={mode === m ? { backgroundColor: projectDef.color } : undefined}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <SectionHeader icon={Building2} label="Partners & Personnel" color={projectDef.color} />
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">Partner Organizations</Label>
                  <Input value={partners} onChange={e => setPartners(e.target.value)}
                    placeholder="LGU of Legazpi, DepEd… (comma-separated)"
                    className="h-9 text-sm" />
                  <p className="text-[10px] text-gray-400 mt-1">Separate multiple partners with commas</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">DICT Personnel Involved</Label>
                  <Input value={personnelRaw} onChange={e => setPersonnelRaw(e.target.value)}
                    placeholder="Names of DICT staff involved…"
                    className="h-9 text-sm" />
                </div>
              </div>
            </TabsContent>

            {/* ── TAB: Participants ── */}
            <TabsContent value="pax" className="mt-0 space-y-4">
              <SectionHeader icon={Users} label="Participant Breakdown" color={projectDef.color} />

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_80px_56px] gap-2 mb-1">
                <div />
                <div className="text-[10px] font-bold text-center text-gray-500 uppercase">Male</div>
                <div className="text-[10px] font-bold text-center text-gray-500 uppercase">Female</div>
                <div className="text-[10px] font-bold text-center text-gray-500 uppercase">Total</div>
              </div>

              <div className="space-y-2">
                <ParticipantRow
                  label="NGA" color={projectDef.color}
                  male={pax.nga.male} female={pax.nga.female}
                  onMale={v => setPax(p => ({ ...p, nga: { ...p.nga, male: v } }))}
                  onFemale={v => setPax(p => ({ ...p, nga: { ...p.nga, female: v } }))}
                />
                <ParticipantRow
                  label="LGU" color={projectDef.color}
                  male={pax.lgu.male} female={pax.lgu.female}
                  onMale={v => setPax(p => ({ ...p, lgu: { ...p.lgu, male: v } }))}
                  onFemale={v => setPax(p => ({ ...p, lgu: { ...p.lgu, female: v } }))}
                />
                <ParticipantRow
                  label="SUC" color={projectDef.color}
                  male={pax.suc.male} female={pax.suc.female}
                  onMale={v => setPax(p => ({ ...p, suc: { ...p.suc, male: v } }))}
                  onFemale={v => setPax(p => ({ ...p, suc: { ...p.suc, female: v } }))}
                />
                {/* Others row with label */}
                <div className="grid grid-cols-[1fr_80px_80px_56px] gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-400" />
                    <Input
                      value={pax.others.label ?? "Others"}
                      onChange={e => setPax(p => ({ ...p, others: { ...p.others, label: e.target.value } }))}
                      className="h-7 text-xs border-dashed"
                      placeholder="Others (label)"
                    />
                  </div>
                  <Input type="number" min={0} value={pax.others.male || ""}
                    onChange={e => setPax(p => ({ ...p, others: { ...p.others, male: Math.max(0, Number(e.target.value)) } }))}
                    placeholder="M" className="h-8 text-center text-sm" />
                  <Input type="number" min={0} value={pax.others.female || ""}
                    onChange={e => setPax(p => ({ ...p, others: { ...p.others, female: Math.max(0, Number(e.target.value)) } }))}
                    placeholder="F" className="h-8 text-center text-sm" />
                  <div className="text-sm font-bold text-center text-gray-400">
                    {pax.others.male + pax.others.female}
                  </div>
                </div>
              </div>

              {/* Grand total */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm font-semibold text-gray-700">Grand Total</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">
                    M: <strong>{pax.nga.male+pax.lgu.male+pax.suc.male+pax.others.male}</strong>
                  </span>
                  <span className="text-gray-500">
                    F: <strong>{pax.nga.female+pax.lgu.female+pax.suc.female+pax.others.female}</strong>
                  </span>
                  <div className="px-3 py-1 rounded-lg text-white font-bold text-sm"
                    style={{ backgroundColor: totalPax > 0 ? projectDef.color : "#d1d5db" }}>
                    {totalPax} pax
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── TAB: Project-Specific Fields ── */}
            {hasProjectFields && (
              <TabsContent value="project" className="mt-0 space-y-5">
                {Object.entries(groupedExtra).map(([groupName, fields]) => (
                  <div key={groupName}>
                    <SectionHeader icon={Tag} label={groupName} color={projectDef.color} />
                    <div className="space-y-3">
                      {fields.map(field => (
                        <div key={field.key}>
                          <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                          </Label>
                          <ExtraFieldInput
                            field={field}
                            value={extra[field.key] ?? ""}
                            onChange={v => setExtra(prev => ({ ...prev, [field.key]: v }))}
                            color={projectDef.color}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>
            )}

            {/* ── TAB: Documentation & Links ── */}
            <TabsContent value="docs" className="mt-0 space-y-4">
              {/* Image Upload */}
              <SectionHeader icon={ImageIcon} label="Activity Photo" color={projectDef.color} />
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                />
                {uploadedImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedImageUrl} alt="Activity" className="w-full max-h-40 object-cover" />
                    <button type="button" onClick={() => setUploadedStorageId(null)}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="px-3 py-2 text-[11px] text-gray-500">
                      Image saved — will appear inline in the Google Sheet.
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors disabled:opacity-50">
                    {imageUploading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Upload className="w-5 h-5" />}
                    <span className="text-xs font-medium">
                      {imageUploading ? "Uploading…" : "Click to upload activity photo"}
                    </span>
                    <span className="text-[10px]">PNG, JPG, WEBP · max 10 MB</span>
                  </button>
                )}
              </div>

              <SectionHeader icon={Link2} label="Documentation Links" color={projectDef.color} />
              <div className="space-y-3">
                {[
                  { label: "After-Activity Report URL",    val: afterReport, set: setAfterReport, placeholder: "Drive link to report…" },
                  { label: "FB Posting Link",              val: fbLink,      set: setFbLink,      placeholder: "Facebook post URL…" },
                  { label: "Raw Photos / Drive Link",      val: photosLink,  set: setPhotosLink,  placeholder: "Drive folder with photos…" },
                  { label: "Testimonials Link",            val: testimLink,  set: setTestimLink,  placeholder: "Drive link to testimonials…" },
                ].map(({ label, val, set, placeholder }) => (
                  <div key={label}>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</Label>
                    <Input value={val} onChange={e => set(e.target.value)}
                      type="url" placeholder={placeholder} className="h-9 text-sm" />
                  </div>
                ))}
              </div>

              <SectionHeader icon={FileText} label="Remarks" color={projectDef.color} />
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Additional notes, observations, or follow-ups…"
                rows={4} className="text-sm resize-none" />
            </TabsContent>
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 px-6 py-4 border-t bg-gray-50/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {totalPax > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: projectDef.color }}>
                  {totalPax} participants
                </span>
              )}
              {sheetConn?.syncEnabled ? (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Will sync to Google Sheet
                </span>
              ) : (
                <span className="text-xs text-gray-400">No sheet connected</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              {/* Navigate between tabs */}
              {tab !== "docs" && (
                <Button variant="outline" size="sm"
                  onClick={() => {
                    const order = hasProjectFields
                      ? ["basic","pax","project","docs"]
                      : ["basic","pax","docs"];
                    const idx = order.indexOf(tab);
                    if (idx < order.length - 1) setTab(order[idx + 1]);
                  }}>
                  Next <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
              <Button size="sm" onClick={handleSubmit} disabled={saving}
                style={{ backgroundColor: projectDef.color }}>
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
                ) : (
                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Activity</>
                )}
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
