"use client";

import { memo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { computeProgramHealth, HEALTH_META } from "@/lib/programHealth";
import { relativeTime } from "@/lib/relativeTime";

type Props = {
  projectCode: string; // "EGOV"
  showLabel?: boolean; // default true
  size?: "sm" | "md";
};

function ProgramHealthBadgeInner({
  projectCode,
  showLabel = true,
  size = "sm",
}: Props) {
  const project = useQuery(api.projects.getByCode, { code: projectCode });
  const connection = useQuery(
    api.sheetsSync.getConnection,
    project?._id ? { projectId: project._id } : "skip",
  );

  if (project === undefined || connection === undefined) {
    return (
      <span className="inline-flex h-4 w-14 animate-pulse rounded-full bg-gray-100" />
    );
  }

  const status = computeProgramHealth({
    hasConnection: !!connection,
    lastSyncAt: connection?.lastSyncAt,
    lastSyncStatus: connection?.lastSyncStatus,
  });
  const meta = HEALTH_META[status];

  const tip =
    status === "healthy" && connection?.lastSyncAt
      ? `Last sync ${relativeTime(connection.lastSyncAt)}`
      : status === "stale" && connection?.lastSyncAt
        ? `Last sync ${relativeTime(connection.lastSyncAt)} — run Sync now`
        : status === "error"
          ? (connection?.lastSyncError ?? "Last sync failed")
          : "No Google Sheet connected yet";

  const px = size === "md" ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${meta.border} ${meta.bg} ${meta.color} ${px} font-semibold`}
      title={tip}
    >
      <span>{meta.symbol}</span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}

export const ProgramHealthBadge = memo(ProgramHealthBadgeInner);
