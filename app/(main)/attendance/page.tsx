"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Camera, UserPlus, Users, Clock, Monitor } from "lucide-react";
import { LiveDetectionPanel } from "@/components/attendance/LiveDetectionPanel";
import { openKioskPopup } from "@/lib/kiosk/openKioskPopup";

export default function AttendanceOverviewPage() {
  const today   = useQuery(api.face_recognition.getTodayAttendance);
  const present = useQuery(api.face_recognition.getCurrentlyPresent);

  const { timeInCount, timeOutCount } = useMemo(() => {
    if (!today) return { timeInCount: 0, timeOutCount: 0 };
    return {
      timeInCount:  today.filter((r) => r.action === "time_in").length,
      timeOutCount: today.filter((r) => r.action === "time_out").length,
    };
  }, [today]);

  const isLoading = today === undefined || present === undefined;

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Face Recognition Attendance</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Real-time GPU-accelerated check-in and check-out.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/attendance/camera"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Camera className="w-4 h-4" /> Open Camera
          </Link>
          <button
            type="button"
            onClick={openKioskPopup}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Monitor className="w-4 h-4" /> Open Kiosk
          </button>
          <Link
            href="/attendance/register"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" /> Register Face
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Currently Present"
          value={isLoading ? "—" : String(present!.length)}
          color="green"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Time-Ins Today"
          value={isLoading ? "—" : String(timeInCount)}
          color="blue"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Time-Outs Today"
          value={isLoading ? "—" : String(timeOutCount)}
          color="orange"
        />
      </div>

      {/* Live view from kiosk camera */}
      <LiveDetectionPanel />

      {/* Currently Present */}
      <Panel title="Currently Present">
        {isLoading ? (
          <RowSkeleton count={3} />
        ) : present!.length === 0 ? (
          <EmptyState text="No one is currently checked in." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {present!.map((p) => (
              <li key={p.userId} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.cameraId} · {new Date(p.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                  Present
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Today's Log */}
      <Panel title="Today's Events">
        {isLoading ? (
          <RowSkeleton count={6} />
        ) : today!.length === 0 ? (
          <EmptyState text="No attendance events yet today." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Camera</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {today!.map((row) => (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "text-xs font-medium px-2 py-1 rounded-full " +
                          (row.action === "time_in"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700")
                        }
                      >
                        {row.action === "time_in" ? "Time-In" : "Time-Out"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{row.cameraId}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {(row.confidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Small presentational helpers ───────────────────────────────

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "green" | "orange";
}) {
  const tone =
    color === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : color === "green"
      ? "bg-green-50 text-green-700 border-green-100"
      : "bg-orange-50 text-orange-700 border-orange-100";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${tone}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-gray-500 text-center py-6">{text}</p>;
}

function RowSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}
