"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

// ============================================================
// 🧪 Sync Test Dashboard
// Tests the full pipeline: Convex → Google Sheets for all 3 sheets
// Also verifies audit log + sync status + data creation
// ============================================================

type LogEntry = {
  time: string;
  action: string;
  status: "ok" | "error" | "pending";
  message: string;
  data?: any;
};

export default function TestSyncPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  // ── Convex reactive queries ──────────────────────────────
  const todayStats = useQuery(api.auditLog.getTodayStats);
  const syncStatuses = useQuery(api.syncMonitor.getAll);
  const recentActivity = useQuery(api.auditLog.getRecentActivity, { limit: 15 });

  // ── Mutations for sample data ────────────────────────────
  const createDTCLog = useMutation(api.dtcLogs.create);

  function addLog(action: string, status: LogEntry["status"], message: string, data?: any) {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString(), action, status, message, data },
      ...prev,
    ]);
  }

  // ── Test actions ─────────────────────────────────────────

  async function testCreateDTCEntry() {
    setRunning("createDTC");
    try {
      const result = await createDTCLog({
        fullName: `Test Client ${Date.now().toString(36)}`,
        agency: "DICT Region V — Test",
        purpose: "Sync pipeline verification",
        equipmentUsed: ["PC", "Printer"],
        plannedDurationHours: 2,
        serviceType: "Internet Access",
      });
      addLog("Create DTC Log", "ok", `Created log ${result.id}`, result);
    } catch (e) {
      addLog("Create DTC Log", "error", String(e));
    }
    setRunning(null);
  }

  async function testManualSync(target: string) {
    setRunning(target);
    addLog(target, "pending", "Calling Next.js /api/sync-trigger...");
    try {
      const resp = await fetch("/api/sync-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await resp.json();
      if (data.ok) {
        addLog(target, "ok", data.message, data.results || data.synced);
      } else {
        addLog(target, "error", data.message || "Unknown error");
      }
    } catch (e) {
      addLog(target, "error", String(e));
    }
    setRunning(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-800">
            🧪 Dual Database Sync — Connection Test
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tests end-to-end: Convex DB → Google Sheets write → Audit trail → Sync status
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
              DICT_Attendance_Log
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">
              DICT_DTC_Logbook
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
              DICT_Sync_Status
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
              DICT_Results
            </span>
          </div>
        </div>

        {/* Live Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Intern Check-ins" value={todayStats?.internCheckIns ?? "—"} color="emerald" />
          <StatCard label="DTC Clients" value={todayStats?.dtcCheckIns ?? "—"} color="blue" />
          <StatCard label="Total Events" value={todayStats?.totalEvents ?? "—"} color="purple" />
          <StatCard label="Pending Sync" value={todayStats?.pendingSync ?? "—"} color="amber" />
          <StatCard
            label="Audit Methods"
            value={todayStats?.byMethod ? Object.keys(todayStats.byMethod).length : "—"}
            color="gray"
          />
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📋 Test Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ActionButton
              label="0. Setup Tabs"
              desc="Auto-create missing tabs in all 4 sheets"
              onClick={() => testManualSync("setupTabs")}
              loading={running === "setupTabs"}
              color="gray"
            />
            <ActionButton
              label="1. Create DTC Entry"
              desc="Insert sample DTC log (syncedToSheets=false)"
              onClick={testCreateDTCEntry}
              loading={running === "createDTC"}
              color="green"
            />
            <ActionButton
              label="2. Health Check"
              desc="Verify JWT auth + access to all 4 sheets"
              onClick={() => testManualSync("health")}
              loading={running === "health"}
              color="blue"
            />
            <ActionButton
              label="3. Sync DTC → Sheets"
              desc="Push pending DTC logs to DICT_DTC_Logbook"
              onClick={() => testManualSync("syncDTC")}
              loading={running === "syncDTC"}
              color="purple"
            />
            <ActionButton
              label="4. Sync Attendance → Sheets"
              desc="Push pending attendance to DICT_Attendance_Log"
              onClick={() => testManualSync("syncAttendance")}
              loading={running === "syncAttendance"}
              color="orange"
            />
            <ActionButton
              label="5. Update Status Sheet"
              desc="Write sync dashboard to DICT_Sync_Status"
              onClick={() => testManualSync("syncStatusSheet")}
              loading={running === "syncStatusSheet"}
              color="indigo"
            />
            <ActionButton
              label="6. Sync ALL"
              desc="Run DTC + Attendance + Status in sequence"
              onClick={() => testManualSync("syncAll")}
              loading={running === "syncAll"}
              color="rose"
            />
          </div>
        </div>

        {/* Sync Status (Live) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📡 Live Sync Status</h2>
          {!syncStatuses || syncStatuses.length === 0 ? (
            <p className="text-sm text-gray-500">No sync status data yet. Run test actions above to populate.</p>
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
                    <span className="text-xs text-red-500 max-w-xs truncate">{s.lastError}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Log (Live) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📜 Recent Audit Trail (Live)</h2>
          {!recentActivity || recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500">No audit entries yet. Create a DTC log or check in an intern to generate entries.</p>
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
        </div>

        {/* Test Log Output */}
        <div className="bg-gray-900 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-green-400 mb-4">🖥️ Test Log</h2>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm">Run a test action to see results here...</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-500">{log.time}</span>
                  <span className={
                    log.status === "ok" ? "text-green-400" :
                    log.status === "error" ? "text-red-400" :
                    "text-yellow-400"
                  }>[{log.status.toUpperCase()}]</span>
                  <span className="text-blue-300">{log.action}:</span>
                  <span className="text-gray-300">{log.message}</span>
                  {log.data && (
                    <span className="text-gray-500">{JSON.stringify(log.data)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Flow Diagram */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">🔄 Data Flow Architecture</h2>
          <pre className="text-xs bg-gray-50 p-4 rounded-lg font-mono leading-relaxed overflow-x-auto">
{`┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│  Python CV       │────▶│  Next.js API      │────▶│  Convex DB              │
│  (Face Recog)    │     │  /face-checkin     │     │  internAttendance       │
│  main_fixed.py   │     └──────────────────┘     │  + auditLog             │
└─────────────────┘                               │  + syncedToSheets=false │
                                                   └──────────┬──────────────┘
┌─────────────────┐     ┌──────────────────┐                │
│  DTC Logbook     │────▶│  Convex Mutation  │────▶  dtcLogs │  (5-min cron)
│  (Walk-in kiosk) │     │  dtcLogs.create   │     + auditLog│──────────┐
└─────────────────┘     └──────────────────┘                │          │
                                                             ▼          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│  QR Check-in     │────▶│  Convex Mutation  │     │  Google Sheets Writer   │
│  (Intern Portal) │     │  internAuth       │     │  googleSheetsWrite.ts   │
└─────────────────┘     │  .checkIn         │     │  (JWT → Sheets API)     │
                         └──────────────────┘     └──────────┬──────────────┘
                                                              │
                              ┌────────────────────────────────┼──────────────────┐
                              ▼                                ▼                  ▼
                    ┌─────────────────┐          ┌──────────────────┐  ┌──────────────┐
                    │ DICT_Attendance  │          │ DICT_DTC_Logbook │  │ DICT_Sync    │
                    │ _Log (Sheets)   │          │ (Sheets)         │  │ _Status      │
                    │ Tab: Attendance  │          │ Tab: Logbook     │  │ Tab: Status  │
                    │ Tab: AuditTrail │          └──────────────────┘  └──────────────┘
                    └─────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │ DICT_Results (Program Data)                  │
                    │ Tabs: EGOV_2025, ELGU_2025, FY_2025, etc.   │
                    │ ID: 1eQGeP7iSMeJeE4dhG5riBdDpxo5o0rS3Nv... │
                    └─────────────────────────────────────────────┘`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
    amber: "border-amber-200 bg-amber-50",
    gray: "border-gray-200 bg-gray-50",
  };
  return (
    <div className={`rounded-xl border-2 p-4 ${colorMap[color] ?? colorMap.gray}`}>
      <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
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
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`p-4 rounded-xl text-left text-white transition-colors ${
        loading ? "opacity-50 cursor-not-allowed bg-gray-400" : colorMap[color] ?? colorMap.blue
      }`}
    >
      <p className="font-bold text-sm">{loading ? "Running..." : label}</p>
      <p className="text-xs opacity-80 mt-1">{desc}</p>
    </button>
  );
}
