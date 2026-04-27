"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DICT_PROJECTS, MONTHS, STATUS_OPTIONS, ExtraFieldDef } from "@/lib/types";

function ExtraField({ field, value, onChange }: {
  field: ExtraFieldDef;
  value: string | number;
  onChange: (val: string | number) => void;
}) {
  if (field.type === "select") {
    return (
      <Select value={String(value ?? "")} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        value={String(value ?? "")}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
      />
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
      value={String(value ?? "")}
      onChange={e => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
      placeholder={field.placeholder ?? field.label}
    />
  );
}

function ParticipantRow({ sector, male, female, onMale, onFemale }: {
  sector: string; male: number; female: number;
  onMale: (v: number) => void; onFemale: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 items-center">
      <Label className="text-sm text-gray-700 font-medium">{sector}</Label>
      <div>
        <Input type="number" min={0} value={male} onChange={e => onMale(Number(e.target.value))}
          placeholder="Male" className="text-center" />
      </div>
      <div>
        <Input type="number" min={0} value={female} onChange={e => onFemale(Number(e.target.value))}
          placeholder="Female" className="text-center" />
      </div>
    </div>
  );
}

export default function NewActivityPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <NewActivityForm />
    </Suspense>
  );
}

function NewActivityForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetProject = searchParams.get("project") ?? "";

  const projects = useQuery(api.projects.list, { isActive: true });
  const provinces = useQuery(api.provinces.list, {});
  const personnel = useQuery(api.personnel.list, { isActive: true });

  const [selectedProjectCode, setSelectedProjectCode] = useState(presetProject.toUpperCase());
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [lgus, setLgus] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedLguId, setSelectedLguId] = useState("");

  const lguList = useQuery(
    api.provinces.lgusByProvince,
    selectedProvinceId ? { provinceId: selectedProvinceId as any } : "skip"
  );

  useEffect(() => { if (lguList) setLgus(lguList); }, [lguList]);

  const [form, setForm] = useState({
    activityTitle: "",
    venue: "",
    partnerOrganizations: "",
    startDate: "",
    endDate: "",
    modeOfConduct: "On-Site",
    personnelRaw: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: "Draft" as string,
    afterActivityReport: "",
    fbPostingLink: "",
    rawPhotosLink: "",
    testimonialsLink: "",
    remarks: "",
  });

  const [participants, setParticipants] = useState({
    nga: { male: 0, female: 0 },
    lgu: { male: 0, female: 0 },
    suc: { male: 0, female: 0 },
    others: { male: 0, female: 0, label: "Others" },
  });

  const [extraFields, setExtraFields] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);

  const createActivity = useMutation(api.activities.createActivity);

  const projectDef = DICT_PROJECTS.find(p => p.code === selectedProjectCode);
  const selectedProject = projects?.find(p => p.code === selectedProjectCode);

  const groupedExtraFields: Record<string, ExtraFieldDef[]> = {};
  if (projectDef) {
    for (const f of projectDef.extraFieldSchema) {
      const g = f.group ?? "Other";
      if (!groupedExtraFields[g]) groupedExtraFields[g] = [];
      groupedExtraFields[g].push(f);
    }
  }

  const totalPax =
    participants.nga.male + participants.nga.female +
    participants.lgu.male + participants.lgu.female +
    participants.suc.male + participants.suc.female +
    participants.others.male + participants.others.female;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject || !selectedProvinceId) {
      toast.error("Please select a program and province.");
      return;
    }
    setSaving(true);
    try {
      await createActivity({
        projectId: selectedProject._id,
        provinceId: selectedProvinceId as any,
        lguId: selectedLguId ? (selectedLguId as any) : undefined,
        month: form.month,
        year: form.year,
        activityTitle: form.activityTitle,
        venue: form.venue,
        partnerOrganizations: form.partnerOrganizations.split(",").map(s => s.trim()).filter(Boolean),
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        modeOfConduct: form.modeOfConduct,
        personnelIds: [],
        personnelRaw: form.personnelRaw,
        participants,
        afterActivityReport: form.afterActivityReport,
        fbPostingLink: form.fbPostingLink,
        rawPhotosLink: form.rawPhotosLink,
        testimonialsLink: form.testimonialsLink,
        remarks: form.remarks,
        extraFields: Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : undefined,
        createdBy: "system",
      });
      toast.success("Activity saved successfully!");
      router.push("/activities");
    } catch (err) {
      toast.error("Failed to save activity: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="page-content max-w-4xl mx-auto space-y-6">
      {/* Program & Location */}
      <Card>
        <CardHeader>
          <CardTitle>Program & Location</CardTitle>
          <CardDescription>Select the DICT program and geographic coverage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Program <span className="text-red-500">*</span></Label>
              <Select value={selectedProjectCode} onValueChange={v => { setSelectedProjectCode(v); setExtraFields({}); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select DICT program�" />
                </SelectTrigger>
                <SelectContent>
                  {DICT_PROJECTS.map(p => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.shortName} � {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projectDef && (
                <p className="text-xs text-gray-500 mt-1">{projectDef.description}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Province <span className="text-red-500">*</span></Label>
              <Select value={selectedProvinceId} onValueChange={v => { setSelectedProvinceId(v); setSelectedLguId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province�" />
                </SelectTrigger>
                <SelectContent>
                  {provinces?.map(p => (
                    <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>LGU / Municipality</Label>
              <Select value={selectedLguId} onValueChange={setSelectedLguId} disabled={!selectedProvinceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select LGU (optional)�" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">� None �</SelectItem>
                  {lgus.map(l => <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Details */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Activity Title <span className="text-red-500">*</span></Label>
            <Input required value={form.activityTitle}
              onChange={e => setForm(f => ({ ...f, activityTitle: e.target.value }))}
              placeholder="e.g. eGovPH Orientation for LGU Personnel" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Venue</Label>
              <Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. Legazpi City Hall, Albay" />
            </div>
            <div className="space-y-1.5">
              <Label>Mode of Conduct</Label>
              <Select value={form.modeOfConduct} onValueChange={v => setForm(f => ({ ...f, modeOfConduct: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(projectDef?.modeOptions ?? ["On-Site", "Online", "Hybrid", "Face-to-Face"]).map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date <span className="text-red-500">*</span></Label>
              <Input type="date" required value={form.startDate}
                onChange={e => {
                  const d = new Date(e.target.value);
                  setForm(f => ({ ...f, startDate: e.target.value, month: d.getMonth() + 1, year: d.getFullYear() }));
                }} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Partner Organizations</Label>
            <Input value={form.partnerOrganizations}
              onChange={e => setForm(f => ({ ...f, partnerOrganizations: e.target.value }))}
              placeholder="Comma-separated: DOST, DepEd, City Government of Legazpi�" />
          </div>
          <div className="space-y-1.5">
            <Label>DICT Personnel Involved</Label>
            <Input value={form.personnelRaw}
              onChange={e => setForm(f => ({ ...f, personnelRaw: e.target.value }))}
              placeholder="Names or IDs of DICT staff who conducted the activity" />
          </div>
        </CardContent>
      </Card>

      {/* Participant Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Participant Breakdown</CardTitle>
          <CardDescription>Total: <strong>{totalPax}</strong> participants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 items-center mb-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sector</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Male</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Female</div>
          </div>
          <ParticipantRow sector="NGA" male={participants.nga.male} female={participants.nga.female}
            onMale={v => setParticipants(p => ({ ...p, nga: { ...p.nga, male: v } }))}
            onFemale={v => setParticipants(p => ({ ...p, nga: { ...p.nga, female: v } }))} />
          <ParticipantRow sector="LGU" male={participants.lgu.male} female={participants.lgu.female}
            onMale={v => setParticipants(p => ({ ...p, lgu: { ...p.lgu, male: v } }))}
            onFemale={v => setParticipants(p => ({ ...p, lgu: { ...p.lgu, female: v } }))} />
          <ParticipantRow sector="SUC" male={participants.suc.male} female={participants.suc.female}
            onMale={v => setParticipants(p => ({ ...p, suc: { ...p.suc, male: v } }))}
            onFemale={v => setParticipants(p => ({ ...p, suc: { ...p.suc, female: v } }))} />
          <ParticipantRow sector="Others" male={participants.others.male} female={participants.others.female}
            onMale={v => setParticipants(p => ({ ...p, others: { ...p.others, male: v } }))}
            onFemale={v => setParticipants(p => ({ ...p, others: { ...p.others, female: v } }))} />
          <Separator />
          <div className="grid grid-cols-3 gap-3 items-center">
            <span className="text-sm font-semibold text-gray-800">TOTAL</span>
            <span className="text-center text-sm font-bold text-blue-600">
              {participants.nga.male + participants.lgu.male + participants.suc.male + participants.others.male}
            </span>
            <span className="text-center text-sm font-bold text-pink-500">
              {participants.nga.female + participants.lgu.female + participants.suc.female + participants.others.female}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Project-Specific Fields */}
      {projectDef && projectDef.extraFieldSchema.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{projectDef.shortName} � Program-Specific Fields</CardTitle>
            <CardDescription>Additional data required for this program</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedExtraFields).map(([group, fields]) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{group}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fields.map(field => (
                    <div key={field.key} className={cn("space-y-1.5", field.type === "textarea" && "sm:col-span-2")}>
                      <Label>{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</Label>
                      <ExtraField
                        field={field}
                        value={extraFields[field.key] ?? ""}
                        onChange={v => setExtraFields(ef => ({ ...ef, [field.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Evidence & Links */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence & Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>After Activity Report (URL)</Label>
              <Input type="url" value={form.afterActivityReport}
                onChange={e => setForm(f => ({ ...f, afterActivityReport: e.target.value }))}
                placeholder="https://docs.google.com/�" />
            </div>
            <div className="space-y-1.5">
              <Label>FB Posting Link</Label>
              <Input type="url" value={form.fbPostingLink}
                onChange={e => setForm(f => ({ ...f, fbPostingLink: e.target.value }))}
                placeholder="https://facebook.com/�" />
            </div>
            <div className="space-y-1.5">
              <Label>Raw Photos &amp; Testimonials (URL)</Label>
              <Input type="url" value={form.rawPhotosLink}
                onChange={e => setForm(f => ({ ...f, rawPhotosLink: e.target.value }))}
                placeholder="https://drive.google.com/�" />
            </div>
            <div className="space-y-1.5">
              <Label>Testimonials Link</Label>
              <Input type="url" value={form.testimonialsLink}
                onChange={e => setForm(f => ({ ...f, testimonialsLink: e.target.value }))}
                placeholder="https://drive.google.com/�" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              placeholder="Any additional notes or observations�" rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Activity"}
        </Button>
      </div>
    </form>
  );
}
