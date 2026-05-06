"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Settings, Database, Key, Globe, RefreshCw, Trash2,
  CheckCircle2, XCircle, AlertCircle, LogIn, LogOut,
  Copy, ExternalLink, ChevronDown, ChevronUp, BookOpen,
  Link as LinkIcon, Tag, FolderKanban, Plus, Pencil, Save, X,
  Image as ImageIcon, Video, Upload, ArrowUp, ArrowDown,
  Loader2, Film, FileImage,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn, formatDate } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR } from "@/lib/types";

// ── Sheet connection form per project ──────────────────────
function ProjectSheetCard({ projectCode }: { projectCode: string }) {
  const def = DICT_PROJECTS.find(p => p.code === projectCode);
  const { data: session } = useSession();
  const project    = useQuery(api.projects.getByCode, { code: projectCode });
  const connection = useQuery(
    api.sheetsSync.getConnection,
    project?._id ? { projectId: project._id } : "skip"
  );
  const saveConn   = useMutation(api.sheetsSync.saveConnection);
  const deleteConn = useMutation(api.sheetsSync.deleteConnection);
  const toggleSync = useMutation(api.sheetsSync.toggleSync);

  const [sheetUrl, setSheetUrl]       = useState("");
  const [sheetName, setSheetName]     = useState("Sheet1");
  const [availableTabs, setTabs]      = useState<string[]>([]);
  const [detectingTabs, setDetecting] = useState(false);
  const [changingTab, setChangingTab] = useState(false);
  const [newTab, setNewTab]           = useState("");
  const [saving, setSaving]           = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [expanded, setExpanded]       = useState(false);

  if (!def) return null;
  if (project === undefined) return <Skeleton className="h-24 rounded-xl" />;

  const isConnected = !!connection;

  // Extract spreadsheet ID from URL (for detect-tabs before saving)
  function extractSheetId(url: string) {
    return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? "";
  }

  async function handleDetectTabs(overrideSheetId?: string) {
    const sid = overrideSheetId ?? (isConnected ? connection!.sheetId : extractSheetId(sheetUrl));
    if (!sid) { toast.error("Paste the sheet URL first"); return; }
    setDetecting(true);
    try {
      const res = await fetch(`/api/sheets-tabs?sheetId=${sid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch tabs");
      setTabs(data.tabs ?? []);
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

  async function handleSave() {
    if (!project) {
      toast.error(`Project "${def.shortName}" doesn't exist in database yet. Please create it first or sync will create it automatically.`);
      return;
    }
    const url = sheetUrl.trim();
    if (!url) { toast.error("Paste the Google Sheets URL first"); return; }
    setSaving(true);
    try {
      await saveConn({
        projectId: project._id,
        sheetUrl: url,
        sheetName,
        syncEnabled: true,
        createdBy: "admin",
      });
      toast.success(`Sheet connected for ${def.shortName}`);
      setSheetUrl(""); setTabs([]);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeTab() {
    if (!connection || !newTab) return;
    setSaving(true);
    try {
      await saveConn({
        projectId: project!._id,
        sheetUrl: connection.sheetUrl,
        sheetName: newTab,
        syncEnabled: connection.syncEnabled,
        createdBy: session?.user?.email ?? "admin",
      });
      toast.success(`Tab updated to "${newTab}"`);
      setChangingTab(false); setNewTab(""); setTabs([]);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!connection) {
      toast.error("No sheet connected");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/sheets-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project!._id,
          sheetId: connection.sheetId,
          sheetName: connection.sheetName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      toast.success(
        `Synced: ${data.inserted} new, ${data.updated} updated` +
        (data.parseErrors?.length ? ` (${data.parseErrors.length} skipped)` : "")
      );
      if (data.parseErrors?.length) console.warn("[sheets-sync] parse errors:", data.parseErrors);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!connection) return;
    if (!confirm(`Remove sheet connection for ${def?.shortName}?`)) return;
    await deleteConn({ id: connection._id });
    toast.success("Connection removed");
  }

  const lastSync = connection?.lastSyncAt
    ? formatDate(new Date(connection.lastSyncAt).toISOString(), "MMM d, h:mm a")
    : null;
  const statusColor = connection?.lastSyncStatus === "success"
    ? "text-green-600" : connection?.lastSyncStatus === "partial"
    ? "text-amber-600" : "text-gray-400";
  const hasRangeError = connection?.lastSyncError?.toLowerCase().includes("parse range");

  return (
    <div className={cn(
      "border rounded-xl transition-all overflow-hidden",
      isConnected ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50/50",
      hasRangeError && "border-amber-300"
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${def.color}18` }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: def.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{def.shortName}</p>
          {isConnected ? (
            <p className="text-xs text-gray-500 truncate">
              tab: <strong>{connection.sheetName}</strong>
              {hasRangeError && (
                <span className="ml-2 text-amber-600 font-semibold">⚠ wrong tab name — expand to fix</span>
              )}
              {!hasRangeError && lastSync && (
                <span className={cn("ml-2", statusColor)}>
                  · last sync {lastSync}
                  {connection.lastSyncRowCount != null && ` (${connection.lastSyncRowCount} rows)`}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-400">No sheet connected</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <>
              <Switch
                checked={connection.syncEnabled}
                onCheckedChange={v => toggleSync({ id: connection._id, enabled: v })}
              />
              <Button size="sm" variant="outline"
                className="h-7 text-xs gap-1"
                disabled={syncing}
                onClick={handleSync}>
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync"}
              </Button>
              <a href={connection.sheetUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </Button>
              </a>
            </>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
            onClick={() => { setExpanded(v => !v); if (!expanded && isConnected && hasRangeError) { setChangingTab(true); handleDetectTabs(); } }}>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </Button>
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">

          {/* ── New connection form ── */}
          {!isConnected && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Google Sheets URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrl}
                    onChange={e => { setSheetUrl(e.target.value); setTabs([]); }}
                    className="flex-1 h-8 text-xs rounded-md border border-gray-200 px-3 bg-white outline-none focus:ring-1 focus:ring-blue-300"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Sheet Tab Name
                  <span className="text-gray-400 font-normal ml-1">(click Detect to find it automatically)</span>
                </label>
                <div className="flex gap-2">
                  {availableTabs.length > 0 ? (
                    <select
                      value={sheetName}
                      onChange={e => setSheetName(e.target.value)}
                      className="flex-1 h-8 text-xs rounded-md border border-gray-200 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-300">
                      {availableTabs.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Sheet1"
                      value={sheetName}
                      onChange={e => setSheetName(e.target.value)}
                      className="flex-1 h-8 text-xs rounded-md border border-gray-200 px-3 bg-white outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 shrink-0"
                    disabled={detectingTabs}
                    onClick={() => handleDetectTabs()}>
                    <RefreshCw className={cn("w-3 h-3", detectingTabs && "animate-spin")} />
                    {detectingTabs ? "Detecting…" : "Detect Tabs"}
                  </Button>
                </div>
                {availableTabs.length > 0 && (
                  <p className="text-[10px] text-green-600 mt-1">Found {availableTabs.length} tab(s) — select the one with your activity data</p>
                )}
              </div>
              <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Connect Sheet"}
              </Button>
            </>
          )}

          {/* ── Existing connection — show URL + change tab ── */}
          {isConnected && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sheet URL</label>
                <input
                  type="url" readOnly value={connection.sheetUrl}
                  className="w-full h-8 text-xs rounded-md border border-gray-200 px-3 bg-gray-50 text-gray-500 outline-none"
                />
              </div>

              {/* Change tab section */}
              {!changingTab ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-600">Tab: <strong>{connection.sheetName}</strong></p>
                  <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1"
                    onClick={() => { setChangingTab(true); handleDetectTabs(); }}>
                    <RefreshCw className="w-3 h-3" /> Change Tab
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 block">
                    Select the correct tab:
                  </label>
                  <div className="flex gap-2">
                    {availableTabs.length > 0 ? (
                      <select
                        value={newTab}
                        onChange={e => setNewTab(e.target.value)}
                        className="flex-1 h-8 text-xs rounded-md border border-amber-300 px-2 bg-white outline-none focus:ring-1 focus:ring-amber-400">
                        {availableTabs.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="Tab name" value={newTab}
                        onChange={e => setNewTab(e.target.value)}
                        className="flex-1 h-8 text-xs rounded-md border border-gray-200 px-3 bg-white outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    )}
                    {detectingTabs && <RefreshCw className="w-4 h-4 animate-spin text-gray-400 self-center" />}
                    {!detectingTabs && availableTabs.length === 0 && (
                      <Button size="sm" variant="outline" className="h-8 text-xs"
                        onClick={() => handleDetectTabs()}>
                        Detect
                      </Button>
                    )}
                    <Button size="sm" className="h-8 text-xs bg-amber-500 hover:bg-amber-600"
                      disabled={saving || !newTab}
                      onClick={handleChangeTab}>
                      {saving ? "Saving…" : "Save Tab"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs"
                      onClick={() => { setChangingTab(false); setTabs([]); setNewTab(""); }}>
                      Cancel
                    </Button>
                  </div>
                  {availableTabs.length > 0 && (
                    <p className="text-[10px] text-green-600">Found: {availableTabs.join(", ")}</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleDelete}>
                  <Trash2 className="w-3 h-3" /> Remove Connection
                </Button>
              </div>
              {connection.lastSyncError && (
                <p className="text-xs text-amber-600 break-words">⚠ {connection.lastSyncError}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sync Log ────────────────────────────────────────────────
function SyncLogCard() {
  const logs = useQuery(api.sheetsSync.getSyncLog, { limit: 10 });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Sync History</CardTitle>
        <CardDescription className="text-xs">Last 10 sync operations</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {!logs ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No syncs yet. Connect a sheet and click Sync.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map(log => (
              <div key={log._id} className="flex items-center gap-3 py-2.5">
                {log.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : log.status === "partial" ? (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{log.projectName}</p>
                  <p className="text-[10px] text-gray-400">
                    {log.rowsAffected} rows · {formatDate(new Date(log.syncedAt).toISOString(), "MMM d, h:mm a")}
                    {log.syncedBy && ` · ${log.syncedBy}`}
                  </p>
                  {log.errorMessage && (
                    <p className="text-[10px] text-amber-600 truncate mt-0.5">{log.errorMessage}</p>
                  )}
                </div>
                <Badge variant="outline" className={cn("text-[10px] h-5 shrink-0",
                  log.status === "success" ? "border-green-200 text-green-700" :
                  log.status === "partial" ? "border-amber-200 text-amber-700" :
                  "border-red-200 text-red-700")}>
                  {log.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Database Sync Card ──────────────────────────────────────
function DatabaseSyncCard() {
  const { data: session } = useSession();
  const connections       = useQuery(api.sheetsSync.listConnections, {});
  const deleteAll         = useMutation(api.activities.deleteAllActivities);

  const [phase, setPhase]         = useState<"idle" | "confirm" | "running" | "done">("idle");
  const [confirmText, setConfirm] = useState("");
  const [log, setLog]             = useState<string[]>([]);

  const enabled = (connections ?? []).filter((c: any) => c.syncEnabled && c.sheetId);

  async function handleFullResync() {
    setPhase("running");
    setLog([]);

    // Step 1 — Delete all activities
    try {
      const { deleted } = await deleteAll({});
      setLog(prev => [...prev, `✓ Deleted ${deleted} existing activities from database.`]);
    } catch (e) {
      setLog(prev => [...prev, `✗ Failed to delete activities: ${String(e)}`]);
      setPhase("done");
      return;
    }

    // Step 2 — Re-sync all connected sheets
    let inserted = 0, updated = 0, failed = 0;
    for (const conn of enabled) {
      const name = (conn as any).project?.shortName ?? conn.sheetName;
      try {
        const res = await fetch("/api/sheets-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: conn.projectId,
            sheetId:   conn.sheetId,
            sheetName: conn.sheetName,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          inserted += data.inserted ?? 0;
          updated  += data.updated  ?? 0;
          setLog(prev => [...prev, `✓ ${name}: ${data.inserted} new, ${data.updated} updated.`]);
        } else {
          failed++;
          setLog(prev => [...prev, `✗ ${name}: ${data.error ?? "Sync failed"}`]);
        }
      } catch (e) {
        failed++;
        setLog(prev => [...prev, `✗ ${name}: ${String(e)}`]);
      }
    }

    const summary = `Done — ${inserted} inserted, ${updated} updated` + (failed ? `, ${failed} sheet(s) failed` : "");
    setLog(prev => [...prev, "", summary]);
    if (failed === 0) toast.success(summary); else toast.warning(summary);
    setPhase("done");
  }

  function reset() {
    setPhase("idle");
    setConfirm("");
    setLog([]);
  }

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-red-600" /> Database Sync
        </CardTitle>
        <CardDescription className="text-xs">
          Wipes all activities from the database and re-imports exclusively from connected Google Sheets.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 space-y-0.5">
            <p className="font-semibold">Destructive — cannot be undone</p>
            <p>
              All {connections === undefined ? "…" : ""} activity records will be permanently deleted,
              then re-imported from <strong>{enabled.length}</strong> connected sheet{enabled.length !== 1 ? "s" : ""}.
              Any manually entered activities not in Google Sheets will be lost.
            </p>
          </div>
        </div>

        {/* Idle state */}
        {phase === "idle" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
            disabled={enabled.length === 0}
            onClick={() => { setPhase("confirm"); setConfirm(""); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Full Database Resync…
          </Button>
        )}

        {/* Confirm state */}
        {phase === "confirm" && (
          <div className="space-y-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-xs font-semibold text-red-800">
              Type <code className="bg-red-100 px-1 rounded tracking-widest">RESYNC ALL</code> to confirm:
            </p>
            <input
              autoFocus
              type="text"
              value={confirmText}
              onChange={e => setConfirm(e.target.value)}
              placeholder="RESYNC ALL"
              className="w-full h-8 text-xs rounded-md border border-red-300 px-3 bg-white outline-none focus:ring-1 focus:ring-red-400 tracking-widest font-mono"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs bg-red-600 hover:bg-red-700 gap-1.5"
                disabled={confirmText.trim() !== "RESYNC ALL"}
                onClick={handleFullResync}
              >
                <Trash2 className="w-3.5 h-3.5" /> Confirm Full Resync
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={reset}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Running state */}
        {phase === "running" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" />
              <span>Syncing — do not close this page…</span>
            </div>
            <div className="bg-gray-950 rounded-lg p-3 font-mono text-[10px] text-green-400 space-y-0.5 min-h-[60px]">
              {log.map((line, i) => <p key={i}>{line || "\u00a0"}</p>)}
              <p className="animate-pulse">_</p>
            </div>
          </div>
        )}

        {/* Done state */}
        {phase === "done" && (
          <div className="space-y-2">
            <div className="bg-gray-950 rounded-lg p-3 font-mono text-[10px] text-green-400 space-y-0.5 max-h-48 overflow-y-auto">
              {log.map((line, i) => <p key={i}>{line || "\u00a0"}</p>)}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={reset}>
              Close
            </Button>
          </div>
        )}

        {enabled.length === 0 && (
          <p className="text-[10px] text-amber-600">⚠ No active sheet connections found. Connect a sheet first.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Programs (CRUD on the Convex `projects` table) ──────────
//
// Lets admins add / rename / re-color / archive / delete the
// programs that show up in the sidebar and elsewhere. Wires
// directly to convex/projects.ts mutations.
//
// Heads up: the left-sidebar PROGRAMS list and the per-program
// routes under /projects/<route>/page.tsx are still hard-coded
// in components/layout/Sidebar.tsx. Editing or deleting the
// existing 10 programs Just Works. Adding a brand-new program
// creates the DB record but won't auto-create a sidebar entry
// or a /projects/<x> page — that needs a follow-up refactor to
// make the sidebar data-driven.
type ProgramRow = {
  _id: string;
  code: string;
  name: string;
  shortName: string;
  description: string;
  division: string;
  projectType: string;
  targetSectors: string[];
  modeOptions: string[];
  requirementNote?: string;
  color: string;
  icon?: string;
  isActive: boolean;
  driveId?: string;
};

type ProgramFormValues = Omit<ProgramRow, "_id">;

const EMPTY_PROGRAM: ProgramFormValues = {
  code: "",
  name: "",
  shortName: "",
  description: "",
  division: "ILCDB",
  projectType: "",
  targetSectors: [],
  modeOptions: ["On-Site", "Face-to-Face"],
  requirementNote: "",
  color: "#3B82F6",
  icon: "",
  isActive: true,
  driveId: "",
};

const KNOWN_DIVISIONS = ["DICT Proper", "ILCDB", "IIDB"];
const KNOWN_MODES     = ["On-Site", "Face-to-Face", "Online", "Hybrid"];

function ProgramForm({
  initial, mode, onSave, onCancel,
}: {
  initial: ProgramFormValues;
  mode:    "create" | "edit";
  onSave:  (data: ProgramFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV]       = useState<ProgramFormValues>(initial);
  const [saving, setSv] = useState(false);

  function patch(p: Partial<ProgramFormValues>) { setV(prev => ({ ...prev, ...p })); }

  function setListField(key: "targetSectors" | "modeOptions", csv: string) {
    patch({ [key]: csv.split(",").map(s => s.trim()).filter(Boolean) } as any);
  }

  async function handleSubmit() {
    // Minimal client-side validation — server enforces the rest.
    if (!v.code.trim())      return toast.error("Code is required.");
    if (!v.name.trim())      return toast.error("Name is required.");
    if (!v.shortName.trim()) return toast.error("Short name is required.");
    setSv(true);
    try {
      await onSave({
        ...v,
        code:        v.code.trim().toUpperCase(),
        name:        v.name.trim(),
        shortName:   v.shortName.trim(),
        description: v.description.trim(),
        division:    v.division.trim(),
        projectType: (v.projectType || v.shortName).trim(),
        // Empty optional strings → undefined so we don't store ""
        requirementNote: v.requirementNote?.trim() || undefined,
        icon:            v.icon?.trim()            || undefined,
        driveId:         v.driveId?.trim()         || undefined,
      });
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSv(false);
    }
  }

  // Tiny helpers to keep the JSX readable.
  const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
    <label className="text-xs font-medium text-gray-600 mb-1 block">
      {children}
      {hint && <span className="text-gray-400 font-normal ml-1">({hint})</span>}
    </label>
  );
  const inputCls = "w-full h-8 text-xs rounded-md border border-gray-200 px-3 bg-white outline-none focus:ring-1 focus:ring-blue-300";

  return (
    <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label hint="UPPERCASE, unique">Code</Label>
          <input
            className={inputCls}
            value={v.code}
            onChange={e => patch({ code: e.target.value.toUpperCase() })}
            placeholder="EGOV"
            disabled={mode === "edit"}
          />
          {mode === "edit" && (
            <p className="text-[10px] text-gray-400 mt-1">Code is the natural key — not editable here.</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Label>Short name <span className="text-gray-400 font-normal">(sidebar label)</span></Label>
          <input
            className={inputCls}
            value={v.shortName}
            onChange={e => patch({ shortName: e.target.value })}
            placeholder="eGovPH"
          />
        </div>
      </div>

      <div>
        <Label>Full name</Label>
        <input
          className={inputCls}
          value={v.name}
          onChange={e => patch({ name: e.target.value })}
          placeholder="eGovPH Mobile Application"
        />
      </div>

      <div>
        <Label>Description</Label>
        <textarea
          className="w-full text-xs rounded-md border border-gray-200 px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-blue-300 min-h-[60px]"
          value={v.description}
          onChange={e => patch({ description: e.target.value })}
          placeholder="What does this program do?"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Division</Label>
          <input
            className={inputCls}
            value={v.division}
            onChange={e => patch({ division: e.target.value })}
            list="division-suggestions"
            placeholder="ILCDB"
          />
          <datalist id="division-suggestions">
            {KNOWN_DIVISIONS.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div>
          <Label hint="defaults to short name">Project type</Label>
          <input
            className={inputCls}
            value={v.projectType}
            onChange={e => patch({ projectType: e.target.value })}
            placeholder="eGovPH"
          />
        </div>
        <div>
          <Label hint="lucide-react name">Icon</Label>
          <input
            className={inputCls}
            value={v.icon ?? ""}
            onChange={e => patch({ icon: e.target.value })}
            placeholder="Monitor"
          />
        </div>
      </div>

      <div>
        <Label hint="comma-separated">Target sectors</Label>
        <input
          className={inputCls}
          value={v.targetSectors.join(", ")}
          onChange={e => setListField("targetSectors", e.target.value)}
          placeholder="NGA, LGU, SUC, Communities"
        />
      </div>

      <div>
        <Label hint="comma-separated — common: On-Site, Face-to-Face, Online, Hybrid">Mode options</Label>
        <input
          className={inputCls}
          value={v.modeOptions.join(", ")}
          onChange={e => setListField("modeOptions", e.target.value)}
          placeholder={KNOWN_MODES.join(", ")}
        />
      </div>

      <div>
        <Label hint="optional">Requirement note</Label>
        <input
          className={inputCls}
          value={v.requirementNote ?? ""}
          onChange={e => patch({ requirementNote: e.target.value })}
          placeholder="Letter of Intent"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <Label>Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={v.color}
              onChange={e => patch({ color: e.target.value })}
              className="w-10 h-8 p-0 rounded cursor-pointer border border-gray-200"
            />
            <input
              className={inputCls + " flex-1"}
              value={v.color}
              onChange={e => patch({ color: e.target.value })}
              placeholder="#3B82F6"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pb-1">
          <Switch
            checked={v.isActive}
            onCheckedChange={c => patch({ isActive: c })}
          />
          <span className="text-xs text-gray-700">
            {v.isActive ? "Active — visible app-wide" : "Archived — hidden from listings"}
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-8 text-xs gap-1" disabled={saving} onClick={handleSubmit}>
          <Save className="w-3 h-3" />
          {saving ? "Saving…" : mode === "create" ? "Create program" : "Save changes"}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={onCancel}>
          <X className="w-3 h-3" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Per-program media panel — logo + highlights gallery ─────
//
// Both image and video are accepted. We use Convex File Storage end-
// to-end (see convex/programMedia.ts). The panel is intentionally
// self-contained so it can be lifted to a per-program admin page
// later if you want a bigger surface for it.
const MAX_LOGO_BYTES   = 5 * 1024 * 1024;    //  5 MB
const MAX_IMAGE_BYTES  = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_BYTES  = 50 * 1024 * 1024;   // 50 MB

function bytesToHuman(n?: number) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ProgramMediaPanel({ projectId }: { projectId: string }) {
  const logoUrl    = useQuery(api.programMedia.getProgramLogoUrl, { projectId: projectId as any });
  const highlights = useQuery(api.programMedia.listHighlights,    { projectId: projectId as any });

  const generateUrl   = useMutation(api.programMedia.generateUploadUrl);
  const setLogo       = useMutation(api.programMedia.setProgramLogo);
  const clearLogo     = useMutation(api.programMedia.clearProgramLogo);
  const addHighlight  = useMutation(api.programMedia.addHighlight);
  const removeHigh    = useMutation(api.programMedia.removeHighlight);
  const moveHigh      = useMutation(api.programMedia.moveHighlight);
  const updateHigh    = useMutation(api.programMedia.updateHighlight);

  const [logoBusy,  setLogoBusy]  = useState(false);
  const [mediaBusy, setMediaBusy] = useState<null | "image" | "video">(null);

  // ── Upload helper — returns a Convex storage ID ──
  async function uploadToConvex(file: File): Promise<string> {
    const url = await generateUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const { storageId } = await res.json();
    if (!storageId) throw new Error("Upload returned no storage ID.");
    return storageId as string;
  }

  // ── Logo handlers ──
  async function handleLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image (PNG/JPG/SVG/WebP).");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Logo too large (max ${bytesToHuman(MAX_LOGO_BYTES)}).`);
      return;
    }
    setLogoBusy(true);
    try {
      const storageId = await uploadToConvex(file);
      await setLogo({ projectId: projectId as any, storageId });
      toast.success("Logo updated.");
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleClearLogo() {
    if (!confirm("Remove the program logo? The sidebar will fall back to the default icon.")) return;
    setLogoBusy(true);
    try {
      await clearLogo({ projectId: projectId as any });
      toast.success("Logo removed.");
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setLogoBusy(false);
    }
  }

  // ── Highlights handlers ──
  async function handleHighlightFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast.error(`Skipped "${file.name}" — not an image or video.`);
        continue;
      }
      const cap = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      if (file.size > cap) {
        toast.error(`"${file.name}" too large (max ${bytesToHuman(cap)} for ${isImage ? "image" : "video"}).`);
        continue;
      }

      setMediaBusy(isImage ? "image" : "video");
      try {
        const storageId = await uploadToConvex(file);
        await addHighlight({
          projectId: projectId as any,
          storageId,
          mediaType: isImage ? "image" : "video",
          fileName:  file.name,
          fileSize:  file.size,
          mimeType:  file.type,
        });
        toast.success(`Added ${isImage ? "image" : "video"} "${file.name}".`);
      } catch (e: any) {
        toast.error(e?.message ?? String(e));
      } finally {
        setMediaBusy(null);
      }
    }
  }

  return (
    <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4 space-y-4">
      {/* ── Logo section ──────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <FileImage className="w-3.5 h-3.5 text-indigo-600" /> Logo
        </p>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl border border-indigo-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl === undefined ? (
              <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
            ) : logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
            ) : (
              <ImageIcon className="w-5 h-5 text-gray-300" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600">
              {logoUrl
                ? "Used in the sidebar PROGRAMS list and program headers."
                : "Upload a square PNG / SVG / WebP. Falls back to the default icon when blank."}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Max {bytesToHuman(MAX_LOGO_BYTES)}. Square 256×256 recommended.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <label className={cn(
              "inline-flex items-center justify-center gap-1 h-7 px-3 text-xs font-medium rounded-md cursor-pointer",
              "bg-indigo-600 text-white hover:bg-indigo-700 transition-colors",
              logoBusy && "opacity-50 pointer-events-none"
            )}>
              {logoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {logoUrl ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={logoBusy}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            {logoUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={logoBusy}
                onClick={handleClearLogo}
              >
                <Trash2 className="w-3 h-3" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-indigo-200/60" />

      {/* ── Highlights section ─────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-indigo-600" /> Highlights
            {highlights && highlights.length > 0 && (
              <span className="text-gray-400 font-normal">({highlights.length})</span>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <label className={cn(
              "inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-md cursor-pointer",
              "border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 transition-colors",
              mediaBusy === "image" && "opacity-50 pointer-events-none"
            )}>
              {mediaBusy === "image" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
              Add Image
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={mediaBusy !== null}
                onChange={e => { handleHighlightFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
            <label className={cn(
              "inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-md cursor-pointer",
              "border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 transition-colors",
              mediaBusy === "video" && "opacity-50 pointer-events-none"
            )}>
              {mediaBusy === "video" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
              Add Video
              <input
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                disabled={mediaBusy !== null}
                onChange={e => { handleHighlightFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
          </div>
        </div>

        <p className="text-[10px] text-gray-500 mb-3">
          Images up to {bytesToHuman(MAX_IMAGE_BYTES)}, videos up to {bytesToHuman(MAX_VIDEO_BYTES)}.
          Drag-to-reorder coming later — use the arrow buttons for now.
        </p>

        {highlights === undefined ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="aspect-video rounded-lg" />)}
          </div>
        ) : highlights.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
            No highlights yet. Use <strong>Add Image</strong> or <strong>Add Video</strong> above.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {highlights.map((h, idx) => (
              <HighlightTile
                key={h._id}
                highlight={h as any}
                isFirst={idx === 0}
                isLast={idx === highlights.length - 1}
                onMoveUp={async () => {
                  try { await moveHigh({ id: h._id as any, direction: "up" }); }
                  catch (e: any) { toast.error(e?.message ?? String(e)); }
                }}
                onMoveDown={async () => {
                  try { await moveHigh({ id: h._id as any, direction: "down" }); }
                  catch (e: any) { toast.error(e?.message ?? String(e)); }
                }}
                onCaption={async (caption) => {
                  try {
                    await updateHigh({ id: h._id as any, caption: caption || undefined });
                    toast.success("Caption saved.");
                  } catch (e: any) { toast.error(e?.message ?? String(e)); }
                }}
                onRemove={async () => {
                  if (!confirm(`Remove this ${h.mediaType}?`)) return;
                  try {
                    await removeHigh({ id: h._id as any });
                    toast.success("Removed.");
                  } catch (e: any) { toast.error(e?.message ?? String(e)); }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightTile({
  highlight, isFirst, isLast, onMoveUp, onMoveDown, onCaption, onRemove,
}: {
  highlight: {
    _id: string;
    storageId: string;
    mediaType: "image" | "video";
    caption?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    url: string | null;
  };
  isFirst:    boolean;
  isLast:     boolean;
  onMoveUp:   () => Promise<void>;
  onMoveDown: () => Promise<void>;
  onCaption:  (caption: string) => Promise<void>;
  onRemove:   () => Promise<void>;
}) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [draftCaption,   setDraftCaption]   = useState(highlight.caption ?? "");

  const isVideo = highlight.mediaType === "video";

  return (
    <div className="group relative rounded-xl overflow-hidden border border-gray-200 bg-white">
      {/* Media preview */}
      <div className="aspect-video bg-gray-50 flex items-center justify-center overflow-hidden">
        {!highlight.url ? (
          <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
        ) : isVideo ? (
          <video
            src={highlight.url}
            controls
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={highlight.url}
            alt={highlight.caption ?? highlight.fileName ?? "highlight"}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Type + size badge */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] h-4 px-1.5 gap-0.5 border-0 font-medium",
            isVideo ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
          )}
        >
          {isVideo ? <Video className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
          {highlight.mediaType}
        </Badge>
        {highlight.fileSize != null && (
          <span className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded font-mono">
            {bytesToHuman(highlight.fileSize)}
          </span>
        )}
      </div>

      {/* Actions overlay */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          title="Move up"
          className={cn(
            "p-1 rounded bg-white/90 text-gray-700 hover:text-indigo-600 shadow-sm",
            isFirst && "opacity-40 cursor-not-allowed"
          )}
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          title="Move down"
          className={cn(
            "p-1 rounded bg-white/90 text-gray-700 hover:text-indigo-600 shadow-sm",
            isLast && "opacity-40 cursor-not-allowed"
          )}
        >
          <ArrowDown className="w-3 h-3" />
        </button>
        <button
          onClick={onRemove}
          title="Remove"
          className="p-1 rounded bg-white/90 text-gray-700 hover:text-red-600 shadow-sm"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Caption */}
      <div className="px-2.5 py-2 border-t border-gray-100">
        {editingCaption ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={draftCaption}
              onChange={e => setDraftCaption(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  onCaption(draftCaption.trim());
                  setEditingCaption(false);
                } else if (e.key === "Escape") {
                  setDraftCaption(highlight.caption ?? "");
                  setEditingCaption(false);
                }
              }}
              placeholder="Caption (optional)"
              className="flex-1 min-w-0 h-6 text-[11px] rounded border border-indigo-200 px-1.5 outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <button
              onClick={() => { onCaption(draftCaption.trim()); setEditingCaption(false); }}
              className="p-1 rounded text-green-600 hover:bg-green-50"
              title="Save caption"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={() => { setDraftCaption(highlight.caption ?? ""); setEditingCaption(false); }}
              className="p-1 rounded text-gray-400 hover:bg-gray-50"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingCaption(true)}
            className="text-left w-full text-[11px] text-gray-600 hover:text-indigo-600 truncate"
            title={highlight.caption || highlight.fileName || "Click to add caption"}
          >
            {highlight.caption || (
              <span className="text-gray-400 italic">
                {highlight.fileName ?? "Click to add caption"}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ProgramRow({
  program, mode, onEdit, onMedia, onCancel, onSave, onDelete, onToggleActive, logoUrl,
}: {
  program:        ProgramRow;
  mode:           "view" | "edit" | "media";
  onEdit:         () => void;
  onMedia:        () => void;
  onCancel:       () => void;
  onSave:         (data: ProgramFormValues) => Promise<void>;
  onDelete:       () => Promise<void>;
  onToggleActive: (next: boolean) => Promise<void>;
  logoUrl:        string | null;
}) {
  if (mode === "edit") {
    return (
      <ProgramForm
        mode="edit"
        initial={{
          code:            program.code,
          name:            program.name,
          shortName:       program.shortName,
          description:     program.description,
          division:        program.division,
          projectType:     program.projectType,
          targetSectors:   program.targetSectors,
          modeOptions:     program.modeOptions,
          requirementNote: program.requirementNote ?? "",
          color:           program.color,
          icon:            program.icon ?? "",
          isActive:        program.isActive,
          driveId:         program.driveId ?? "",
        }}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  // ── Collapsed view + optional inline media panel ─────────
  const isMediaOpen = mode === "media";

  return (
    <div
      className={cn(
        "border rounded-xl bg-white overflow-hidden",
        program.isActive ? "border-gray-200" : "border-dashed border-gray-200 bg-gray-50/60",
        isMediaOpen && "ring-1 ring-indigo-200"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Logo / color preview */}
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border",
            logoUrl ? "bg-white border-gray-200" : "border-transparent"
          )}
          style={!logoUrl ? { backgroundColor: `${program.color}18` } : undefined}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={program.shortName} className="w-full h-full object-contain p-0.5" />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: program.color }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-semibold", program.isActive ? "text-gray-800" : "text-gray-500")}>
              {program.shortName}
            </p>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
              {program.code}
            </Badge>
            <span className="text-[10px] text-gray-400">· {program.division}</span>
            {!program.isActive && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-200 text-amber-700">
                archived
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{program.name}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={program.isActive}
            onCheckedChange={c => onToggleActive(c)}
          />
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 text-xs gap-1",
              isMediaOpen && "bg-indigo-50 text-indigo-700"
            )}
            onClick={onMedia}
            title="Manage logo and highlights"
          >
            <ImageIcon className="w-3 h-3" /> Media
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onEdit}>
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onDelete}
            title="Delete program"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Inline media panel */}
      {isMediaOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/40">
          <ProgramMediaPanel projectId={program._id} />
        </div>
      )}
    </div>
  );
}

function AppPrograms() {
  const programs = useQuery(api.projects.list, {}) as ProgramRow[] | undefined;
  const create   = useMutation(api.projects.create);
  const update   = useMutation(api.projects.update);
  const remove   = useMutation(api.projects.remove);

  const [showAdd,   setShowAdd]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mediaId,   setMediaId]   = useState<string | null>(null);

  // Bulk-fetch all program logos in one query so each row doesn't fire
  // its own. Returns Record<projectId, { code, url }>.
  const logos = useQuery(api.programMedia.listLogosByProject, {});

  const sorted = (programs ?? []).slice().sort((a, b) => {
    // Active first, then alpha by shortName.
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.shortName.localeCompare(b.shortName);
  });

  async function handleDelete(p: ProgramRow) {
    if (
      !confirm(
        `Delete program "${p.shortName}" (${p.code})?\n\n` +
        `This removes the program record and any connected Google Sheet config.\n` +
        `Existing activities tied to this program are NOT auto-deleted — clean those up via the Database Sync card if needed.\n\n` +
        `This cannot be undone.`
      )
    ) return;
    try {
      const res = await remove({ id: p._id as any });
      const parts: string[] = [];
      if (res.removedConnections) {
        parts.push(`${res.removedConnections} sheet connection${res.removedConnections === 1 ? "" : "s"}`);
      }
      if ((res as any).removedHighlights) {
        const n = (res as any).removedHighlights as number;
        parts.push(`${n} highlight${n === 1 ? "" : "s"}`);
      }
      const extras = parts.length ? ` (also removed ${parts.join(" + ")})` : "";
      toast.success(`Deleted "${p.shortName}"${extras}`);
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-600" /> Programs
            </CardTitle>
            <CardDescription className="text-xs">
              The list that powers the sidebar PROGRAMS section, the import flow, and per-program reporting.
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => { setShowAdd(v => !v); setEditingId(null); }}
          >
            {showAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAdd ? "Cancel" : "Add Program"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Sidebar caveat — keeps surprises out of the way. */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800 leading-relaxed space-y-1">
            <p>
              <strong>Editing &amp; archiving existing programs:</strong> works everywhere.
              {" "}<strong>Logo &amp; highlights uploads:</strong> stored in Convex File Storage and
              {" "}available via <code className="bg-amber-100 px-1 rounded">api.programMedia.*</code>
              {" "}— you can render them anywhere (program pages, activity headers, dashboard hero).
            </p>
            <p>
              <strong>Adding a brand-new program:</strong> creates the DB record but the left sidebar&apos;s
              {" "}PROGRAMS list and per-program pages under
              {" "}<code className="bg-amber-100 px-1 rounded">/projects/&lt;route&gt;</code>
              {" "}are still hard-coded in <code className="bg-amber-100 px-1 rounded">components/layout/Sidebar.tsx</code>.
              {" "}Same goes for uploaded logos — they replace the hard-coded
              {" "}<code className="bg-amber-100 px-1 rounded">/logo/*.png</code> mapping
              {" "}only after the sidebar is made data-driven. Ask Cascade for that follow-up when you&apos;re ready.
            </p>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <ProgramForm
            mode="create"
            initial={EMPTY_PROGRAM}
            onSave={async (data) => {
              await create(data as any);
              setShowAdd(false);
              toast.success(`Created "${data.shortName}"`);
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* List */}
        {programs === undefined ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            No programs yet. Click <strong>Add Program</strong> above, or run{" "}
            <code className="bg-gray-100 px-1 rounded">npx convex run projects:seed</code> to
            populate the default DICT R5 set.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(p => (
              <ProgramRow
                key={p._id}
                program={p}
                mode={editingId === p._id ? "edit" : mediaId === p._id ? "media" : "view"}
                logoUrl={logos?.[p._id]?.url ?? null}
                onEdit={() => { setEditingId(p._id); setMediaId(null); setShowAdd(false); }}
                onMedia={() => {
                  setMediaId(prev => (prev === p._id ? null : p._id));
                  setEditingId(null);
                  setShowAdd(false);
                }}
                onCancel={() => setEditingId(null)}
                onSave={async (data) => {
                  // Strip `code` since it isn't editable in the edit form,
                  // but the form still echoes it back. Server also re-checks.
                  const { code: _ignored, ...rest } = data;
                  try {
                    await update({ id: p._id as any, ...rest });
                    setEditingId(null);
                    toast.success(`Updated "${data.shortName}"`);
                  } catch (e: any) {
                    toast.error(e?.message ?? String(e));
                  }
                }}
                onDelete={() => handleDelete(p)}
                onToggleActive={async (next) => {
                  try {
                    await update({ id: p._id as any, isActive: next });
                    toast.success(next ? `"${p.shortName}" activated` : `"${p.shortName}" archived`);
                  } catch (e: any) {
                    toast.error(e?.message ?? String(e));
                  }
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Settings Page ──────────────────────────────────────
export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [showGuide, setShowGuide] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResults, setSyncAllResults] = useState<string | null>(null);
  const [serverAuth, setServerAuth] = useState<any>(null);

  const ACTIVE_PROGRAMS = DICT_PROJECTS.filter(p => p.code !== "__PLACEHOLDER__");
  const connections = useQuery(api.sheetsSync.listConnections, {});

  // Check server-side session
  useEffect(() => {
    fetch('/api/test-auth')
      .then(r => r.json())
      .then(data => setServerAuth(data));
  }, []);

  async function handleSyncAll() {
    const enabled = (connections ?? []).filter((c: any) => c.syncEnabled && c.sheetId);
    if (enabled.length === 0) {
      toast.error("No active sheet connections found");
      return;
    }
    setSyncingAll(true);
    setSyncAllResults(null);
    let inserted = 0, updated = 0, failed = 0;
    for (const conn of enabled) {
      try {
        const res = await fetch("/api/sheets-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: conn.projectId,
            sheetId: conn.sheetId,
            sheetName: conn.sheetName,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          inserted += data.inserted ?? 0;
          updated  += data.updated  ?? 0;
        } else {
          failed++;
          console.warn(`[sync-all] ${conn.project?.shortName}:`, data.error);
        }
      } catch (e) {
        failed++;
        console.error("[sync-all] fetch error:", e);
      }
    }
    setSyncingAll(false);
    const msg = `Done: ${inserted} new, ${updated} updated` + (failed ? `, ${failed} failed` : "");
    setSyncAllResults(msg);
    if (failed === 0) toast.success(msg); else toast.warning(msg);
  }

  return (
    <div className="page-content max-w-3xl mx-auto space-y-5">

      {/* ── Google Account ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google Account
          </CardTitle>
          <CardDescription className="text-xs">
            Required to read <strong>and write</strong> Google Sheets data (sync + add activity)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {!serverAuth ? (
            <Skeleton className="h-12 w-full rounded-lg" />
          ) : serverAuth.hasSession ? (
            <>
              {/* Token error banner */}
              {serverAuth.error === "RefreshTokenError" && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700">
                    <p className="font-semibold">Token expired and could not auto-refresh.</p>
                    <p>Click <strong>Reconnect Google</strong> below to restore sheet sync and add-activity access.</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">Connected</p>
                  <p className="text-xs text-gray-500">{serverAuth.user}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => signOut()}>
                    <LogOut className="w-3 h-3" /> Sign out
                  </Button>
                  <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => signIn("google", { callbackUrl: "/settings" })}>
                    <RefreshCw className="w-3 h-3" /> Reconnect
                  </Button>
                </div>
              </div>

              {/* Re-auth reminder */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <AlertCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-blue-700 leading-relaxed">
                  <p className="font-semibold mb-0.5">🔄 Re-authentication reminder</p>
                  <p>
                    Google access tokens auto-refresh silently every <strong>~1 hour</strong> in the background —
                    you normally never need to reconnect manually. However, if you see a sheet sync error,
                    click <strong>Reconnect</strong> above to force a fresh token with the latest permissions.
                    You may also need to reconnect if you haven&apos;t used the app for <strong>6+ months</strong>
                    or if Google revokes access.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <p className="font-semibold mb-0.5">Google account not connected</p>
                  <p>Required for Sheets sync and adding activities to Google Sheets. Your credentials are only used to access your connected sheets.</p>
                </div>
              </div>
              <Button className="gap-2 w-full" onClick={() => signIn("google", { callbackUrl: "/settings" })}>
                <LogIn className="w-4 h-4" />
                Connect with Google
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Highlight Fields Configuration ── */}
      <Card className="border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" /> Highlight Fields
              </CardTitle>
              <CardDescription className="text-xs">
                Customize which data fields are prominently displayed for each program
              </CardDescription>
            </div>
            <Link href="/settings/highlight-fields">
              <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Settings className="w-3.5 h-3.5" />
                Configure Fields
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <Tag className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700">
              <p className="font-semibold mb-1">Visual Data Showcase</p>
              <p>
                Control which metrics appear as colored badges in the activities list. 
                Different programs can highlight different data (e.g., participants, venues, systems installed).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Programs (CRUD) ── */}
      <AppPrograms />

      {/* ── Sheet Connections ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-green-600" /> Google Sheet Connections
              </CardTitle>
              <CardDescription className="text-xs">One sheet per program — used as the primary data source</CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline"
                className="h-7 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50"
                disabled={syncingAll}
                onClick={handleSyncAll}>
                <RefreshCw className={cn("w-3 h-3", syncingAll && "animate-spin")} />
                {syncingAll ? "Syncing all…" : "Sync All"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1 h-7"
                onClick={() => setShowGuide(v => !v)}>
                <BookOpen className="w-3.5 h-3.5" />
                {showGuide ? "Hide" : "Guide"}
              </Button>
            </div>
          </div>
          {syncAllResults && (
            <p className="text-xs text-green-700 mt-1 font-medium">{syncAllResults}</p>
          )}
        </CardHeader>

        {/* Setup Guide */}
        {showGuide && (
          <div className="mx-4 mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-800 space-y-3">
            <p className="font-semibold text-sm">📋 How to Set Up Your Google Sheet</p>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 1 — Create the sheet</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to <a href="https://sheets.google.com" target="_blank" rel="noopener" className="underline">sheets.google.com</a> → New spreadsheet</li>
                <li>Name the sheet <strong>Activities</strong> (the tab at the bottom)</li>
                <li>Add this header row in Row 1:</li>
              </ol>
            </div>

            <div className="bg-white rounded-lg border border-blue-200 p-3 font-mono text-[10px] overflow-x-auto">
              <p className="font-bold text-blue-700 mb-1">Row 1 headers (A → AD):</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[
                  ["A","Province *"],["B","LGU"],["C","Barangay"],
                  ["D","Year *"],["E","Month *"],["F","Activity Title *"],
                  ["G","Venue"],["H","Partner Organizations"],
                  ["I","Start Date *"],["J","End Date"],["K","Mode of Conduct"],
                  ["L","Personnel"],["M","NGA Male"],["N","NGA Female"],
                  ["O","LGU Male"],["P","LGU Female"],["Q","SUC Male"],
                  ["R","SUC Female"],["S","Others Male"],["T","Others Female"],
                  ["U","Others Label"],["V","After Activity Report"],["W","FB Posting Link"],
                  ["X","Raw Photos Link"],["Y","Testimonials Link"],["Z","Remarks"],
                  ["AA","Status"],["AB","Drive Folder Link"],
                ].map(([col, label]) => (
                  <p key={col}><span className="text-blue-600 font-bold">{col}:</span> {label}</p>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 2 — Fill data rows</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Province: exact name or code — <strong>Albay, Camarines Sur, CAS, ALB</strong></li>
                <li>Date format: <strong>MM/DD/YYYY</strong> (e.g. 03/15/2025)</li>
                <li>Mode: <strong>Face-to-face</strong>, <strong>Online</strong>, or <strong>Hybrid</strong></li>
                <li>Partners/Personnel: separate multiple with <strong>semicolons</strong></li>
                <li>Status (col AA): <strong>Completed</strong>, <strong>Ongoing</strong>, <strong>For Submission</strong>, <strong>Pending</strong>, or <strong>Cancelled</strong> — auto-mapped on sync</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 3 — Connect here</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Make sure your Google account is connected above</li>
                <li>Copy the full sheet URL from your browser</li>
                <li>Expand the program below, paste the URL, and click <strong>Connect</strong></li>
                <li>Click <strong>Sync</strong> to import the data</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">⚠ Sheet must be accessible</p>
              <p>The sheet must be accessible by your connected Google account. If you're syncing from a shared sheet, make sure your account has at least <strong>Viewer</strong> access.</p>
            </div>
          </div>
        )}

        <CardContent className="pt-0 space-y-2">
          {ACTIVE_PROGRAMS.map(p => (
            <ProjectSheetCard key={p.code} projectCode={p.code} />
          ))}
        </CardContent>
      </Card>

      {/* ── Sync Log ── */}
      <SyncLogCard />

      {/* ── Database Sync ── */}
      <DatabaseSyncCard />

      {/* ── Auto-Sync (service account) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-violet-600" /> Auto-Sync (Every 6 hours)
          </CardTitle>
          <CardDescription className="text-xs">Runs automatically via Convex cron — no user action needed</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-xl border border-violet-200 text-xs text-violet-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-violet-600" />
            <div className="space-y-1">
              <p className="font-semibold">Requires a Google Service Account</p>
              <p>The Convex cron runs server-side without a user session. It needs a service account to authenticate with Google Sheets.</p>
            </div>
          </div>
          <div className="text-xs space-y-2 text-gray-700">
            <p className="font-semibold">Setup steps:</p>
            <ol className="list-decimal list-inside space-y-1.5 ml-2">
              <li>
                In <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener" className="text-blue-600 underline">Google Cloud Console</a> → IAM &amp; Admin → Service Accounts → Create
              </li>
              <li>Name it (e.g. <code className="bg-gray-100 px-1 rounded">dict-r5-sheets-sync</code>), no special roles needed</li>
              <li>Actions → Manage Keys → Add Key → JSON → download the file</li>
              <li>Share each Google Sheet with the service account email (Viewer access)</li>
              <li>
                In <a href="https://dashboard.convex.dev" target="_blank" rel="noopener" className="text-blue-600 underline">Convex Dashboard</a> → your project → Settings → Environment Variables, add:
                <div className="mt-1 bg-gray-100 rounded-md p-2 font-mono text-[10px] space-y-0.5">
                  <p><span className="text-violet-700">GOOGLE_SERVICE_ACCOUNT_EMAIL</span> = service-account@project.iam.gserviceaccount.com</p>
                  <p><span className="text-violet-700">GOOGLE_SERVICE_ACCOUNT_KEY</span> = (paste the entire JSON key file content)</p>
                </div>
              </li>
              <li>Run <code className="bg-gray-100 px-1 rounded">npx convex deploy</code> — the cron will register automatically</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* ── Other config ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-orange-500">
                <path d="M13.5 1l-5 6H12v4L6.5 17H11v6l5.5-7H13v-4l5.5-6H15V1z"/>
              </svg>
              Convex Backend
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-600 space-y-1">
            <p>URL: <code className="bg-gray-100 px-1 rounded text-[10px]">NEXT_PUBLIC_CONVEX_URL</code></p>
            <p>Run <code className="bg-gray-100 px-1 rounded text-[10px]">npx convex dev</code> during development.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Mapbox
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-600 space-y-1">
            <p>Token: <code className="bg-gray-100 px-1 rounded text-[10px]">NEXT_PUBLIC_MAPBOX_TOKEN</code></p>
            <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener"
              className="text-blue-600 flex items-center gap-1 hover:underline">
              Get token <ExternalLink className="w-3 h-3" />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
