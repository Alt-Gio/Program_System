"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ScanLine, QrCode, CheckCircle2, LogOut, RefreshCw,
  Shield, Clock, AlertCircle, MapPin, Navigation,
  Wifi, WifiOff, Lock, Unlock, ChevronRight, Eye,
  Crosshair, TriangleAlert, Activity,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── types ──────────────────────────────────────────────────
type CheckResult = {
  action: "checked_in" | "checked_out";
  time: string; hours: number | null;
  geoVerified?: boolean; distanceMeters?: number | null;
} | null;

type GpsState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "denied"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; lat: number; lng: number; accuracy: number; address?: string };

// ─── helpers ────────────────────────────────────────────────
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDist(m: number): string {
  return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function AccuracyRing({ accuracy }: { accuracy: number }) {
  const level = accuracy <= 10 ? "excellent" : accuracy <= 30 ? "good" : accuracy <= 80 ? "fair" : "poor";
  const colors = { excellent: "text-green-400 border-green-400/40 bg-green-400/10", good: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10", fair: "text-amber-400 border-amber-400/40 bg-amber-400/10", poor: "text-red-400 border-red-400/40 bg-red-400/10" };
  const dots = { excellent: 4, good: 3, fair: 2, poor: 1 };
  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold", colors[level])}>
      <Activity className="w-3 h-3" />
      <span>±{Math.round(accuracy)}m</span>
      <div className="flex gap-0.5">
        {[1,2,3,4].map(i => <div key={i} className={cn("w-1 h-2.5 rounded-full", i <= dots[level] ? "bg-current" : "bg-white/10")} />)}
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const h = time.getHours(), m = time.getMinutes(), s = time.getSeconds();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="text-center">
      <p className="text-white text-4xl font-extrabold tabular-nums tracking-tight">
        {pad(h%12||12)}:{pad(m)}<span className="text-3xl opacity-50">{pad(s)}</span>
        <span className="text-lg ml-2 text-white/30 font-semibold">{h>=12?"PM":"AM"}</span>
      </p>
      <p className="text-white/30 text-xs mt-1">{time.toLocaleDateString("en-PH",{weekday:"long",month:"short",day:"numeric",year:"numeric"})}</p>
    </div>
  );
}

// ─── GPS Location Panel ──────────────────────────────────────
function LocationPanel({
  gps, fences, onRequest, isCheckedIn,
}: {
  gps: GpsState;
  fences: any[];
  onRequest: () => void;
  isCheckedIn: boolean;
}) {
  const geoStatus = useMemo(() => {
    if (gps.status !== "ready" || fences.length === 0) return null;
    let nearest: { fence: any; dist: number } | null = null;
    for (const f of fences) {
      const d = haversineMeters(gps.lat, gps.lng, f.lat, f.lng);
      if (!nearest || d < nearest.dist) nearest = { fence: f, dist: d };
    }
    if (!nearest) return null;
    const inZone = nearest.dist <= nearest.fence.radiusMeters;
    return { inZone, dist: nearest.dist, fence: nearest.fence };
  }, [gps, fences]);

  if (gps.status === "idle") return (
    <button onClick={onRequest}
      className="w-full flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-4 text-left hover:bg-white/[0.07] transition-all active:scale-[0.98]">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
        <MapPin className="w-5 h-5 text-indigo-400" />
      </div>
      <div className="flex-1">
        <p className="text-white/70 font-semibold text-sm">Enable Location Access</p>
        <p className="text-white/30 text-xs">Required for GPS-verified attendance</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20" />
    </button>
  );

  if (gps.status === "requesting") return (
    <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-4">
      <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
      <div>
        <p className="text-indigo-300 font-semibold text-sm">Acquiring GPS signal…</p>
        <p className="text-indigo-300/40 text-xs">Allow location access in your browser</p>
      </div>
    </div>
  );

  if (gps.status === "denied" || gps.status === "error") return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3.5 flex items-start gap-3">
      <TriangleAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-red-300 font-semibold text-sm">
          {gps.status === "denied" ? "Location access denied" : "GPS error"}
        </p>
        <p className="text-red-300/50 text-xs mt-0.5">{gps.message}</p>
        <button onClick={onRequest} className="mt-2 text-xs text-indigo-400 font-semibold hover:text-indigo-300">Retry →</button>
      </div>
    </div>
  );

  // GPS ready
  if (gps.status === "ready") return (
    <div className={cn(
      "rounded-2xl border overflow-hidden",
      geoStatus?.inZone ? "border-green-500/30 bg-green-500/5"
        : fences.length > 0 ? "border-red-500/30 bg-red-500/5"
        : "border-indigo-500/20 bg-indigo-500/5"
    )}>
      {/* Status banner */}
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-3 border-b",
        geoStatus?.inZone ? "border-green-500/20 bg-green-500/10"
          : fences.length > 0 ? "border-red-500/20 bg-red-500/10"
          : "border-indigo-500/20 bg-indigo-500/10"
      )}>
        {geoStatus?.inZone ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <div className="flex-1">
              <p className="text-green-300 font-bold text-sm flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5" /> Within "{geoStatus.fence.name}"
              </p>
              <p className="text-green-400/50 text-[11px]">{formatDist(geoStatus.dist)} from zone center · Check-in unlocked</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          </>
        ) : fences.length > 0 ? (
          <>
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <div className="flex-1">
              <p className="text-red-300 font-bold text-sm flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Outside Office Zone
              </p>
              <p className="text-red-400/50 text-[11px]">
                {geoStatus ? `${formatDist(geoStatus.dist)} from "${geoStatus.fence.name}" · Must be within ${geoStatus.fence.radiusMeters}m` : "No zone matched"}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <div className="flex-1">
              <p className="text-indigo-300 font-bold text-sm flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Location Tracked
              </p>
              <p className="text-indigo-400/50 text-[11px]">No geofence configured · Location logged for transparency</p>
            </div>
          </>
        )}
      </div>

      {/* Coordinates detail */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5 text-white/30" />
            <span className="text-white/50 text-xs">Coordinates</span>
          </div>
          <AccuracyRing accuracy={gps.accuracy} />
        </div>
        <div className="font-mono text-xs bg-black/20 rounded-xl px-3 py-2.5 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-white/30">LAT</span>
            <span className="text-indigo-300 font-semibold">{gps.lat.toFixed(6)}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/30">LNG</span>
            <span className="text-indigo-300 font-semibold">{gps.lng.toFixed(6)}°</span>
          </div>
          {gps.address && (
            <div className="pt-1 border-t border-white/[0.06] flex items-start gap-1.5">
              <MapPin className="w-3 h-3 text-white/20 mt-0.5 shrink-0" />
              <span className="text-white/30 break-all">{gps.address}</span>
            </div>
          )}
        </div>

        {/* Geofence distance bar */}
        {geoStatus && (
          <div>
            <div className="flex justify-between text-[10px] text-white/30 mb-1">
              <span>Distance from "{geoStatus.fence.name}"</span>
              <span>{formatDist(geoStatus.dist)} / {geoStatus.fence.radiusMeters}m allowed</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(100, (geoStatus.dist / geoStatus.fence.radiusMeters) * 100)}%` }}
                className={cn("h-full rounded-full transition-all", geoStatus.inZone ? "bg-green-500" : "bg-red-500")}
              />
            </div>
          </div>
        )}

        <button onClick={onRequest}
          className="flex items-center gap-1.5 text-white/20 hover:text-white/40 text-[11px] transition-colors">
          <RefreshCw className="w-3 h-3" />Refresh location
        </button>
      </div>
    </div>
  );

  return null;
}

// ─── Main Page ───────────────────────────────────────────────
export default function QrPage() {
  const [token, setToken]     = useState<string | null>(null);
  const [tab, setTab]         = useState<"checkin" | "myqr">("checkin");
  const [result, setResult]   = useState<CheckResult>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [qrRefresh, setQrRefresh] = useState(0);
  const [gps, setGps]         = useState<GpsState>({ status: "idle" });
  const watchRef              = useRef<number | null>(null);

  useEffect(() => { setToken(localStorage.getItem("intern_token")); }, []);

  const data       = useQuery(api.internAuth.getMyData, token ? { token } : "skip");
  const checkInMut = useMutation(api.internAuth.checkIn);
  const fences     = useQuery(api.supervisorTools.getGeoFences) ?? [];

  const today    = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayAtt = useMemo(() => data?.attendance.find(a => a.date === today), [data, today]);
  const isCheckedIn = !!todayAtt?.timeIn && !todayAtt?.timeOut;
  const isComplete  = !!todayAtt?.timeIn && !!todayAtt?.timeOut;

  // Reverse geocode using Nominatim (free, no key)
  async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const j = await res.json();
      return j.display_name as string;
    } catch { return undefined; }
  }

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGps({ status: "error", message: "Geolocation is not supported on this device." });
      return;
    }
    setGps({ status: "requesting" });

    // Clear old watcher
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const address = await reverseGeocode(lat, lng);
        setGps({ status: "ready", lat, lng, accuracy, address });
      },
      (err) => {
        if (err.code === 1) setGps({ status: "denied", message: "Permission denied. Enable location in browser settings and try again." });
        else setGps({ status: "error", message: err.message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    // Auto-request GPS on mount
    requestGPS();
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  }, [requestGPS]);

  // Geo-lock: are we allowed to check in?
  const canCheckIn = useMemo(() => {
    if (fences.length === 0) return true; // no fences → open
    if (gps.status !== "ready") return false;
    return fences.some(f => haversineMeters(gps.lat, gps.lng, f.lat, f.lng) <= f.radiusMeters);
  }, [gps, fences]);

  async function handleCheckIn() {
    if (!token) return;
    setError(""); setResult(null); setLoading(true);
    try {
      const gpsArgs = gps.status === "ready"
        ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, address: gps.address }
        : {};
      const res = await checkInMut({ token, ...gpsArgs });
      setResult(res as CheckResult);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally { setLoading(false); }
  }

  const qrValue = data ? `DICT-R5-INTERN:${data.id}` : "";
  const qrUrl   = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrValue)}&bgcolor=1e1b4b&color=e0e7ff&qzone=2&format=png`
    : "";

  if (!data && token) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );
  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
      <AlertCircle className="w-10 h-10 text-white/20" />
      <p className="text-white/40 text-sm">Session expired.</p>
      <Link href="/login" className="text-indigo-400 text-sm font-medium">Sign in again</Link>
    </div>
  );

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Tab switcher */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-1 flex gap-1">
        {([
          { key: "checkin", icon: ScanLine,  label: "Check In / Out" },
          { key: "myqr",    icon: QrCode,    label: "My QR Code"     },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
              tab === t.key ? "bg-indigo-600 text-white shadow" : "text-white/30 hover:text-white/60")}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ══ CHECK IN/OUT TAB ══════════════════════════════════ */}
      {tab === "checkin" && (
        <div className="space-y-4">
          {/* Clock */}
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-3xl px-5 py-5">
            <LiveClock />
          </div>

          {/* Today status */}
          <div className={cn(
            "rounded-2xl border px-4 py-3.5 flex items-center gap-3",
            isComplete   ? "bg-blue-500/10 border-blue-500/20"
            : isCheckedIn? "bg-green-500/10 border-green-500/20"
            :              "bg-white/[0.04] border-white/[0.07]"
          )}>
            {isComplete ? (
              <><CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0" />
              <div>
                <p className="text-blue-300 font-bold text-sm">Done for today!</p>
                <p className="text-white/40 text-xs">
                  In: {todayAtt!.timeIn!.slice(11,16)} → Out: {todayAtt!.timeOut!.slice(11,16)}
                  {todayAtt!.hours != null && ` · ${todayAtt!.hours}h logged`}
                </p>
                {(todayAtt as any)?.checkInVerified && (
                  <p className="text-green-400/60 text-[10px] flex items-center gap-1 mt-0.5">
                    <Shield className="w-2.5 h-2.5" />GPS-verified attendance
                  </p>
                )}
              </div></>
            ) : isCheckedIn ? (
              <><div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              <div>
                <p className="text-green-300 font-bold text-sm">Checked In</p>
                <p className="text-white/40 text-xs">Since {todayAtt!.timeIn!.slice(11,16)} · Tap to check out</p>
                {(todayAtt as any)?.checkInVerified && (
                  <p className="text-green-400/60 text-[10px] flex items-center gap-1 mt-0.5">
                    <Shield className="w-2.5 h-2.5" />GPS-verified
                  </p>
                )}
              </div></>
            ) : (
              <><Clock className="w-5 h-5 text-white/20 shrink-0" />
              <div>
                <p className="text-white/50 font-bold text-sm">Not checked in</p>
                <p className="text-white/25 text-xs">Verify your location below then tap to start</p>
              </div></>
            )}
          </div>

          {/* GPS Location Panel */}
          {!isComplete && (
            <LocationPanel
              gps={gps}
              fences={fences}
              onRequest={requestGPS}
              isCheckedIn={isCheckedIn}
            />
          )}

          {/* Geofence lock warning */}
          {!isComplete && !isCheckedIn && fences.length > 0 && gps.status === "ready" && !canCheckIn && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3.5">
              <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Check-in locked</p>
                <p className="text-red-400/50 text-xs leading-relaxed mt-0.5">
                  You must be physically present at the designated office location to check in. This ensures transparent and accurate attendance records.
                </p>
              </div>
            </div>
          )}

          {/* No GPS yet warning for geofenced offices */}
          {!isComplete && !isCheckedIn && fences.length > 0 && gps.status !== "ready" && gps.status !== "requesting" && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3.5">
              <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-semibold text-sm">GPS required</p>
                <p className="text-amber-400/50 text-xs mt-0.5">Location access is required to verify you're at the office before checking in.</p>
              </div>
            </div>
          )}

          {/* Main check-in button */}
          {!isComplete && (
            <button
              onClick={handleCheckIn}
              disabled={loading || (!isCheckedIn && !canCheckIn) || gps.status === "requesting"}
              className={cn(
                "w-full rounded-3xl py-7 flex flex-col items-center gap-2.5 transition-all active:scale-95 border-2",
                isCheckedIn
                  ? "bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30 shadow-xl shadow-amber-900/20"
                  : canCheckIn
                    ? "bg-indigo-600 border-indigo-400/40 text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-900/50"
                    : "bg-white/[0.03] border-white/[0.06] text-white/20 cursor-not-allowed",
                loading && "opacity-60 cursor-not-allowed"
              )}>
              {loading ? (
                <div className="w-9 h-9 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isCheckedIn ? (
                <>
                  <LogOut className="w-11 h-11" />
                  <span className="text-lg font-extrabold">Tap to Check Out</span>
                  {gps.status === "ready" && <span className="text-xs opacity-60 flex items-center gap-1"><MapPin className="w-3 h-3" />Location will be logged</span>}
                </>
              ) : canCheckIn ? (
                <>
                  <ScanLine className="w-11 h-11" />
                  <span className="text-lg font-extrabold">Tap to Check In</span>
                  {gps.status === "ready" && fences.length > 0 && (
                    <span className="text-xs text-green-300/80 flex items-center gap-1 font-semibold">
                      <Shield className="w-3 h-3" />GPS Verified · Location confirmed
                    </span>
                  )}
                  {gps.status === "ready" && fences.length === 0 && (
                    <span className="text-xs opacity-50 flex items-center gap-1"><MapPin className="w-3 h-3" />Location will be recorded</span>
                  )}
                </>
              ) : (
                <>
                  <Lock className="w-10 h-10" />
                  <span className="text-base font-bold">
                    {gps.status === "requesting" ? "Acquiring GPS…" : "Move to office to check in"}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Result */}
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
              {result.geoVerified && (
                <div className="flex items-center justify-center gap-1.5 mt-2 text-green-400/70 text-[11px]">
                  <Shield className="w-3 h-3" />
                  <span>GPS verified</span>
                  {result.distanceMeters != null && <span>· {formatDist(result.distanceMeters)} from zone</span>}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3.5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Check-in failed</p>
                <p className="text-red-400/60 text-xs mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Transparency notice */}
          {gps.status === "ready" && (
            <div className="flex items-start gap-2.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl px-4 py-3">
              <Eye className="w-4 h-4 text-indigo-400/60 shrink-0 mt-0.5" />
              <p className="text-white/25 text-[11px] leading-relaxed">
                Your GPS coordinates are recorded with each attendance log for transparency and accountability purposes. This data is only visible to your supervisor.
              </p>
            </div>
          )}

          {/* Recent history */}
          {data.attendance.length > 0 && (
            <div>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest mb-2">Recent Attendance</p>
              <div className="space-y-1.5">
                {data.attendance.slice(0, 5).map(att => (
                  <div key={att.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", att.status === "PRESENT" ? "bg-green-400" : att.status === "ABSENT" ? "bg-red-400" : "bg-amber-400")} />
                      <p className="text-white/60 text-xs tabular-nums">{att.date}</p>
                      {(att as any).checkInVerified && <Shield className="w-3 h-3 text-green-400/50" title="GPS verified" />}
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

      {/* ══ MY QR CODE TAB ════════════════════════════════════ */}
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
