"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
import { ArrowRight, Loader2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ValidatedRow } from "@/lib/import/validateAndDedup";

type Bucket = "nga" | "lgu" | "suc" | "others";

// shortName (PROGRAM_META key) → project code in the Convex `projects` table
const SHORT_TO_CODE: Record<string, string> = {
  eGovPH: "EGOV",
  eLGU: "ELGU",
  "Free WiFi": "WIFI",
  GovNet: "GOVNET",
  NBP: "NBP",
  Cybersecurity: "CYBER",
  PNPKI: "PNPKI",
  DRRM: "DRRM",
  ILCDB: "ILCDB",
  IIDB: "IIDB",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: Id<"import_sessions"> | null;
  program: string;
  rows: ValidatedRow[];
  importedBy: string;
  onSuccess?: (result: {
    inserted: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
  }) => void;
};

export function MapToProductionDialog({
  open,
  onOpenChange,
  sessionId,
  program,
  rows,
  importedBy,
  onSuccess,
}: Props) {
  const [bucket, setBucket] = useState<Bucket>("nga");
  const [othersLabel, setOthersLabel] = useState("Partner");
  const [submitting, setSubmitting] = useState(false);
  const confirm = useMutation(api.import_log.confirmImportToActivities);

  const projectCode = SHORT_TO_CODE[program];
  const importable = rows.filter((r) => r.status !== "invalid");

  const handleConfirm = async () => {
    if (!sessionId) return;
    if (!projectCode) {
      toast.error(`No project code mapping for "${program}".`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await confirm({
        sessionId,
        projectCode,
        rows: importable.map((r) => ({
          activityTitle: r.data.activityTitle ?? "",
          date: r.data.date,
          startDate: r.data.startDate ?? r.data.date,
          endDate: r.data.endDate,
          venue: r.data.venue,
          province: r.data.province,
          municipality: r.data.municipality ?? r.data.lguName,
          participants: r.data.participants,
          male: r.data.male,
          female: r.data.female,
          remarks: r.data.remarks,
        })),
        bucket,
        othersLabel: bucket === "others" ? othersLabel : undefined,
        createdBy: importedBy,
      });

      toast.success(
        `Promoted ${result.inserted} row${result.inserted === 1 ? "" : "s"} to ${program}${
          result.skipped > 0 ? ` (${result.skipped} skipped)` : ""
        }`,
      );
      onSuccess?.(result);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to promote rows");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Map to Production Fields
          </DialogTitle>
          <DialogDescription>
            {importable.length} row{importable.length === 1 ? "" : "s"} ready to
            import into <strong>{program}</strong> activities. Pick which
            participant bucket the totals belong to — you can adjust per-row
            later in the activities page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!projectCode && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              No project code mapping for <strong>{program}</strong>. Cancel and
              promote via the settings page instead.
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <div className="mb-2 font-semibold text-gray-800">
              Participant breakdown
            </div>
            <div className="space-y-2">
              <RadioRow
                checked={bucket === "nga"}
                onChange={() => setBucket("nga")}
                title="NGA (national government agency)"
                subtitle="Default for eGovPH, Cybersecurity, PNPKI trainings."
              />
              <RadioRow
                checked={bucket === "lgu"}
                onChange={() => setBucket("lgu")}
                title="LGU (local government unit)"
                subtitle="Use for eLGU, DRRM trainings where participants are LGU staff."
              />
              <RadioRow
                checked={bucket === "suc"}
                onChange={() => setBucket("suc")}
                title="SUC (state university / college)"
                subtitle="Use when participants come from SUCs."
              />
              <RadioRow
                checked={bucket === "others"}
                onChange={() => setBucket("others")}
                title="Others (partner / private sector)"
                subtitle="Use for industry-partner IIDB sessions, etc."
              />
              {bucket === "others" && (
                <div className="pl-6">
                  <label className="text-[11px] font-medium text-gray-600">
                    Label for "others"
                  </label>
                  <input
                    value={othersLabel}
                    onChange={(e) => setOthersLabel(e.target.value)}
                    className="mt-1 h-7 w-full rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-blue-300"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-3 text-[11px] text-gray-500">
            <div className="mb-1 font-medium text-gray-700">
              How the mapping works
            </div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Province is fuzzy-matched to the <em>provinces</em> table by
                name.
              </li>
              <li>
                <code>male</code> + <code>female</code> are preferred. If only a
                total <code>participants</code> is provided, it's split 50/50.
              </li>
              <li>
                Missing or unparseable dates fall back to today's month/year;
                the row is still inserted as a Draft.
              </li>
              <li>
                Rows that fail (no province match, empty title) are reported as
                skipped — none of the successful rows are rolled back.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleConfirm}
            disabled={submitting || !projectCode || importable.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing…
              </>
            ) : (
              <>
                Confirm Import → Production <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RadioRow({
  checked,
  onChange,
  title,
  subtitle,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs transition ${
        checked
          ? "border-blue-300 bg-blue-50"
          : "border-transparent hover:bg-white"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-3.5 w-3.5 accent-blue-600"
      />
      <div>
        <div className="font-medium text-gray-800">{title}</div>
        <div className="text-[10px] text-gray-500">{subtitle}</div>
      </div>
    </label>
  );
}
