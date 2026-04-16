"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScanLine, QrCode, CheckCircle2, LogOut, RefreshCw, Shield, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  return (
    <div className="text-center">
      <p className="text-white text-4xl font-extrabold tabular-nums tracking-tight">
        {pad(h % 12 || 12)}:{pad(m)}<span className="text-3xl opacity-70">{pad(s)}</span>
        <span className="text-lg ml-2 text-white/40 font-semibold">{ampm}</span>
      </p>
      <p className="text-white/30 text-xs mt-1">
        {time.toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" })}
      </p>
    </div>
  );
}

export default function QrPage() {
  const [token,   setToken]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<"checkin" | "myqr">("checkin");
  const [result,  setResult]  = useState<CheckResult>(null);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [qrRefresh, setQrRefresh] = useState(0);

  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const data       = useQuery(api.internAuth.getMyData, token ? { token } : "skip");
  const checkInMut = useMutation(api.internAuth.checkIn);

  const today    = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayAtt = useMemo(() => data?.attendance.find(a => a.date === today), [data, today]);

  const isCheckedIn = !!todayAtt?.timeIn && !todayAtt?.timeOut;
  const isComplete  = !!todayAtt?.timeIn && !!todayAtt?.timeOut;

  async function handleCheckIn() {
    if (!token) return;
    setError(""); setLoading(true);
    try {
      const res = await checkInMut({ token });
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally { setLoading(false); }
  }

  const qrValue = data ? `DICT-R5-INTERN:${data.id}` : "";
  const qrUrl   = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrValue)}&bgcolor=1e1b4b&color=e0e7ff&qzone=2&format=png`
    : "";

  if (!data && token) {
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
      <Link href="/intern/login" className="text-indigo-400 text-sm font-medium">Sign in again</Link>
    </div>
  );

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Tab switcher */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-1 flex gap-1">
        {([
          { key: "checkin", icon: ScanLine, label: "Check In / Out" },
          { key: "myqr",    icon: QrCode,   label: "My QR Code"      },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
              tab === t.key
                ? "bg-indigo-600 text-white shadow"
                : "text-white/30 hover:text-white/60"
            )}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CHECK IN/OUT TAB ─────────────────────────────────── */}
      {tab === "checkin" && (
        <div className="space-y-4">
          {/* Clock */}
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-3xl p-5">
            <LiveClock />
          </div>

          {/* Status */}
          <div className={cn(
            "rounded-2xl border px-4 py-3.5 flex items-center gap-3 transition-all",
            isComplete   ? "bg-blue-500/10 border-blue-500/20"  :
            isCheckedIn  ? "bg-green-500/10 border-green-500/20" :
                           "bg-white/[0.04] border-white/[0.07]"
          )}>
            {isComplete ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <p className="text-blue-300 font-bold text-sm">Done for today!</p>
                  <p className="text-white/40 text-xs">
                    In: {todayAtt!.timeIn!.slice(11,16)} → Out: {todayAtt!.timeOut!.slice(11,16)}
                    {todayAtt!.hours != null && ` · ${todayAtt!.hours}h logged`}
                  </p>
                </div>
              </>
            ) : isCheckedIn ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                <div>
                  <p className="text-green-300 font-bold text-sm">Checked In</p>
                  <p className="text-white/40 text-xs">Since {todayAtt!.timeIn!.slice(11,16)} · Tap to check out when done</p>
                </div>
              </>
            ) : (
              <>
                <Clock className="w-5 h-5 text-white/20 shrink-0" />
                <div>
                  <p className="text-white/50 font-bold text-sm">Not checked in</p>
                  <p className="text-white/25 text-xs">Tap below to start your day</p>
                </div>
              </>
            )}
          </div>

          {/* Main button */}
          {!isComplete && (
            <button onClick={handleCheckIn} disabled={loading}
              className={cn(
                "w-full rounded-3xl py-7 flex flex-col items-center gap-3 transition-all active:scale-95 border-2",
                isCheckedIn
                  ? "bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30 shadow-xl shadow-amber-900/20"
                  : "bg-indigo-600 border-indigo-400/40 text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-900/50",
                loading && "opacity-60 cursor-not-allowed"
              )}>
              {loading
                ? <div className="w-9 h-9 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : isCheckedIn
                  ? <><LogOut className="w-11 h-11" /><span className="text-lg font-extrabold">Tap to Check Out</span></>
                  : <><ScanLine className="w-11 h-11" /><span className="text-lg font-extrabold">Tap to Check In</span></>
              }
            </button>
          )}

          {result && (
            <div className={cn(
              "rounded-2xl border px-5 py-4 text-center",
              result.action === "checked_in" ? "bg-green-500/10 border-green-500/20" : "bg-blue-500/10 border-blue-500/20"
            )}>
              <CheckCircle2 className={cn("w-8 h-8 mx-auto mb-2", result.action === "checked_in" ? "text-green-400" : "text-blue-400")} />
              <p className={cn("font-bold text-sm", result.action === "checked_in" ? "text-green-300" : "text-blue-300")}>
                {result.action === "checked_in" ? "Checked In! 🎉" : "Checked Out! Great work today 🙌"}
              </p>
              <p className="text-white/40 text-xs mt-1">Time: {result.time.slice(11,16)}</p>
              {result.hours != null && <p className="text-white/40 text-xs">{result.hours}h logged</p>}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Recent history */}
          {data.attendance.length > 0 && (
            <div>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest mb-2">Recent</p>
              <div className="space-y-1.5">
                {data.attendance.slice(0, 5).map(att => (
                  <div key={att.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", att.status === "PRESENT" ? "bg-green-400" : att.status === "ABSENT" ? "bg-red-400" : "bg-amber-400")} />
                      <p className="text-white/60 text-xs tabular-nums">{att.date}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/30 tabular-nums">
                      <span>{att.timeIn ? att.timeIn.slice(11,16) : "—"} {att.timeOut ? `→ ${att.timeOut.slice(11,16)}` : ""}</span>
                      {att.hours != null && <span className="text-white/50 font-medium">{att.hours}h</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY QR CODE TAB ───────────────────────────────────── */}
      {tab === "myqr" && (
        <div className="space-y-4 flex flex-col items-center">
          <p className="text-white/30 text-xs text-center">Show this to your supervisor to log your attendance</p>

          <div className="bg-indigo-950/80 border border-indigo-500/20 rounded-3xl p-5 w-full max-w-xs shadow-2xl">
            <div className="bg-[#1e1b4b] rounded-2xl overflow-hidden flex items-center justify-center p-3 mb-4 border border-indigo-500/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={qrRefresh} src={qrUrl} alt="Intern QR Code" width={220} height={220} className="rounded-xl" />
            </div>
            <div className="text-center">
              <p className="text-white font-extrabold">{data.fullName}</p>
              <p className="text-indigo-300/60 text-xs mt-0.5">{data.school}</p>
              <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
                <p className="text-indigo-300/40 text-[10px] uppercase tracking-widest">Intern ID</p>
                <p className="text-indigo-200/70 text-[11px] font-mono break-all mt-0.5">{data.id}</p>
              </div>
            </div>
          </div>

          <button onClick={() => setQrRefresh(r => r + 1)}
            className="flex items-center gap-1.5 text-white/25 hover:text-white/50 transition-colors text-xs">
            <RefreshCw className="w-3.5 h-3.5" />Refresh QR
          </button>

          <div className="w-full max-w-xs flex items-start gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-white/30 text-[11px] leading-relaxed">
              This QR is uniquely tied to your intern record. Only share it with authorized supervisors.
            </p>
          </div>

          <div className="w-full max-w-xs grid grid-cols-3 gap-2">
            {[
              { label: "Hours",    val: `${Math.floor(data.totalHours)}h` },
              { label: "Required", val: `${data.requiredHours}h`          },
              { label: "Days",     val: `${data.attendance.filter(a => a.status === "PRESENT").length}d` },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-2.5 text-center">
                <p className="text-white font-extrabold text-sm">{s.val}</p>
                <p className="text-white/25 text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
