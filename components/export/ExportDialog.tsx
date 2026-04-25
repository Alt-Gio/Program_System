"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, FileDown, Loader2 } from "lucide-react";

export type ExportScope = {
  label: string; // "eGovPH activities" / "All activities"
  projectCode?: string; // "EGOV" — omit for all programs
};

type Format = "csv" | "sheets" | "pdf";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ExportScope;
  defaultYear?: number;
};

export function ExportDialog({ open, onOpenChange, scope, defaultYear }: Props) {
  const [format, setFormat] = useState<Format>("csv");
  const [from, setFrom] = useState(() =>
    defaultYear ? `${defaultYear}-01-01` : "",
  );
  const [to, setTo] = useState(() =>
    defaultYear ? `${defaultYear}-12-31` : "",
  );
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeBreakdown, setIncludeBreakdown] = useState(true);
  const [includeGeo, setIncludeGeo] = useState(true);
  const [includeSyncHistory, setIncludeSyncHistory] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      if (format === "pdf") {
        toast.info(
          "PDF export uses the Quarterly Accomplishment template — open Reports → Generate to use it for now.",
        );
        onOpenChange(false);
        return;
      }

      const year = from ? new Date(from).getFullYear() : defaultYear;

      if (format === "csv") {
        const params = new URLSearchParams();
        if (year) params.set("year", String(year));
        if (scope.projectCode) params.set("project", scope.projectCode);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (includeBreakdown) params.set("breakdown", "1");
        if (includeGeo) params.set("geo", "1");
        if (includeSyncHistory) params.set("sync", "1");
        const url = `/api/looker-export?${params.toString()}`;
        window.open(url, "_blank");
        toast.success("CSV download started");
        onOpenChange(false);
        return;
      }

      // format === "sheets"
      const params = new URLSearchParams();
      if (year) params.set("year", String(year));
      if (scope.projectCode) params.set("project", scope.projectCode);
      const res = await fetch(`/api/export-to-sheets?${params.toString()}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.sheetUrl) {
        toast.success(
          `Exported ${data.rowCount ?? "?"} rows to "${data.sheetName ?? "Sheet"}"`,
        );
        window.open(data.sheetUrl, "_blank");
      } else {
        toast.error(`Export failed: ${data.error ?? "unknown error"}`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export — {scope.label}</DialogTitle>
          <DialogDescription>
            Choose a format and what to include. Only filters that apply to the
            current scope are used.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Format
            </div>
            <div className="grid grid-cols-3 gap-2">
              <FormatOption
                active={format === "csv"}
                onClick={() => setFormat("csv")}
                icon={<FileDown className="h-4 w-4" />}
                label="CSV"
                sub="Excel-compatible"
              />
              <FormatOption
                active={format === "sheets"}
                onClick={() => setFormat("sheets")}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                label="Sheets"
                sub="Push to Drive"
              />
              <FormatOption
                active={format === "pdf"}
                onClick={() => setFormat("pdf")}
                icon={<FileText className="h-4 w-4" />}
                label="PDF"
                sub="Narrative"
              />
            </div>
          </div>

          {/* Date range */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Date range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm outline-none focus:ring-1 focus:ring-blue-300"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm outline-none focus:ring-1 focus:ring-blue-300"
                />
              </label>
            </div>
          </div>

          {/* Include */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Include
            </div>
            <div className="space-y-1.5">
              <Toggle
                checked={includeDetails}
                onChange={setIncludeDetails}
                label="Activity details"
              />
              <Toggle
                checked={includeBreakdown}
                onChange={setIncludeBreakdown}
                label="Participant breakdown (male/female, NGA/LGU/SUC/others)"
              />
              <Toggle
                checked={includeGeo}
                onChange={setIncludeGeo}
                label="Geographic breakdown (province / municipality)"
              />
              <Toggle
                checked={includeSyncHistory}
                onChange={setIncludeSyncHistory}
                label="Sync history (last 10 syncs)"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleExport} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…
              </>
            ) : (
              "Export Now →"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormatOption({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-xl border-[1.5px] p-3 text-left transition ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-900"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        {icon} {label}
      </div>
      <div className="text-[10px] text-gray-500">{sub}</div>
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-blue-600"
      />
      <span>{label}</span>
    </label>
  );
}
