"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import {
  Users, UserCheck, Monitor, Clock, ArrowUpDown,
  RefreshCw, AlertCircle, CheckCircle2, ScanFace,
  QrCode, Footprints, Activity, Database, Sheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// Unified Attendance Overview Dashboard
// Combines intern attendance + DTC client logbook + sync status
// ============================================================

type FilterType = "ALL" | "INTERN" | "DTC";

export default function AttendanceOverviewPage() {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [dateFilter, setDateFilter] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // ── Queries ──────────────────────────────────────────────────
  const todayStats = useQuery(api.auditLog.getTodayStats);
  const recentActivity = useQuery(api.auditLog.getRecentActivity, { limit: 50 });
  const syncStatuses = useQuery(api.syncMonitor.getAll);

  // ── Derived data ─────────────────────────────────────────────
  const filteredActivity = useMemo(() => {
    if (!recentActivity) return [];
    return recentActivity.filter((a) => {
      if (filter === "INTERN") return a.type.startsWith("INTERN_");
      if (filter === "DTC") return a.type.startsWith("DTC_");
      return true;
    });
  }, [recentActivity, filter]);

  const isLoading = !todayStats || !recentActivity;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance Overview</h1>
          <p className="text-sm text-muted-foreground">
            Unified view of intern attendance &amp; DTC client activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Intern Check-ins"
            value={todayStats.internCheckIns}
            subtitle={`${todayStats.internCheckOuts} checked out`}
            icon={UserCheck}
            color="emerald"
          />
          <StatCard
            title="DTC Clients"
            value={todayStats.dtcCheckIns}
            subtitle={`${todayStats.dtcCheckOuts} completed`}
            icon={Monitor}
            color="blue"
          />
          <StatCard
            title="Total Events"
            value={todayStats.totalEvents}
            subtitle={`${todayStats.pendingSync} pending sync`}
            icon={Activity}
            color="purple"
          />
          <MethodBreakdown byMethod={todayStats.byMethod} />
        </div>
      )}

      {/* ── Sync Status Panel ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Google Sheets Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!syncStatuses ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : syncStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No sync status data yet. Sync jobs will populate this after the first run.
            </p>
          ) : (
            <div className="space-y-2">
              {syncStatuses.map((s) => (
                <SyncStatusRow key={s._id} status={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Activity Timeline ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Activity Timeline
            </CardTitle>
            <div className="flex items-center gap-1">
              {(["ALL", "INTERN", "DTC"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f === "ALL" ? "All" : f === "INTERN" ? "Interns" : "DTC Clients"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!recentActivity ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : filteredActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No activity recorded yet today.
            </p>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredActivity.map((entry) => (
                <ActivityRow key={entry._id} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: "emerald" | "blue" | "purple" | "amber";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MethodBreakdown({ byMethod }: { byMethod: Record<string, number> }) {
  const methods = Object.entries(byMethod);

  const iconMap: Record<string, React.ElementType> = {
    FACE_CV: ScanFace,
    QR: QrCode,
    WALK_IN: Footprints,
    MANUAL: Users,
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          By Method
        </p>
        {methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="space-y-2">
            {methods.map(([method, count]) => {
              const Icon = iconMap[method] ?? Activity;
              return (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{method}</span>
                  </div>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SyncStatusRow({
  status,
}: {
  status: {
    _id: string;
    sheetName: string;
    status: string;
    lastSyncTime?: number;
    recordsSynced?: number;
    totalPending?: number;
    lastError?: string;
  };
}) {
  const statusIcon =
    status.status === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : status.status === "error" ? (
      <AlertCircle className="h-4 w-4 text-red-500" />
    ) : status.status === "syncing" ? (
      <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
    ) : (
      <Clock className="h-4 w-4 text-gray-400" />
    );

  const statusColor =
    status.status === "success"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
      : status.status === "error"
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
        : status.status === "syncing"
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
          : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Sheet className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{status.sheetName}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {status.totalPending != null && status.totalPending > 0 && (
          <span className="text-xs text-amber-600 font-medium">
            {status.totalPending} pending
          </span>
        )}
        {status.recordsSynced != null && (
          <span className="text-xs text-muted-foreground">
            {status.recordsSynced} synced
          </span>
        )}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {statusIcon}
          {status.status}
        </span>
        {status.lastSyncTime && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            {timeAgo(status.lastSyncTime)}
          </span>
        )}
      </div>
    </div>
  );
}

function ActivityRow({
  entry,
}: {
  entry: {
    _id: string;
    type: string;
    userName: string;
    timestamp: string;
    method?: string;
    confidence?: number;
    syncedToSheets?: boolean;
    pcId?: string;
  };
}) {
  const isIntern = entry.type.startsWith("INTERN_");
  const isCheckIn = entry.type.includes("CHECKIN");

  const iconMap: Record<string, React.ElementType> = {
    FACE_CV: ScanFace,
    QR: QrCode,
    WALK_IN: Footprints,
    MANUAL: Users,
  };
  const MethodIcon = iconMap[entry.method ?? ""] ?? Activity;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
      {/* Icon */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
          isIntern
            ? isCheckIn
              ? "bg-emerald-500"
              : "bg-amber-500"
            : isCheckIn
              ? "bg-blue-500"
              : "bg-slate-500"
        }`}
      >
        {isIntern ? (isCheckIn ? "IN" : "OUT") : isCheckIn ? "IN" : "OUT"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{entry.userName}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              isIntern
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            }`}
          >
            {isIntern ? "Intern" : "DTC Client"}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <MethodIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{entry.method ?? "—"}</span>
          {entry.confidence != null && (
            <span className="text-xs text-muted-foreground">
              {(entry.confidence * 100).toFixed(0)}% conf
            </span>
          )}
          {entry.pcId && (
            <span className="text-xs text-muted-foreground">PC: {entry.pcId}</span>
          )}
        </div>
      </div>

      {/* Time + sync */}
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium">{formatTime(entry.timestamp)}</p>
        <p className="text-[10px] text-muted-foreground">
          {entry.syncedToSheets ? (
            <span className="text-emerald-500">synced</span>
          ) : (
            <span className="text-amber-500">pending</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
