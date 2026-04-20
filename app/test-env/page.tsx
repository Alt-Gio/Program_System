"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function TestEnvPage() {
  const envCheck = useQuery(api.testEnv.checkEnv);

  if (!envCheck) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading environment check...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            🧪 Environment Variables Test
          </h1>
          <p className="text-gray-500 text-sm">
            Checking if all Google Sheets integration variables are configured
          </p>
        </div>

        {/* Overall Status */}
        <div
          className={`rounded-xl shadow-sm border-2 p-6 ${
            envCheck.allConfigured
              ? "bg-green-50 border-green-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`text-4xl ${
                envCheck.allConfigured ? "animate-bounce" : ""
              }`}
            >
              {envCheck.allConfigured ? "✅" : "❌"}
            </div>
            <div>
              <h2
                className={`text-xl font-bold ${
                  envCheck.allConfigured ? "text-green-800" : "text-red-800"
                }`}
              >
                {envCheck.allConfigured
                  ? "All Environment Variables Configured!"
                  : "Missing Environment Variables"}
              </h2>
              <p
                className={`text-sm ${
                  envCheck.allConfigured ? "text-green-600" : "text-red-600"
                }`}
              >
                {envCheck.allConfigured
                  ? "System is ready for Google Sheets integration"
                  : "Please check the issues below"}
              </p>
            </div>
          </div>
        </div>

        {/* Service Account Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            🔑 Google Service Account
          </h3>
          <div className="space-y-3">
            <StatusRow
              label="Service Account Key Present"
              status={envCheck.hasServiceAccount}
            />
            <StatusRow
              label="Valid JSON Format"
              status={envCheck.serviceAccountValid}
            />
            {envCheck.serviceAccountEmail && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">
                  Service Account Email:
                </p>
                <p className="text-sm text-blue-900 font-mono break-all">
                  {envCheck.serviceAccountEmail}
                </p>
              </div>
            )}
            {envCheck.serviceAccountPreview && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">
                  Preview (first 100 chars):
                </p>
                <p className="text-xs text-gray-700 font-mono break-all">
                  {envCheck.serviceAccountPreview}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sheet IDs Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            📊 Google Sheet IDs
          </h3>
          <div className="space-y-3">
            <StatusRow
              label="Attendance Log Sheet"
              status={envCheck.hasAttendanceLog}
              value={envCheck.sheetIds.attendanceLog}
            />
            <StatusRow
              label="DTC Logbook Sheet"
              status={envCheck.hasDTCLogbook}
              value={envCheck.sheetIds.dtcLogbook}
            />
            <StatusRow
              label="Intern Sheet"
              status={envCheck.hasIntern}
              value={envCheck.sheetIds.intern}
            />
            <StatusRow
              label="Sync Status Sheet"
              status={envCheck.hasSyncStatus}
              value={envCheck.sheetIds.syncStatus}
            />
            <StatusRow
              label="DICT Program Sheet"
              status={envCheck.hasDictProgram}
              value={envCheck.sheetIds.dictProgram}
            />
            <StatusRow
              label="DICT Result Sheet"
              status={envCheck.hasDictResult}
              value={envCheck.sheetIds.dictResult}
            />
          </div>
        </div>

        {/* Raw JSON Output */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            🔍 Raw Data (for debugging)
          </h3>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            {JSON.stringify(envCheck, null, 2)}
          </pre>
        </div>

        {/* Instructions */}
        {!envCheck.allConfigured && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
            <h3 className="text-lg font-bold text-amber-800 mb-3">
              ⚠️ Fix Instructions
            </h3>
            <ol className="space-y-2 text-sm text-amber-900">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>
                  Open <code className="bg-amber-100 px-1 rounded">.env.local</code> in your project root
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>Add missing environment variables</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>
                  Restart Convex: <code className="bg-amber-100 px-1 rounded">npx convex dev</code>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">4.</span>
                <span>Refresh this page</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for status rows
function StatusRow({
  label,
  status,
  value,
}: {
  label: string;
  status: boolean;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            status
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {status ? "✓" : "✗"}
        </div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      {value && (
        <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-600 max-w-xs truncate">
          {value}
        </code>
      )}
    </div>
  );
}