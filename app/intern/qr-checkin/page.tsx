"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScanLine, CheckCircle2, LogOut, Clock, Calendar, AlertCircle, Wifi } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { enqueue, generateClientId } from "@/lib/offline-queue";

const CHECKIN_ENDPOINT = "/api/intern/qr/checkin";
const CHECKIN_STORE = "internCheckinQueue" as const;

type CheckResult = { action: "checked_in" | "checked_out"; time: string; hours: number | null } | null;

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = time.getHours(), m = time.getMinutes(), s = time.getSeconds();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return (
    <div className="text-center">
      <p className="text-white text-5xl font-extrabold tabular-nums tracking-tight">
        {pad(h12)}:{pad(m)}<span className="text-4xl">{pad(s)}</span>
      </p>
      <p className="text-white/40 text-sm font-semibold tabular-nums">{ampm}</p>
      <p className="text-white/30 text-xs mt-1">
        {time.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}

export default function QrCheckinPage() {
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const data = useQuery(api.internAuth.getMyData, token ? { token } : "skip");

  const today = new Date().toISOString().slice(0, 10);
  const todayAtt = useMemo(() => data?.attendance.find(a => a.date === today), [data, today]);

  const isCheckedIn  = !!todayAtt?.timeIn && !todayAtt?.timeOut;
  const isComplete   = !!todayAtt?.timeIn && !!todayAtt?.timeOut;

  async function handleCheckIn() {
    if (!token) return;
    setError("");
    setLoading(true);
    const payload = {
      clientId: generateClientId(),
      token,
      submittedOffline: typeof navigator !== "undefined" && !navigator.onLine,
    };
    try {
      const res = await fetch(CHECKIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 202 && json?.queued) {
        setResult({ action: "checked_in", time: new Date().toISOString(), hours: null });
      } else if (res.ok) {
        setResult(json as CheckResult);
      } else {
        throw new Error(json?.error || "Check-in failed");
      }
    } catch (err: any) {
      // If this was a network failure, queue it locally for replay.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        try {
          await enqueue(CHECKIN_STORE, payload);
          setResult({ action: "checked_in", time: new Date().toISOString(), hours: null });
        } catch {
          setError("Couldn't save offline check-in.");
        }
      } else {
        setError(err?.message ?? "Something went wrong.");
      }
    } finally { setLoading(false); }
  }

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
    <div className="px-4 py-5 flex flex-col gap-5 items-center">
      {/* Header */}
      <div className="text-center w-full">
        <h1 className="text-white text-xl font-extrabold">QR Check-in</h1>
        <p className="text-white/30 text-xs mt-0.5">{data.fullName}</p>
      </div>

      {/* Clock */}
      <div className="w-full max-w-sm bg-white/[0.04] border border-white/[0.07] rounded-3xl p-6">
        <LiveClock />
      </div>

      {/* Status banner */}
      <div className={cn(
        "w-full max-w-sm rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all",
        isComplete   ? "bg-blue-500/10 border-blue-500/20"  :
        isCheckedIn  ? "bg-green-500/10 border-green-500/20" :
                       "bg-white/[0.04] border-white/[0.07]"
      )}>
        {isComplete ? (
          <>
            <CheckCircle2 className="w-7 h-7 text-blue-400 shrink-0" />
            <div>
              <p className="text-blue-300 font-bold text-sm">Attendance Complete</p>
              <p className="text-white/40 text-xs">
                In: {todayAtt!.timeIn!.slice(11,16)} → Out: {todayAtt!.timeOut!.slice(11,16)}
              </p>
              {todayAtt!.hours != null && (
                <p className="text-blue-300/60 text-xs">{todayAtt!.hours}h logged today</p>
              )}
            </div>
          </>
        ) : isCheckedIn ? (
          <>
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shrink-0" />
            <div>
              <p className="text-green-300 font-bold text-sm">Currently Checked In</p>
              <p className="text-white/40 text-xs">Since {todayAtt!.timeIn!.slice(11,16)}</p>
              <p className="text-white/30 text-[11px]">Tap below when you&apos;re done for the day</p>
            </div>
          </>
        ) : (
          <>
            <Wifi className="w-6 h-6 text-white/20 shrink-0" />
            <div>
              <p className="text-white/50 font-bold text-sm">Not Checked In</p>
              <p className="text-white/30 text-xs">Tap the button below to start your day</p>
            </div>
          </>
        )}
      </div>

      {/* Main action button */}
      {!isComplete && (
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className={cn(
            "w-full max-w-sm rounded-3xl py-6 flex flex-col items-center gap-3 transition-all active:scale-95 shadow-2xl",
            "border-2 font-bold text-lg",
            isCheckedIn
              ? "bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30 shadow-amber-900/30"
              : "bg-indigo-600/80 border-indigo-400/40 text-white hover:bg-indigo-600 shadow-indigo-900/50",
            loading && "opacity-60 cursor-not-allowed"
          )}
        >
          {loading ? (
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isCheckedIn ? (
            <>
              <LogOut className="w-10 h-10" />
              <span>Tap to Check Out</span>
            </>
          ) : (
            <>
              <ScanLine className="w-10 h-10" />
              <span>Tap to Check In</span>
            </>
          )}
        </button>
      )}

      {/* Result toast */}
      {result && (
        <div className={cn(
          "w-full max-w-sm rounded-2xl border px-5 py-4 text-center",
          result.action === "checked_in"
            ? "bg-green-500/10 border-green-500/20"
            : "bg-blue-500/10 border-blue-500/20"
        )}>
          <CheckCircle2 className={cn("w-8 h-8 mx-auto mb-2", result.action === "checked_in" ? "text-green-400" : "text-blue-400")} />
          <p className={cn("font-bold text-sm", result.action === "checked_in" ? "text-green-300" : "text-blue-300")}>
            {result.action === "checked_in" ? "Checked In Successfully!" : "Checked Out Successfully!"}
          </p>
          <p className="text-white/40 text-xs mt-1">Time: {result.time.slice(11,16)}</p>
          {result.hours != null && (
            <p className="text-white/50 text-xs">{result.hours}h logged today</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="w-full max-w-sm bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Attendance history */}
      {data.attendance.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />Recent History
          </p>
          <div className="space-y-1.5">
            {data.attendance.slice(0, 7).map(att => (
              <div key={att.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-2 h-2 rounded-full shrink-0",
                    att.status === "PRESENT" ? "bg-green-400" :
                    att.status === "ABSENT"  ? "bg-red-400"   :
                    att.status === "HALF_DAY"? "bg-amber-400" : "bg-white/20"
                  )} />
                  <p className="text-white/60 text-xs tabular-nums font-medium">{att.date}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-white/30 tabular-nums">
                    {att.timeIn ? att.timeIn.slice(11,16) : "—"} {att.timeOut ? `→ ${att.timeOut.slice(11,16)}` : ""}
                  </span>
                  {att.hours != null && (
                    <span className="text-white/40 tabular-nums font-medium">{att.hours}h</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
