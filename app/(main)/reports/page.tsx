"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet, RefreshCw, Plus, Trash2, CheckCircle2, AlertCircle,
  Copy, Download, ExternalLink, FileText, ChevronDown, ChevronUp,
  Wifi, WifiOff, Clock, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn, formatDate, numberWithCommas } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR, MONTHS } from "@/lib/types";
import { generateGASTemplate, getColumnGuide } from "@/lib/gas-template";
import { toast } from "sonner";

// ---- Types ----
interface ConnectionWithProject {
  _id: string;
  projectId: string;
  sheetId: string;
  sheetUrl: string;
  sheetName: string;
  webhookSecret: string;
  syncEnabled: boolean;
  lastSyncAt?: number;
  lastSyncStatus?: string;
  lastSyncRowCount?: number;
  lastSyncError?: string;
  createdAt: number;
  project?: { _id: string; code: string; shortName: string; name: string; color: string } | null;
}

// ---- Main Page ----
export default function ReportsPage() {
  return (
    <div className="space-y-0">
      <Tabs defaultValue="sheets">
        <TabsList className="mb-6">
          <TabsTrigger value="sheets" className="gap-2">
            <Sheet className="w-4 h-4" /> Google Sheets (Primary Data)
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileText className="w-4 h-4" /> PDF Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sheets">
          <SheetsTab />
        </TabsContent>

        <TabsContent value="reports">
          <PDFTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// GOOGLE SHEETS TAB — primary data management
// ============================================================
function SheetsTab() {
  const connections = useQuery(api.sheetsSync.listConnections, {});
  const syncLog = useQuery(api.sheetsSync.getSyncLog, { limit: 10 });
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [scriptConn, setScriptConn] = useState<ConnectionWithProject | null>(null);

  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
  const webhookBase = convexSiteUrl ? `${convexSiteUrl}/api/sheets-sync` : "Configure NEXT_PUBLIC_CONVEX_SITE_URL";

  return (
    <div className="page-content space-y-6">
      {/* Architecture explanation */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Google Sheets is the Primary Data Source</p>
              <p className="text-sm text-blue-700 mt-1">
                Connect your tracking sheet below. When staff edit the sheet, data automatically syncs
                to the database and this website in real-time via a Google Apps Script webhook.
                No manual exports needed.
              </p>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-blue-700">
                <span className="flex items-center gap-1"><span className="font-bold">1.</span> Connect sheet URL below</span>
                <span className="flex items-center gap-1"><span className="font-bold">2.</span> Copy & install the Apps Script</span>
                <span className="flex items-center gap-1"><span className="font-bold">3.</span> Run &#34;Install Trigger&#34; once</span>
                <span className="flex items-center gap-1"><span className="font-bold">4.</span> Edits auto-sync from that point</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected sheets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Connected Sheets</h2>
            <p className="text-xs text-gray-500 mt-0.5">{connections?.length ?? 0} sheet(s) connected</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowConnectForm(v => !v)}>
            <Plus className="w-4 h-4" />
            Connect Sheet
          </Button>
        </div>

        {showConnectForm && (
          <div className="mb-4">
            <ConnectSheetForm
              webhookBase={webhookBase}
              onSaved={() => setShowConnectForm(false)}
            />
          </div>
        )}

        {!connections ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : connections.length === 0 && !showConnectForm ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sheet className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 mb-3">No sheets connected yet.</p>
              <Button size="sm" onClick={() => setShowConnectForm(true)} className="gap-1.5">
                <Plus className="w-4 h-4" /> Connect Your First Sheet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <SheetConnectionCard
                key={conn._id}
                conn={conn as ConnectionWithProject}
                webhookUrl={webhookBase}
                onShowScript={() => setScriptConn(conn as ConnectionWithProject)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Apps Script setup modal */}
      {scriptConn && (
        <GASSetupModal
          conn={scriptConn}
          webhookUrl={webhookBase}
          onClose={() => setScriptConn(null)}
        />
      )}

      <Separator />

      {/* Sync log */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Sync History</h2>
        {!syncLog || syncLog.length === 0 ? (
          <p className="text-sm text-gray-400">No sync history yet. Connect a sheet to get started.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {syncLog.map(log => (
              <div key={log._id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50">
                {log.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : log.status === "partial" ? (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {log.projectName} — {log.syncDirection === "import" ? "Sheet → DB" : "DB → Sheet"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {log.rowsAffected} rows · {formatDate(new Date(log.syncedAt).toISOString(), "MMM d, yyyy h:mm a")}
                    {log.errorMessage && <span className="text-red-500 ml-2">{log.errorMessage}</span>}
                  </p>
                </div>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                  log.status === "success" ? "bg-green-100 text-green-700" :
                  log.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                )}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column guide */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Required Sheet Column Format</h2>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-3">
              Your Google Sheet must have these columns in order (Row 1 = headers, data starts Row 2).
              Column letters must match exactly — you can rename the headers but not reorder them without updating the script.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {getColumnGuide().map(col => (
                <div key={col.col} className="flex items-start gap-2 text-xs">
                  <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{col.col}</span>
                  <div>
                    <p className="font-medium text-gray-800">{col.field}</p>
                    <p className="text-gray-400">{col.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---- Connect Sheet Form ----
function ConnectSheetForm({ webhookBase, onSaved }: { webhookBase: string; onSaved: () => void }) {
  const projects = useQuery(api.projects.list, { isActive: true });
  const saveConnection = useMutation(api.sheetsSync.saveConnection);

  const [projectId, setProjectId] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Activities");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ webhookSecret: string; sheetId: string } | null>(null);

  async function handleSave() {
    if (!projectId || !sheetUrl) {
      toast.error("Select a program and enter the sheet URL.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveConnection({
        projectId: projectId as any,
        sheetUrl,
        sheetName,
        syncEnabled: true,
        createdBy: "system",
      });
      setResult(res as any);
      toast.success("Sheet connected! Copy the Apps Script below to finish setup.");
      onSaved();
    } catch (e) {
      toast.error("Failed to connect: " + String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Connect a Google Sheet</CardTitle>
        <CardDescription>One sheet per program. Changes in the sheet will auto-sync to the database.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Program <span className="text-red-500">*</span></Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select program…" /></SelectTrigger>
              <SelectContent>
                {DICT_PROJECTS.map(p => <SelectItem key={p.code} value={p.code}>{p.shortName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sheet Tab Name</Label>
            <Input value={sheetName} onChange={e => setSheetName(e.target.value)} placeholder="Activities" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Google Sheet URL <span className="text-red-500">*</span></Label>
            <Input
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
            />
            <p className="text-xs text-gray-400">Full URL from your browser&apos;s address bar when the sheet is open.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Connecting…" : "Connect Sheet"}
          </Button>
          <Button variant="outline" onClick={onSaved}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Connection Card ----
function SheetConnectionCard({
  conn, webhookUrl, onShowScript,
}: {
  conn: ConnectionWithProject;
  webhookUrl: string;
  onShowScript: () => void;
}) {
  const deleteConnection = useMutation(api.sheetsSync.deleteConnection);
  const toggleSync = useMutation(api.sheetsSync.toggleSync);
  const bulkUpsert = useMutation(api.sheetsSync.bulkUpsertFromSheets);
  const provinces = useQuery(api.provinces.list, {});
  const allLGUs = useQuery(api.provinces.allLGUs, {});
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const def = DICT_PROJECTS.find(p => p.code === conn.project?.code);

  async function handleManualSync() {
    const token = window.prompt(
      "Enter your Google OAuth access token to read the sheet.\n\n" +
      "Get one from: https://developers.google.com/oauthplayground\n" +
      "(Authorize scope: https://www.googleapis.com/auth/spreadsheets.readonly)"
    );
    if (!token) return;
    setSyncing(true);
    try {
      const { importFromGoogleSheet } = await import("@/lib/google-sheets");
      const project = conn.project;
      if (!project) throw new Error("No project linked");

      const { rows, errors } = await importFromGoogleSheet({
        sheetId: conn.sheetId,
        sheetName: conn.sheetName,
        projectCode: project.code,
        accessToken: token,
        defaultYear: CURRENT_YEAR,
      });

      if (rows.length === 0) {
        toast.warning("No data rows found in sheet.");
        return;
      }

      // Resolve province/LGU IDs
      const mappedRows = rows.map(row => {
        const province = provinces?.find(p =>
          p.name.toLowerCase() === row.provinceName.toLowerCase() ||
          p.code.toLowerCase() === row.provinceName.toLowerCase()
        );
        if (!province) return null;
        const lgu = row.lguName
          ? allLGUs?.find(l =>
              l.provinceId === province._id &&
              l.name.toLowerCase().includes(row.lguName!.toLowerCase())
            )
          : null;
        return {
          provinceId: province._id as any,
          lguId: lgu?._id as any,
          month: row.month,
          year: row.year,
          activityTitle: row.activityTitle,
          venue: row.venue,
          partnerOrganizations: row.partnerOrganizations,
          startDate: row.startDate,
          endDate: row.endDate,
          modeOfConduct: row.modeOfConduct,
          personnelRaw: row.personnelRaw,
          participants: row.participants as any,
          afterActivityReport: row.afterActivityReport,
          fbPostingLink: row.fbPostingLink,
          rawPhotosLink: row.rawPhotosLink,
          remarks: row.remarks,
          extraFields: row.extraFields ? JSON.stringify(row.extraFields) : undefined,
          status: row.status,
        };
      }).filter(Boolean) as any[];

      const result = await bulkUpsert({
        projectId: conn.projectId as any,
        sheetId: conn.sheetId,
        rows: mappedRows,
        syncedBy: "manual_sync",
      });

      toast.success(`Sync complete! ${result.inserted} inserted, ${result.updated} updated.`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} rows had errors.`);
      }
    } catch (e) {
      toast.error("Sync failed: " + String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove connection to "${conn.sheetName}" for ${conn.project?.shortName}?`)) return;
    await deleteConnection({ id: conn._id as any });
    toast.success("Connection removed.");
  }

  async function handleToggle() {
    await toggleSync({ id: conn._id as any, enabled: !conn.syncEnabled });
    toast.success(conn.syncEnabled ? "Sync paused." : "Sync enabled.");
  }

  return (
    <Card className={cn("transition-all", conn.syncEnabled ? "border-green-200" : "border-gray-200 opacity-75")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Program icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `${def?.color ?? "#6b7280"}18` }}>
            <Sheet className="w-5 h-5" style={{ color: def?.color ?? "#6b7280" }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{conn.project?.shortName ?? "?"}</p>
              <span className="text-gray-300">·</span>
              <p className="text-sm text-gray-600 truncate max-w-[280px]">{conn.sheetName}</p>
              <a href={conn.sheetUrl} target="_blank" rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span className={cn("flex items-center gap-1 font-medium",
                conn.syncEnabled ? "text-green-600" : "text-gray-400")}>
                {conn.syncEnabled ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {conn.syncEnabled ? "Auto-sync on" : "Sync paused"}
              </span>
              {conn.lastSyncAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last sync: {formatDate(new Date(conn.lastSyncAt).toISOString(), "MMM d, h:mm a")}
                  {conn.lastSyncRowCount !== undefined && ` (${conn.lastSyncRowCount} rows)`}
                </span>
              )}
              {conn.lastSyncStatus === "partial" && conn.lastSyncError && (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {conn.lastSyncError}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={handleManualSync} disabled={syncing}>
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync Now"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={onShowScript}>
              <Copy className="w-3.5 h-3.5" /> Apps Script
            </Button>
            <Button size="sm" variant="ghost"
              className={cn("text-xs", conn.syncEnabled ? "text-amber-600" : "text-green-600")}
              onClick={handleToggle}>
              {conn.syncEnabled ? "Pause" : "Enable"}
            </Button>
            <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setExpanded(v => !v)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Expanded: webhook details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook URL (configure in Apps Script)</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="font-mono text-xs bg-gray-50"
                />
                <Button size="icon" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success("Webhook URL copied!");
                }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook Secret (configure in Apps Script)</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={conn.webhookSecret}
                  className="font-mono text-xs bg-gray-50"
                  type="password"
                />
                <Button size="icon" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(conn.webhookSecret);
                  toast.success("Secret copied!");
                }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sheet ID</Label>
              <Input readOnly value={conn.sheetId} className="font-mono text-xs bg-gray-50" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Apps Script Setup Modal ----
function GASSetupModal({
  conn, webhookUrl, onClose,
}: {
  conn: ConnectionWithProject;
  webhookUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const script = generateGASTemplate({
    webhookUrl,
    webhookSecret: conn.webhookSecret,
    sheetId: conn.sheetId,
    projectCode: conn.project?.code ?? "UNKNOWN",
    sheetName: conn.sheetName,
    year: CURRENT_YEAR,
  });

  function copyScript() {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success("Script copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  }

  function downloadScript() {
    const blob = new Blob([script], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DICT_PMS_${conn.project?.code ?? "sync"}_script.gs`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Google Apps Script Setup</h2>
            <p className="text-sm text-gray-500 mt-1">
              Install this script in your sheet to enable automatic sync on edit.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Step by step */}
          <ol className="space-y-2 text-sm">
            {[
              { n: 1, text: "Open your Google Sheet" },
              { n: 2, text: 'Click Extensions > Apps Script' },
              { n: 3, text: "Delete any existing code and paste the script below" },
              { n: 4, text: 'Click Save (💾), then run the installTrigger() function once' },
              { n: 5, text: 'Grant permissions when prompted — edits will now auto-sync!' },
            ].map(step => (
              <li key={step.n} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  {step.n}
                </span>
                <span className="text-gray-700">{step.text}</span>
              </li>
            ))}
          </ol>

          <div className="flex gap-2">
            <Button className="gap-1.5 flex-1" onClick={copyScript}>
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Script"}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={downloadScript}>
              <Download className="w-4 h-4" /> Download .gs
            </Button>
          </div>

          {/* Script preview */}
          <div className="relative">
            <pre className="bg-gray-950 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto max-h-96 font-mono leading-relaxed">
              {script}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PDF TAB - Enhanced with Charts and Visualizations
// ============================================================
function PDFTab() {
  const [projectCode, setProjectCode] = useState<string>("all");
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [monthFrom, setMonthFrom] = useState<string>("1");
  const [monthTo, setMonthTo] = useState<string>("12");
  const [generating, setGenerating] = useState(false);

  const selectedProject = useQuery(
    api.projects.getByCode,
    projectCode !== "all" ? { code: projectCode } : "skip"
  );
  const provinces = useQuery(api.provinces.list, {});
  const activities = useQuery(api.activities.listActivities, {
    projectId: selectedProject?._id ?? undefined,
    year: Number(year),
  });

  const filtered = activities?.filter(a => {
    const m = a.month;
    return m >= Number(monthFrom) && m <= Number(monthTo);
  }) ?? [];

  const def = DICT_PROJECTS.find(p => p.code === projectCode);
  const totalPax = filtered.reduce((sum, a) =>
    sum + a.participants.nga.male + a.participants.nga.female +
    a.participants.lgu.male + a.participants.lgu.female +
    a.participants.suc.male + a.participants.suc.female +
    a.participants.others.male + a.participants.others.female, 0);

  // Calculate analytics
  const provinceCount = new Set(filtered.map(a => a.provinceId)).size;
  const completedCount = filtered.filter(a => a.status === "completed").length;
  const completionRate = filtered.length > 0 ? (completedCount / filtered.length) * 100 : 0;

  // Monthly breakdown
  const monthlyData = MONTHS.map((monthName, idx) => {
    const monthNum = idx + 1;
    const monthActivities = filtered.filter(a => a.month === monthNum);
    const monthPax = monthActivities.reduce((sum, a) =>
      sum + a.participants.nga.male + a.participants.nga.female +
      a.participants.lgu.male + a.participants.lgu.female +
      a.participants.suc.male + a.participants.suc.female +
      a.participants.others.male + a.participants.others.female, 0);
    return {
      month: monthName.substring(0, 3),
      activities: monthActivities.length,
      participants: monthPax,
    };
  }).filter(d => d.activities > 0 || d.participants > 0);

  // Province breakdown
  const provinceData = provinces?.map(prov => {
    const provActivities = filtered.filter(a => a.provinceId === prov._id);
    const provPax = provActivities.reduce((sum, a) =>
      sum + a.participants.nga.male + a.participants.nga.female +
      a.participants.lgu.male + a.participants.lgu.female +
      a.participants.suc.male + a.participants.suc.female +
      a.participants.others.male + a.participants.others.female, 0);
    return {
      name: prov.name,
      activities: provActivities.length,
      participants: provPax,
    };
  }).filter(d => d.activities > 0).sort((a, b) => b.activities - a.activities) ?? [];

  // Participant type breakdown
  const participantTypes = [
    {
      type: "NGA",
      male: filtered.reduce((sum, a) => sum + a.participants.nga.male, 0),
      female: filtered.reduce((sum, a) => sum + a.participants.nga.female, 0),
      color: "#3b82f6",
    },
    {
      type: "LGU",
      male: filtered.reduce((sum, a) => sum + a.participants.lgu.male, 0),
      female: filtered.reduce((sum, a) => sum + a.participants.lgu.female, 0),
      color: "#10b981",
    },
    {
      type: "SUC",
      male: filtered.reduce((sum, a) => sum + a.participants.suc.male, 0),
      female: filtered.reduce((sum, a) => sum + a.participants.suc.female, 0),
      color: "#f59e0b",
    },
    {
      type: "Others",
      male: filtered.reduce((sum, a) => sum + a.participants.others.male, 0),
      female: filtered.reduce((sum, a) => sum + a.participants.others.female, 0),
      color: "#8b5cf6",
    },
  ];

  const totalMale = participantTypes.reduce((sum, p) => sum + p.male, 0);
  const totalFemale = participantTypes.reduce((sum, p) => sum + p.female, 0);

  async function handleGeneratePDF() {
    if (filtered.length === 0) { toast.error("No activities in selection."); return; }
    setGenerating(true);
    try {
      const { generatePDFReport } = await import("@/lib/pdf-report");
      const exportActivities = filtered.map(a => ({
        _id: a._id,
        month: a.month,
        year: a.year,
        provinceName: provinces?.find(p => p._id === a.provinceId)?.name ?? "",
        activityTitle: a.activityTitle,
        venue: a.venue,
        partnerOrganizations: a.partnerOrganizations,
        startDate: a.startDate,
        endDate: a.endDate,
        modeOfConduct: a.modeOfConduct,
        personnelRaw: a.personnelRaw,
        participants: a.participants,
        status: a.status,
        afterActivityReport: a.afterActivityReport,
        fbPostingLink: a.fbPostingLink,
        remarks: a.remarks,
        extraFields: a.extraFields,
      }));
      const result = await generatePDFReport({
        title: def ? `${def.name} Report` : "Consolidated Activity Report",
        subtitle: "DICT Region V – Bicol",
        projectCode: projectCode !== "all" ? projectCode : undefined,
        fy: `FY ${year}`,
        periodLabel: `${MONTHS[Number(monthFrom) - 1]} – ${MONTHS[Number(monthTo) - 1]} ${year}`,
        activities: exportActivities,
        generatedBy: "DICT Region V PMS",
        generatedAt: new Date(),
      });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded!");
    } catch (e) {
      toast.error("PDF failed: " + String(e));
    } finally {
      setGenerating(false);
    }
  }

  const maxMonthActivities = Math.max(...monthlyData.map(d => d.activities), 1);
  const maxMonthPax = Math.max(...monthlyData.map(d => d.participants), 1);
  const maxProvinceActivities = Math.max(...provinceData.map(d => d.activities), 1);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure Report</CardTitle>
          <CardDescription>Generate a PDF report for any program, province, and period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Program</Label>
              <Select value={projectCode} onValueChange={setProjectCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {DICT_PROJECTS.map(p => <SelectItem key={p.code} value={p.code}>{p.shortName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fiscal Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Month From</Label>
              <Select value={monthFrom} onValueChange={setMonthFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Month To</Label>
              <Select value={monthTo} onValueChange={setMonthTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Activities</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{filtered.length}</p>
                <p className="text-xs text-blue-500 mt-1">
                  {completedCount} completed
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Participants</p>
                <p className="text-3xl font-bold text-green-900 mt-2">{numberWithCommas(totalPax)}</p>
                <p className="text-xs text-green-500 mt-1">
                  {totalMale}M / {totalFemale}F
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Completion Rate</p>
                <p className="text-3xl font-bold text-purple-900 mt-2">{completionRate.toFixed(0)}%</p>
                <p className="text-xs text-purple-500 mt-1">
                  {completedCount} of {filtered.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Provinces Covered</p>
                <p className="text-3xl font-bold text-orange-900 mt-2">{provinceCount}</p>
                <p className="text-xs text-orange-500 mt-1">
                  of 6 provinces
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">📍</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Activity Trend</CardTitle>
          <CardDescription>Activities and participants over time</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p>No data for selected period</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Activities Chart */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-3">Activities per Month</p>
                <div className="space-y-2">
                  {monthlyData.map((d, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-8">{d.month}</span>
                      <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                          style={{ width: `${(d.activities / maxMonthActivities) * 100}%` }}
                        >
                          {d.activities > 0 && (
                            <span className="text-xs font-bold text-white">{d.activities}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Participants Chart */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-3">Participants per Month</p>
                <div className="space-y-2">
                  {monthlyData.map((d, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-8">{d.month}</span>
                      <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                          style={{ width: `${(d.participants / maxMonthPax) * 100}%` }}
                        >
                          {d.participants > 0 && (
                            <span className="text-xs font-bold text-white">{numberWithCommas(d.participants)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row 2: Province Distribution & Participant Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Province Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activities by Province</CardTitle>
            <CardDescription>Geographic distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {provinceData.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p>No data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {provinceData.map((d, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{d.name}</span>
                      <span className="text-sm font-bold text-gray-900">{d.activities}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${(d.activities / maxProvinceActivities) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{numberWithCommas(d.participants)} participants</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participant Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participants by Type</CardTitle>
            <CardDescription>Breakdown by organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {participantTypes.map((p, idx) => {
                const total = p.male + p.female;
                const percentage = totalPax > 0 ? (total / totalPax) * 100 : 0;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{p.type}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{numberWithCommas(total)}</p>
                        <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: p.color,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                      <span>👨 {numberWithCommas(p.male)} Male</span>
                      <span>👩 {numberWithCommas(p.female)} Female</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gender Summary */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-600 mb-3">Overall Gender Distribution</p>
              <div className="flex gap-2">
                <div className="flex-1 h-12 bg-blue-100 rounded-lg flex flex-col items-center justify-center">
                  <p className="text-lg font-bold text-blue-900">{numberWithCommas(totalMale)}</p>
                  <p className="text-xs text-blue-600">Male ({((totalMale / totalPax) * 100).toFixed(1)}%)</p>
                </div>
                <div className="flex-1 h-12 bg-pink-100 rounded-lg flex flex-col items-center justify-center">
                  <p className="text-lg font-bold text-pink-900">{numberWithCommas(totalFemale)}</p>
                  <p className="text-xs text-pink-600">Female ({((totalFemale / totalPax) * 100).toFixed(1)}%)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Download Button */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Ready to generate your report?</p>
              <p className="text-sm text-gray-600 mt-1">
                Download a comprehensive PDF with all activities and details
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={handleGeneratePDF}
              disabled={generating || filtered.length === 0}
            >
              {generating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download PDF Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
