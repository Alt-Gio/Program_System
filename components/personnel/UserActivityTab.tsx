"use client";

import { memo, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LogIn, Activity as ActivityIcon, Upload, Mic } from "lucide-react";
import { relativeTime, absoluteTime } from "@/lib/relativeTime";
import type { ActivityLogEntry } from "@/components/import-log/TimelineEntry";

type LoginRow = {
  _id: string;
  loginAt: number;
  userName: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
};

type Row =
  | { kind: "login"; ts: number; row: LoginRow }
  | { kind: "activity"; ts: number; row: ActivityLogEntry };

export function UserActivityTab() {
  const logins = useQuery(api.user_accounts.getUserLoginLog, { limit: 50 }) as
    | LoginRow[]
    | undefined;
  const acts = useQuery(api.import_log.getActivityLog, { limit: 50 }) as
    | ActivityLogEntry[]
    | undefined;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    (logins ?? []).forEach((l) =>
      out.push({ kind: "login", ts: l.loginAt, row: l }),
    );
    (acts ?? []).forEach((a) =>
      out.push({ kind: "activity", ts: a.timestamp, row: a }),
    );
    return out.sort((a, b) => b.ts - a.ts).slice(0, 80);
  }, [logins, acts]);

  const grouped = useMemo(() => groupByDay(rows), [rows]);

  if (logins === undefined || acts === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-lg bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-3xl">📋</div>
        <div className="mt-2 text-sm font-medium text-gray-700">
          No activity yet
        </div>
        <div className="text-xs text-gray-500">
          Sign-ins and data actions will appear here as they happen.
        </div>
      </div>
    );
  }

  return (
    <div>
      {Object.entries(grouped).map(([label, items]) => (
        <div key={label} className="mb-5">
          <div className="mb-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {label}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          {items.map((it) =>
            it.kind === "login" ? (
              <LoginEntry key={`l-${it.row._id}`} row={it.row} />
            ) : (
              <ActivityEntry key={`a-${it.row._id}`} row={it.row} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

const LoginEntry = memo(function LoginEntry({ row }: { row: LoginRow }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-50 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <LogIn className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-gray-900">
          <strong>{row.userName}</strong>{" "}
          <span className="text-gray-500">logged in</span>
          <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
            {row.userRole}
          </span>
        </div>
        {row.userAgent && (
          <div className="truncate text-[11px] text-gray-400">
            {row.userAgent}
          </div>
        )}
      </div>
      <span
        className="shrink-0 text-[11px] text-gray-400"
        title={absoluteTime(row.loginAt)}
      >
        {new Date(row.loginAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
});

const ActivityEntry = memo(function ActivityEntry({
  row,
}: {
  row: ActivityLogEntry;
}) {
  const Icon =
    row.action === "import" || row.action === "manual_add"
      ? Upload
      : row.isVoiceInitiated
        ? Mic
        : ActivityIcon;
  return (
    <div className="flex items-center gap-3 border-b border-gray-50 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-gray-900">
          {row.performedBy ? (
            <>
              <strong>{row.performedBy}</strong>{" "}
              <span className="text-gray-500">· {row.summary}</span>
            </>
          ) : (
            row.summary
          )}
        </div>
        <div className="text-[11px] text-gray-400">
          {row.program} · {row.affectedRows} row
          {row.affectedRows === 1 ? "" : "s"}
        </div>
      </div>
      <span
        className="shrink-0 text-[11px] text-gray-400"
        title={absoluteTime(row.timestamp)}
      >
        {relativeTime(row.timestamp)}
      </span>
    </div>
  );
});

function groupByDay(rows: Row[]): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  const today = new Date();
  const todayKey = dayKey(today);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestKey = dayKey(yest);

  for (const it of rows) {
    const d = new Date(it.ts);
    const k = dayKey(d);
    const label =
      k === todayKey
        ? "Today"
        : k === yestKey
          ? "Yesterday"
          : d.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year:
                d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
            });
    (out[label] ??= []).push(it);
  }
  return out;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
