"use client";

import Link from "next/link";
import { Upload, History, Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProjectSheetConnection } from "./ProjectSheetConnection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string; // "EGOV"
  projectRoute: string; // "egov"
  shortName: string; // "eGovPH"
  color: string;
};

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  projectCode,
  projectRoute,
  shortName,
  color,
}: Props) {
  // shortName matches PROGRAM_META keys in lib/import/programSchemas.ts
  const importLogHref = `/import-log?program=${encodeURIComponent(shortName)}`;
  const changesHref = `/projects/${projectRoute}/changes`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            {shortName} · Project Settings
          </DialogTitle>
          <DialogDescription>
            Connect or update the Google Sheet for this program. Use the quick
            links below to import data or view the change history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Quick links */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={importLogHref}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  Import data
                </div>
                <div className="text-xs text-gray-500">
                  Paste, upload CSV/XLSX, or pull the sheet.
                </div>
              </div>
            </Link>

            <Link
              href={changesHref}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-violet-300 hover:bg-violet-50/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <History className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  View changes
                </div>
                <div className="text-xs text-gray-500">
                  Every insert, update, sync, and import.
                </div>
              </div>
            </Link>
          </div>

          {/* Sheet connection */}
          <div>
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Google Sheet Connection
              </div>
              <div className="text-xs text-gray-500">
                Link the spreadsheet that syncs into this program's data.
              </div>
            </div>
            <ProjectSheetConnection
              projectCode={projectCode}
              shortName={shortName}
              color={color}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
