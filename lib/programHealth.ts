export type HealthStatus = "healthy" | "stale" | "error" | "no_sheet";

export type HealthInput = {
  hasConnection: boolean;
  lastSyncAt?: number;
  lastSyncStatus?: string; // "success" | "partial" | "error" | undefined
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function computeProgramHealth(input: HealthInput): HealthStatus {
  if (!input.hasConnection) return "no_sheet";
  if (input.lastSyncStatus === "error") return "error";
  if (!input.lastSyncAt) return "stale";
  if (Date.now() - input.lastSyncAt > THREE_DAYS_MS) return "stale";
  return "healthy";
}

export const HEALTH_META: Record<
  HealthStatus,
  { label: string; symbol: string; color: string; bg: string; border: string }
> = {
  healthy: {
    label: "Healthy",
    symbol: "●",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  stale: {
    label: "Stale",
    symbol: "⚠",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  error: {
    label: "Error",
    symbol: "✕",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  no_sheet: {
    label: "No sheet",
    symbol: "○",
    color: "text-gray-500",
    bg: "bg-gray-50",
    border: "border-gray-200",
  },
};
