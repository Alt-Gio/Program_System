"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Download,
  History,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { DICT_PROJECTS } from "@/lib/types";
import { PROGRAM_META } from "@/lib/import/programSchemas";
import { TimelineEntry, type ActivityLogEntry } from "@/components/import-log/TimelineEntry";

export default function ProjectChangesPage() {
  const { code } = useParams<{ code: string }>();
  const projectCode = code.toUpperCase();
  const projectDef = DICT_PROJECTS.find((p) => p.code === projectCode);
  const shortName = projectDef?.shortName;

  const project = useQuery(api.projects.getByCode, { code: projectCode });
  const connection = useQuery(
    api.sheetsSync.getConnection,
    project?._id ? { projectId: project._id } : "skip",
  );
  const syncLog = useQuery(
    api.sheetsSync.getSyncLog,
    project?._id ? { projectId: project._id, limit: 50 } : "skip",
  );
  const importLog = useQuery(
    api.import_log.getActivityLog,
    shortName ? { program: shortName, limit: 100 } : "skip",
  ) as ActivityLogEntry[] | undefined;

  const programMeta = shortName ? PROGRAM_META[shortName] : undefined;

  const unifiedTimeline = useMemo(() => {
    const items: Array<
      | { kind: "import"; entry: ActivityLogEntry }
      | {
          kind: "sync";
          _id: string;
          syncedAt: number;
          sheetName: string;
          rowsAffected: number;
          status: string;
          errorMessage?: string;
          syncedBy: string;
          syncDirection: string;
        }
    > = [];

    (importLog ?? []).forEach((e) => items.push({ kind: "import", entry: e }));
    (syncLog ?? []).forEach((l) =>
      items.push({
        kind: "sync",
        _id: l._id,
        syncedAt: l.syncedAt,
        sheetName: l.sheetName,
        rowsAffected: l.rowsAffected,
        status: l.status,
        errorMessage: l.errorMessage,
        syncedBy: l.syncedBy,
        syncDirection: l.syncDirection,
      }),
    );

    return items.sort((a, b) => {
      const at = a.kind === "import" ? a.entry.timestamp : a.syncedAt;
      const bt = b.kind === "import" ? b.entry.timestamp : b.syncedAt;
      return bt - at;
    });
  }, [importLog, syncLog]);

  const grouped = useMemo(() => {
    const out: Record<string, typeof unifiedTimeline> = {};
    const today = new Date();
    const todayKey = dayKey(today);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestKey = dayKey(yest);

    for (const item of unifiedTimeline) {
      const ts = item.kind === "import" ? item.entry.timestamp : item.syncedAt;
      const dt = new Date(ts);
      const k = dayKey(dt);
      const label =
        k === todayKey
          ? "Today"
          : k === yestKey
            ? "Yesterday"
            : dt.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year:
                  dt.getFullYear() !== today.getFullYear()
                    ? "numeric"
                    : undefined,
              });
      (out[label] ??= []).push(item);
    }
    return out;
  }, [unifiedTimeline]);

  if (!projectDef) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Unknown project: {projectCode}</p>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="mt-4">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
      </div>
    );
  }

  const importLogHref = shortName
    ? `/import-log?program=${encodeURIComponent(shortName)}`
    : "/import-log";

  return (
    <div className="page-content mx-auto flex h-full max-w-5xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/projects/${code}`}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background: programMeta?.soft ?? `${projectDef.color}18`,
              color: programMeta?.color ?? projectDef.color,
            }}
          >
            <History className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900">
              {projectDef.shortName} · Change history
            </h1>
            <p className="text-xs text-gray-500">
              Every row inserted, updated, synced, or imported for this program.
            </p>
          </div>
        </div>

        <Link href={importLogHref}>
          <Button size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Import data
          </Button>
        </Link>
      </div>

      {/* Connection summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {connection === undefined ? (
          <Skeleton className="h-12" />
        ) : connection ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900">Connected</span>
                <span className="text-xs text-gray-500">
                  tab <strong>{connection.sheetName}</strong>
                </span>
                {connection.lastSyncAt && (
                  <span className="text-xs text-gray-500">
                    · last sync{" "}
                    {formatDate(
                      new Date(connection.lastSyncAt).toISOString(),
                      "MMM d, h:mm a",
                    )}
                    {connection.lastSyncRowCount != null &&
                      ` · ${connection.lastSyncRowCount} rows`}
                  </span>
                )}
              </div>
              {connection.lastSyncError && (
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="h-3 w-3" /> {connection.lastSyncError}
                </div>
              )}
            </div>
            <a
              href={connection.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                Open sheet <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 text-sm text-gray-600">
              No Google Sheet connected yet for {projectDef.shortName}. Open the
              project page and click the{" "}
              <span className="font-medium">gear icon</span> to connect one.
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Timeline
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {unifiedTimeline.length} change
              {unifiedTimeline.length === 1 ? "" : "s"} recorded
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {importLog === undefined || syncLog === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : unifiedTimeline.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <div className="text-3xl">📋</div>
              <div className="mt-2 text-sm font-semibold text-gray-700">
                No changes yet
              </div>
              <div className="text-xs text-gray-500">
                Import data or sync from the connected sheet to see activity here.
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([label, items]) => (
              <div key={label} className="mb-4">
                <div className="mb-2 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {label}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {items.map((it) =>
                  it.kind === "import" ? (
                    <TimelineEntry key={it.entry._id} entry={it.entry} />
                  ) : (
                    <SyncEntry key={it._id} item={it} />
                  ),
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SyncEntry({
  item,
}: {
  item: {
    _id: string;
    syncedAt: number;
    sheetName: string;
    rowsAffected: number;
    status: string;
    errorMessage?: string;
    syncedBy: string;
    syncDirection: string;
  };
}) {
  const ok = item.status === "success";
  const partial = item.status === "partial";
  return (
    <div className="flex gap-3 py-1">
      <div className="flex w-9 flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-base shadow-sm",
            ok
              ? "bg-emerald-50 text-emerald-700"
              : partial
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700",
          )}
        >
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="mt-1 w-px flex-1 bg-gray-200" />
      </div>

      <div className="flex-1 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
            Sheet sync
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
            {item.syncDirection}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              ok
                ? "bg-emerald-50 text-emerald-700"
                : partial
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700",
            )}
          >
            {item.status}
          </span>
          <span className="ml-auto text-[11px] text-gray-400">
            {new Date(item.syncedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="mt-1 text-sm text-gray-800">
          Synced <strong>{item.rowsAffected}</strong> row
          {item.rowsAffected === 1 ? "" : "s"} from tab{" "}
          <strong>{item.sheetName}</strong>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
          <span>by {item.syncedBy}</span>
        </div>
        {item.errorMessage && (
          <div className="mt-1 rounded-md bg-amber-50 p-2 text-[11px] text-amber-800">
            ⚠ {item.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
