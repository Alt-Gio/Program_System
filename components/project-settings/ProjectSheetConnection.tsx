"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  RefreshCw,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  projectCode: string; // e.g. "EGOV"
  shortName: string; // e.g. "eGovPH"
  color: string;
};

// Compact inline variant of the /settings page's ProjectSheetCard.
// Suitable for use inside a per-project settings dialog.
export function ProjectSheetConnection({
  projectCode,
  shortName,
  color,
}: Props) {
  const { data: session } = useSession();
  const project = useQuery(api.projects.getByCode, { code: projectCode });
  const connection = useQuery(
    api.sheetsSync.getConnection,
    project?._id ? { projectId: project._id } : "skip",
  );
  const saveConn = useMutation(api.sheetsSync.saveConnection);
  const deleteConn = useMutation(api.sheetsSync.deleteConnection);
  const toggleSync = useMutation(api.sheetsSync.toggleSync);

  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingTab, setEditingTab] = useState(false);
  const [newTab, setNewTab] = useState("");

  const isConnected = !!connection;

  function extractSheetId(url: string) {
    return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? "";
  }

  async function handleDetectTabs(overrideSheetId?: string) {
    const sid =
      overrideSheetId ??
      (isConnected ? connection!.sheetId : extractSheetId(sheetUrl));
    if (!sid) {
      toast.error("Paste the sheet URL first");
      return;
    }
    setDetecting(true);
    try {
      const res = await fetch(`/api/sheets-tabs?sheetId=${sid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch tabs");
      setAvailableTabs(data.tabs ?? []);
      if (data.tabs?.length > 0) {
        const first = data.tabs[0];
        if (!isConnected) setSheetName(first);
        else setNewTab(first);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDetecting(false);
    }
  }

  async function handleSaveNew() {
    if (!project) {
      toast.error(`Project "${shortName}" not in the database yet.`);
      return;
    }
    const url = sheetUrl.trim();
    if (!url) {
      toast.error("Paste a Google Sheets URL");
      return;
    }
    setSaving(true);
    try {
      await saveConn({
        projectId: project._id,
        sheetUrl: url,
        sheetName,
        syncEnabled: true,
        createdBy: session?.user?.email ?? "admin",
      });
      toast.success(`Sheet connected for ${shortName}`);
      setSheetUrl("");
      setAvailableTabs([]);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTab() {
    if (!connection || !newTab || !project) return;
    setSaving(true);
    try {
      await saveConn({
        projectId: project._id,
        sheetUrl: connection.sheetUrl,
        sheetName: newTab,
        syncEnabled: connection.syncEnabled,
        createdBy: session?.user?.email ?? "admin",
      });
      toast.success(`Tab updated to "${newTab}"`);
      setEditingTab(false);
      setNewTab("");
      setAvailableTabs([]);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!connection || !project) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/sheets-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project._id,
          sheetId: connection.sheetId,
          sheetName: connection.sheetName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      toast.success(
        `Synced: ${data.inserted ?? 0} new, ${data.updated ?? 0} updated${
          data.parseErrors?.length ? ` (${data.parseErrors.length} skipped)` : ""
        }`,
      );
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!connection) return;
    if (!confirm(`Remove sheet connection for ${shortName}?`)) return;
    await deleteConn({ id: connection._id });
    toast.success("Connection removed");
  }

  const lastSync = connection?.lastSyncAt
    ? formatDate(new Date(connection.lastSyncAt).toISOString(), "MMM d, h:mm a")
    : null;
  const statusColor =
    connection?.lastSyncStatus === "success"
      ? "text-green-600"
      : connection?.lastSyncStatus === "partial"
        ? "text-amber-600"
        : "text-gray-400";

  return (
    <div className="space-y-4">
      {/* Status line */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18` }}
        >
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-800">{shortName}</div>
          {isConnected ? (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>
                tab: <strong>{connection.sheetName}</strong>
              </span>
              {lastSync && (
                <span className={cn("ml-2", statusColor)}>
                  · last sync {lastSync}
                  {connection.lastSyncRowCount != null &&
                    ` (${connection.lastSyncRowCount} rows)`}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <XCircle className="h-3 w-3 text-gray-400" />
              No sheet connected
            </div>
          )}
        </div>
        {isConnected && (
          <div className="flex items-center gap-2">
            <Switch
              checked={connection.syncEnabled}
              onCheckedChange={(v) =>
                toggleSync({ id: connection._id, enabled: v })
              }
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              disabled={syncing}
              onClick={handleSync}
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <a
              href={connection.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* New connection form */}
      {!isConnected && (
        <div className="space-y-3 rounded-xl border border-dashed border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Google Sheets URL
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => {
                setSheetUrl(e.target.value);
                setAvailableTabs([]);
              }}
              className="h-8 w-full rounded-md border border-gray-200 bg-white px-3 text-xs outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Sheet tab
            </label>
            <div className="flex gap-2">
              {availableTabs.length > 0 ? (
                <select
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-blue-300"
                >
                  {availableTabs.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Sheet1"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-gray-200 bg-white px-3 text-xs outline-none focus:ring-1 focus:ring-blue-300"
                />
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1 text-xs"
                disabled={detecting}
                onClick={() => handleDetectTabs()}
              >
                <RefreshCw
                  className={cn("h-3 w-3", detecting && "animate-spin")}
                />
                {detecting ? "Detecting…" : "Detect tabs"}
              </Button>
            </div>
          </div>

          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSaveNew}
            disabled={saving}
          >
            {saving ? "Saving…" : "Connect sheet"}
          </Button>
        </div>
      )}

      {/* Existing connection — change tab + remove */}
      {isConnected && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Sheet URL
            </label>
            <input
              readOnly
              value={connection.sheetUrl}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-500 outline-none"
            />
          </div>

          {!editingTab ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-600">
                Tab: <strong>{connection.sheetName}</strong>
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 text-[11px]"
                onClick={() => {
                  setEditingTab(true);
                  handleDetectTabs();
                }}
              >
                <RefreshCw className="h-3 w-3" /> Change tab
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">
                Select a tab:
              </label>
              <div className="flex gap-2">
                {availableTabs.length > 0 ? (
                  <select
                    value={newTab}
                    onChange={(e) => setNewTab(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-amber-300 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {availableTabs.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Tab name"
                    value={newTab}
                    onChange={(e) => setNewTab(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-gray-200 bg-white px-3 text-xs outline-none focus:ring-1 focus:ring-blue-300"
                  />
                )}
                <Button
                  size="sm"
                  className="h-8 bg-amber-500 text-xs hover:bg-amber-600"
                  disabled={saving || !newTab}
                  onClick={handleSaveTab}
                >
                  {saving ? "Saving…" : "Save tab"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    setEditingTab(false);
                    setAvailableTabs([]);
                    setNewTab("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-red-200 text-xs text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3" /> Remove connection
            </Button>
          </div>
          {connection.lastSyncError && (
            <p className="break-words text-xs text-amber-600">
              ⚠ {connection.lastSyncError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
