"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RefreshCw, Shield, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function QrDisplayPage() {
  const [token, setToken] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const data = useQuery(api.internAuth.getMyData, token ? { token } : "skip");

  const qrValue  = data ? `DICT-R5-INTERN:${data.id}` : "";
  const qrUrl    = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrValue)}&bgcolor=1e1b4b&color=e0e7ff&qzone=2&format=png`
    : "";

  if (data === undefined && token) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
      <AlertCircle className="w-10 h-10 text-white/20" />
      <p className="text-white/40 text-sm">Session expired.</p>
      <Link href="/login" className="text-indigo-400 text-sm font-medium">Sign in again</Link>
    </div>
  );

  return (
    <div className="px-5 py-6 flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-white text-xl font-extrabold">My QR Code</h1>
        <p className="text-white/40 text-xs mt-1">Show this to your supervisor or admin to log your attendance</p>
      </div>

      {/* QR Card */}
      <div className="bg-indigo-950/80 border border-indigo-500/20 rounded-3xl p-6 shadow-2xl shadow-indigo-950/50 w-full max-w-xs">
        <div className="bg-[#1e1b4b] rounded-2xl overflow-hidden flex items-center justify-center p-3 mb-5 border border-indigo-500/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={refresh}
            src={qrUrl}
            alt="Intern QR Code"
            width={240}
            height={240}
            className="rounded-xl"
            onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
          />
        </div>

        {/* Intern info */}
        <div className="text-center space-y-1">
          <p className="text-white font-extrabold text-base">{data.fullName}</p>
          <p className="text-indigo-300/70 text-xs">{data.school}</p>
          {data.course && <p className="text-white/30 text-[11px]">{data.course}</p>}
        </div>

        {/* ID chip */}
        <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 text-center">
          <p className="text-indigo-300/50 text-[10px] font-medium uppercase tracking-widest mb-0.5">Intern ID</p>
          <p className="text-indigo-200 text-[11px] font-mono break-all">{data.id}</p>
        </div>
      </div>

      {/* Refresh */}
      <button onClick={() => setRefresh(r => r + 1)}
        className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-xs">
        <RefreshCw className="w-3.5 h-3.5" />Refresh QR
      </button>

      {/* Shield notice */}
      <div className="w-full max-w-xs flex items-start gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
        <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-white/50 text-xs font-semibold">Secure QR Code</p>
          <p className="text-white/25 text-[11px] mt-0.5 leading-relaxed">
            This QR is linked to your intern record. Only show it to authorized supervisors.
          </p>
        </div>
      </div>

      {/* Progress snapshot */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-2">
        {[
          { label: "Hours Done",  val: `${Math.floor(data.totalHours)}h` },
          { label: "Required",    val: `${data.requiredHours}h`          },
          { label: "Attendance",  val: `${data.attendance.filter(a => a.status === "PRESENT" || a.status === "HALF_DAY").length}d` },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-2.5 text-center">
            <p className="text-white font-extrabold text-sm">{s.val}</p>
            <p className="text-white/25 text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="h-4" />
    </div>
  );
}
