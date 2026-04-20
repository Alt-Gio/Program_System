"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";

// ============================================================
// Dual-Database Sync Control Center
// Dedicated page wrapping /api/test-sync + /api/sync-trigger
// Covers: DTC Logbook, DICT_Program (activities), Intern Sheet,
//         Attendance Log, Sync Status Sheet
// ============================================================

type LogStatus = "ok" | "error" | "pending" | "info";
type LogEntry = {
  time: string;
  action: string;
  status: LogStatus;
  message: string;
  data?: unknown;
};

type TestSyncResponse = {
  success?: boolean;
  ok?: boolean;
  action?: string;
  message?: string;
  error?: string;
  [k: string]: unknown;
};

export default function TestSyncPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [stats, setStats] = useState<TestSyncResponse | null>(null);
  const [internCheck, setInternCheck] = useState<TestSyncResponse | null>(null);

  // Reactive Convex queries — kept live so the page reflects sync results
  const todayStats = useQuery(api.auditLog.getTodayStats);
  const syncStatuses = useQuery(api.syncMonitor.getAll);
  const recentActivity = useQuery(api.auditLog.getRecentActivity, { limit: 15 });
  const pendingCounts = useQuery(api.attendanceSync.countPendingPublic, {});
  const internConn = useQuery(api.internSheetsSync.getInternConnection, {});
  const internSyncLog = useQuery(api.internSheetsSync.getInternSyncLog, { limit: 5 });

  function addLog(action: string, status: LogStatus, message: string, data?: unknown) {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString(), action, status, message, data },
      ...prev.slice(0, 99),
    ]);
  }

  async function runTestSync(action: string): Promise<TestSyncResponse | null> {
    setRunning(action);
    addLog(action, "pending", "POST /api/test-sync...");
    try {
      const resp = await fetch("/api/test-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: TestSyncResponse = await resp.json();
      const ok = data.success ?? data.ok ?? false;
      addLog(action, ok ? "ok" : "error", data.message ?? data.error ?? (ok ? "done" : "failed"), data);
      return data;
    } catch (e) {
      addLog(action, "error", String(e));
      return null;
    } finally {
      setRunning(null);
    }
  }

  async function runSyncTrigger(target: string) {
    setRunning(target);
    addLog(target, "pending", "POST /api/sync-trigger...");
    try {
      const resp = await fetch("/api/sync-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data: TestSyncResponse = await resp.json();
      addLog(target, data.ok ? "ok" : "error", data.message ?? "done", data);
    } catch (e) {
      addLog(target, "error", String(e));
    } finally {
      setRunning(null);
    }
  }

  async function refreshStats() {
    const data = await runTestSync("stats");
    if (data) setStats(data);
  }

  async function checkInternSync() {
    const data = await runTestSync("testInternSync");
    if (data) setInternCheck(data);
  }

  // Auto-load stats once on mount
  useEffect(() => {
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPending =
    (pendingCounts?.attendance ?? 0) +
    (pendingCounts?.dtcLogs ?? 0) +
    (pendingCounts?.auditLogs ?? 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Dual-Database Sync Control Center
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                End-to-end verification: Convex ↔ Google Sheets across DTC, Activities, Interns, Attendance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill color="blue">DICT_Attendance_Log</Pill>
              <Pill color="green">DICT_DTC_Logbook</Pill>
              <Pill color="purple">DICT_Sync_Status</Pill>
              <Pill color="amber">DICT_Program (Activities)</Pill>
              <Pill color="rose">INTERN Sheet</Pill>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Intern Check-ins" value={todayStats?.internCheckIns ?? "—"} color="emerald" />
          <StatCard label="DTC Clients" value={todayStats?.dtcCheckIns ?? "—"} color="blue" />
          <StatCard label="Audit Events" value={todayStats?.totalEvents ?? "—"} color="purple" />
          <StatCard label="Pending Attendance" value={pendingCounts?.attendance ?? "—"} color="amber" />
          <StatCard label="Pending DTC" value={pendingCounts?.dtcLogs ?? "—"} color="orange" />
          <StatCard label="Total Pending" value={totalPending || "0"} color="rose" />
        </div>

        {/* ── Section 1: Connectivity ────────────────────────── */}
        <Section title="1. Connectivity & Setup" desc="Verify service-account access and sheet tabs exist.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ActionButton
              label="Health Check"
              desc="Verify JWT + read access to all 5 sheets"
              onClick={() => runSyncTrigger("health")}
              loading={running === "health"}
              color="blue"
            />
            <ActionButton
              label="Setup Tabs"
              desc="Auto-create missing tabs (Attendance, AuditTrail, Logbook, Status)"
              onClick={() => runSyncTrigger("setupTabs")}
              loading={running === "setupTabs"}
              color="gray"
            />
            <ActionButton
              label="Refresh Full Stats"
              desc="Comprehensive snapshot via /api/test-sync stats"
              onClick={refreshStats}
              loading={running === "stats"}
              color="indigo"
            />
          </div>
        </Section>

        {/* ── Section 2: Sample data creation ────────────────── */}
        <Section title="2. Create Sample Data" desc="Inserts Convex records with syncedToSheets=false so you can watch the pipeline flush.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionButton
              label="Create Sample DTC Log"
              desc="Pushes via 5-min cron or manual Sync DTC below"
              onClick={() => runTestSync("createSampleDTC")}
              loading={running === "createSampleDTC"}
              color="green"
            />
            <ActionButton
              label="Create Sample Activity"
              desc="Requires seeded projects & provinces; cron pushes in 15m"
              onClick={() => runTestSync("createSampleActivity")}
              loading={running === "createSampleActivity"}
              color="amber"
            />
          </div>
        </Section>

        {/* ── Section 3: Manual sync triggers ────────────────── */}
        <Section title="3. Manual Sync Triggers" desc="Force-run each pipeline immediately rather than waiting for the cron.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ActionButton
              label="Sync DTC → Sheets"
              desc="Push pending DTC logs to DICT_DTC_Logbook"
              onClick={() => runSyncTrigger("syncDTC")}
              loading={running === "syncDTC"}
              color="purple"
            />
            <ActionButton
              label="Sync Attendance → Sheets"
              desc="Push pending attendance + audit trail"
              onClick={() => runSyncTrigger("syncAttendance")}
              loading={running === "syncAttendance"}
              color="orange"
            />
            <ActionButton
              label="Sync Activities → Sheets"
              desc="Push pending activities to project sheets (DICT_Program)"
              onClick={() => runTestSync("triggerActivitySync")}
              loading={running === "triggerActivitySync"}
              color="amber"
            />
            <ActionButton
              label="Pull Interns ← Sheets"
              desc="Import intern roster from INTERN sheet into Convex"
              onClick={() => runTestSync("triggerInternSync")}
              loading={running === "triggerInternSync"}
              color="rose"
            />
            <ActionButton
              label="Update Status Sheet"
              desc="Write sync dashboard to DICT_Sync_Status"
              onClick={() => runSyncTrigger("syncStatusSheet")}
              loading={running === "syncStatusSheet"}
              color="indigo"
            />
            <ActionButton
              label="Run ALL Syncs"
              desc="DTC + Attendance + Activities + Interns + Status"
              onClick={() => runTestSync("triggerAll")}
              loading={running === "triggerAll"}
              color="blue"
            />
          </div>
        </Section>

        {/* ── Section 4: Intern sync inspector ────────────────── */}
        <Section title="4. Intern Sync Inspector" desc="Confirms the INTERN sheet connection, recent sync logs, and sample intern records.">
          <div className="flex items-center gap-3 mb-4">
            <ActionButton
              label="Inspect Intern Sync"
              desc="Calls testInternSync on /api/test-sync"
              onClick={checkInternSync}
              loading={running === "testInternSync"}
              color="rose"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Intern Sheet Connection (live)</h3>
              {internConn ? (
                <dl className="space-y-1">
                  <Row k="Sheet ID" v={internConn.sheetId} mono />
                  <Row k="Sync enabled" v={internConn.syncEnabled ? "yes" : "no"} />
                  <Row k="Last sync" v={internConn.lastSyncAt ? new Date(internConn.lastSyncAt).toLocaleString() : "Never"} />
                  <Row k="Status" v={internConn.lastSyncStatus ?? "—"} />
                  <Row k="Last row count" v={String(internConn.lastSyncRowCount ?? 0)} />
                </dl>
              ) : (
                <p className="text-gray-500">No connection configured. Set one up in the Interns admin page first.</p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Recent Intern Sync Logs</h3>
              {internSyncLog && internSyncLog.length > 0 ? (
                <ul className="space-y-1 text-xs font-mono">
                  {internSyncLog.map((l) => (
                    <li key={l._id} className="flex gap-2">
                      <span className={l.status === "success" ? "text-green-600" : "text-red-600"}>
                        [{l.status}]
                      </span>
                      <span>{l.syncDirection}</span>
                      <span className="text-gray-500">{l.rowsAffected ?? 0} rows</span>
                      <span className="text-gray-400">{new Date(l.syncedAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No sync log entries yet.</p>
              )}
            </div>
          </div>

          {internCheck && (
            <pre className="mt-4 text-xs bg-gray-900 text-green-200 p-4 rounded-lg overflow-x-auto max-h-64">
              {JSON.stringify(internCheck, null, 2)}
            </pre>
          )}
        </Section>

        {/* ── Section 5: Live sync status ─────────────────────── */}
        <Section title="5. Live Sync Status (Convex syncMonitor)" desc="Reactive view of each pipeline's last run.">
          {!syncStatuses || syncStatuses.length === 0 ? (
            <p className="text-sm text-gray-500">No sync status data yet. Run a sync action to populate.</p>
          ) : (
            <div className="space-y-2">
              {syncStatuses.map((s) => (
                <div key={s._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${
                    s.status === "success" ? "bg-green-500" :
                    s.status === "error" ? "bg-red-500" :
                    s.status === "syncing" ? "bg-blue-500 animate-pulse" :
                    "bg-gray-300"
                  }`} />
                  <span className="font-medium text-sm flex-1">{s.sheetName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.status === "success" ? "bg-green-100 text-green-700" :
                    s.status === "error" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{s.status}</span>
                  {s.recordsSynced != null && (
                    <span className="text-xs text-gray-500">{s.recordsSynced} synced</span>
                  )}
                  {s.totalPending != null && s.totalPending > 0 && (
                    <span className="text-xs text-amber-600 font-medium">{s.totalPending} pending</span>
                  )}
                  {s.lastError && (
                    <span className="text-xs text-red-500 max-w-xs truncate" title={s.lastError}>
                      {s.lastError}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Section 6: Comprehensive stats ──────────────────── */}
        {stats && (
          <Section title="6. Comprehensive Stats Snapshot" desc="Most recent /api/test-sync stats response.">
            <pre className="text-xs bg-gray-900 text-green-200 p-4 rounded-lg overflow-x-auto max-h-96">
              {JSON.stringify(stats, null, 2)}
            </pre>
          </Section>
        )}

        {/* ── Section 7: Audit trail ──────────────────────────── */}
        <Section title="7. Recent Audit Trail (live)" desc="Reactive feed from convex/auditLog.">
          {!recentActivity || recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500">No audit entries yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {recentActivity.map((a) => (
                <div key={a._id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-sm">
                  <span className={`w-2 h-2 rounded-full ${
                    a.type.includes("CHECKIN") ? "bg-green-400" : "bg-amber-400"
                  }`} />
                  <span className="font-mono text-xs text-gray-400 w-20">{a.timestamp.slice(11, 19)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    a.type.startsWith("INTERN") ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                  }`}>{a.type}</span>
                  <span className="flex-1 truncate">{a.userName}</span>
                  <span className="text-xs text-gray-400">{a.method ?? ""}</span>
                  <span className={`text-xs ${a.syncedToSheets ? "text-green-500" : "text-amber-500"}`}>
                    {a.syncedToSheets ? "✓ synced" : "⏳ pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Section 8: Test log output ──────────────────────── */}
        <div className="bg-gray-900 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-green-400">Test Log</h2>
            <button
              onClick={() => setLogs([])}
              className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
            >
              Clear
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm">Run a test action to see results here…</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-gray-500 shrink-0">{log.time}</span>
                  <span className={`shrink-0 ${
                    log.status === "ok" ? "text-green-400" :
                    log.status === "error" ? "text-red-400" :
                    log.status === "pending" ? "text-yellow-400" :
                    "text-blue-400"
                  }`}>[{log.status.toUpperCase()}]</span>
                  <span className="text-blue-300 shrink-0">{log.action}:</span>
                  <span className="text-gray-300 flex-1 break-words">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cron reference */}
        <Section title="Cron Schedule Reference" desc="From convex/crons.ts — syncs auto-run even without button clicks.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <CronRow name="DTC Logs → Sheets" freq="every 5 min" />
            <CronRow name="Attendance → Sheets" freq="every 5 min" />
            <CronRow name="Activities → Project Sheets" freq="every 15 min" />
            <CronRow name="Intern Sheet → Convex" freq="every 15 min" />
            <CronRow name="All Sheets → Convex (import)" freq="every 15 min" />
            <CronRow name="Sync Status Sheet" freq="every 30 min" />
            <CronRow name="Health Check" freq="every 1 hour" />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────

function Section({
  title, desc, children,
}: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      {desc && <p className="text-sm text-gray-500 mb-4 mt-0.5">{desc}</p>}
      <div className={desc ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${map[color] ?? map.blue}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
    amber: "border-amber-200 bg-amber-50",
    orange: "border-orange-200 bg-orange-50",
    rose: "border-rose-200 bg-rose-50",
    gray: "border-gray-200 bg-gray-50",
  };
  return (
    <div className={`rounded-xl border-2 p-4 ${colorMap[color] ?? colorMap.gray}`}>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function ActionButton({
  label, desc, onClick, loading, color,
}: {
  label: string; desc: string; onClick: () => void; loading: boolean; color: string;
}) {
  const colorMap: Record<string, string> = {
    green: "bg-green-600 hover:bg-green-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    purple: "bg-purple-600 hover:bg-purple-700",
    orange: "bg-orange-600 hover:bg-orange-700",
    indigo: "bg-indigo-600 hover:bg-indigo-700",
    gray: "bg-gray-600 hover:bg-gray-700",
    rose: "bg-rose-600 hover:bg-rose-700",
    amber: "bg-amber-600 hover:bg-amber-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`p-4 rounded-xl text-left text-white transition-colors ${
        loading ? "opacity-50 cursor-not-allowed bg-gray-400" : colorMap[color] ?? colorMap.blue
      }`}
    >
      <p className="font-bold text-sm">{loading ? "Running…" : label}</p>
      <p className="text-xs opacity-80 mt-1">{desc}</p>
    </button>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <dt className="text-gray-500 w-28 shrink-0">{k}</dt>
      <dd className={`text-gray-800 break-all ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}

function CronRow({ name, freq }: { name: string; freq: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded">
      <span className="text-gray-700">{name}</span>
      <span className="text-xs font-mono text-gray-500">{freq}</span>
    </div>
  );
}
