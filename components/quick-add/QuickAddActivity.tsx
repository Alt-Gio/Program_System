"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Save, ArrowRight } from "lucide-react";

const LS_KEY = "quickAdd:lastProgram";
const LS_VENUE = "quickAdd:lastVenue";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuickAddActivity({ open, onOpenChange }: Props) {
  const projects = useQuery(api.projects.list, { isActive: true });
  const provinces = useQuery(api.provinces.list, {});
  // Optimistic: immediately insert the new row into cached listActivities
  // queries so the activities table updates before the server responds.
  const createActivity = useMutation(
    api.activities.createActivity,
  ).withOptimisticUpdate((localStore, args) => {
    const variants: Array<Record<string, unknown>> = [
      {},
      { year: args.year },
      { year: args.year, month: args.month },
      { projectId: args.projectId, year: args.year },
      { projectId: args.projectId },
    ];
    for (const v of variants) {
      const current = localStore.getQuery(
        api.activities.listActivities,
        v as any,
      );
      if (!current) continue;
      const optimisticRow = {
        ...args,
        _id: `optimistic-${Date.now()}` as any,
        _creationTime: Date.now(),
        status: "Draft" as const,
        syncedToSheets: false,
      } as any;
      localStore.setQuery(api.activities.listActivities, v as any, [
        optimisticRow,
        ...current,
      ]);
    }
  });
  const deleteActivity = useMutation(api.activities.deleteActivity);

  const [projectId, setProjectId] = useState<string>("");
  const [provinceId, setProvinceId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState("");
  const [count, setCount] = useState("");
  const [saving, setSaving] = useState(false);

  // Restore last program / venue
  useEffect(() => {
    if (!open) return;
    const lastProject = localStorage.getItem(LS_KEY);
    const lastVenue = localStorage.getItem(LS_VENUE);
    if (lastProject && (projects ?? []).some((p) => p._id === lastProject)) {
      setProjectId(lastProject);
    } else if (projects?.length && !projectId) {
      setProjectId(projects[0]._id);
    }
    if (lastVenue && !venue) setVenue(lastVenue);
    if (provinces?.length && !provinceId) setProvinceId(provinces[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projects, provinces]);

  const resetForm = (keepProgram = true) => {
    setTitle("");
    setCount("");
    if (!keepProgram) setProjectId(projects?.[0]?._id ?? "");
    // keep date and venue — staff often add a run of same-day / same-venue items
  };

  const handleSave = async (closeAfter: boolean) => {
    if (!projectId) return toast.error("Pick a program.");
    if (!provinceId) return toast.error("No provinces loaded.");
    if (!title.trim()) return toast.error("Activity title is required.");
    if (!date) return toast.error("Date is required.");

    setSaving(true);
    try {
      const d = new Date(date);
      const total = parseInt(count || "0", 10) || 0;
      const male = Math.floor(total / 2);
      const female = total - male;

      const newId = await createActivity({
        projectId: projectId as any,
        provinceId: provinceId as any,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        activityTitle: title.trim(),
        venue: venue.trim() || "TBD",
        partnerOrganizations: [],
        startDate: date,
        endDate: date,
        modeOfConduct: "Onsite",
        personnelIds: [],
        participants: {
          nga: { male, female },
          lgu: { male: 0, female: 0 },
          suc: { male: 0, female: 0 },
          others: { male: 0, female: 0 },
        },
        createdBy: "quick-add",
      });

      localStorage.setItem(LS_KEY, projectId);
      if (venue.trim()) localStorage.setItem(LS_VENUE, venue.trim());

      const savedTitle = title.trim();
      toast.success(`Added "${savedTitle}"`, {
        description: "You have 10 seconds to undo.",
        duration: 10000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteActivity({ id: newId as any });
              toast.success(`Undone — "${savedTitle}" removed`);
            } catch (e: any) {
              toast.error(`Undo failed: ${e?.message ?? e}`);
            }
          },
        },
      });
      if (closeAfter) onOpenChange(false);
      else resetForm(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Quick Add Activity
          </DialogTitle>
          <DialogDescription>
            5 fields. One modal. Press{" "}
            <kbd className="rounded bg-gray-100 px-1 text-[10px] font-mono">
              Ctrl+Shift+A
            </kbd>{" "}
            anywhere to reopen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Program">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm outline-none focus:ring-1 focus:ring-blue-300"
            >
              {(projects ?? []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.shortName} — {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Title" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Digital Literacy Training"
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-300"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" required>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-300"
              />
            </Field>
            <Field label="People">
              <input
                type="number"
                min={0}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="0"
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-300"
              />
            </Field>
          </div>

          <Field label="Venue">
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. DTC Legazpi"
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-300"
            />
          </Field>

          <Field label="Province">
            <select
              value={provinceId}
              onChange={(e) => setProvinceId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm outline-none focus:ring-1 focus:ring-blue-300"
            >
              {(provinces ?? []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-[11px] text-gray-500">
            Saved as <strong>Draft</strong>. Edit details in the project page.
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving}
              onClick={() => handleSave(false)}
            >
              <Save className="h-3.5 w-3.5" /> Save & Add Another
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={saving}
              onClick={() => handleSave(true)}
            >
              Save & Close <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
