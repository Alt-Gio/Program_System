"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Clock,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mic,
} from "lucide-react";
import { relativeTime } from "@/lib/relativeTime";

// Compact strip for the dashboard — pending imports + recent sync activity.
export function DashboardActivityStrip() {
  const syncLogs = useQuery(api.sheetsSync.getSyncLog, { limit: 20 });
  const importSessions = useQuery(api.import_log.getImportSessions, {
    limit: 50,
  });
  const activityLogs = useQuery(api.import_log.getActivityLog, { limit: 20 });

  const pendingImports = useMemo(
    () =>
      (importSessions ?? []).filter(
        (s: { status: string }) =>
          s.status === "pending" || s.status === "validated",
      ).length,
    [importSessions],
  );

  type Row =
    | {
        kind: "sync";
        id: string;
        label: string;
        subtitle: string;
        timestamp: number;
        status: "success" | "partial" | "error";
      }
    | {
        kind: "log";
        id: string;
        label: string;
        subtitle: string;
        timestamp: number;
        isVoice: boolean;
      };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const s of syncLogs ?? []) {
      out.push({
        kind: "sync",
        id: `s-${s._id}`,
        label: `${s.projectName} synced ${s.rowsAffected} rows`,
        subtitle: `tab ${s.sheetName}${s.errorMessage ? " · " + s.errorMessage.slice(0, 40) : ""}`,
        timestamp: s.syncedAt,
        status:
          s.status === "success"
            ? "success"
            : s.status === "partial"
              ? "partial"
              : "error",
      });
    }
    for (const l of (activityLogs ?? []) as any[]) {
      out.push({
        kind: "log",
        id: `l-${l._id}`,
        label: l.summary,
        subtitle: l.performedBy ? `by ${l.performedBy}` : "",
        timestamp: l.timestamp,
        isVoice: Boolean(l.isVoiceInitiated),
      });
    }
    return out.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [syncLogs, activityLogs]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
      {/* Pending Imports quick card */}
      <Link
        href="/import-log"
        className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Upload className="h-3 w-3" /> Pending imports
            </div>
            <div className="mt-1 text-3xl font-bold text-gray-900">
              {importSessions === undefined ? "—" : pendingImports}
            </div>
            <div className="text-xs text-gray-500">awaiting confirmation</div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-80 transition group-hover:opacity-100">
          Open import log <ArrowRight className="h-3 w-3" />
        </div>
      </Link>

      {/* Recent sync activity */}
      <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Recent sync activity
            </div>
            <div className="text-sm text-gray-500">
              Last imports, syncs, and voice actions
            </div>
          </div>
          <Link
            href="/import-log"
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View all →
          </Link>
        </div>

        {syncLogs === undefined || activityLogs === undefined ? (
          <div className="flex-1 animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-gray-50" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <div className="text-2xl">📋</div>
            <div className="mt-1 text-xs text-gray-500">
              No activity yet. Connect a sheet or import a file to get started.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 py-2">
                <RowIcon row={r} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-gray-900">
                    {r.label}
                  </div>
                  {r.subtitle && (
                    <div className="truncate text-[11px] text-gray-500">
                      {r.subtitle}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-gray-400">
                  {relativeTime(r.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RowIcon({
  row,
}: {
  row:
    | { kind: "sync"; status: "success" | "partial" | "error" }
    | { kind: "log"; isVoice: boolean };
}) {
  if (row.kind === "sync") {
    const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
    if (row.status === "success")
      return (
        <div className={`${base} bg-emerald-50 text-emerald-600`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
      );
    if (row.status === "partial")
      return (
        <div className={`${base} bg-amber-50 text-amber-600`}>
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
      );
    return (
      <div className={`${base} bg-red-50 text-red-600`}>
        <XCircle className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        row.isVoice ? "bg-indigo-50 text-indigo-600" : "bg-blue-50 text-blue-600"
      }`}
    >
      {row.isVoice ? (
        <Mic className="h-3.5 w-3.5" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
    </div>
  );
}
