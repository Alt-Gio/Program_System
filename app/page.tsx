"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import DTCShowcase from "@/components/dtc-showcase";
import { FacebookPageEmbed } from "@/components/facebook-embed";
import { DTCOffices } from "@/components/dtc-offices";
import Link from "next/link";
import {
  Sun, Moon, ChevronRight, ChevronLeft, Globe, MapPin, Building2,
  Home, Users, BarChart3, Activity, X, ZoomIn, ZoomOut, ArrowRight,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn, numberWithCommas, getCompletionRate } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR } from "@/lib/types";
import { R5_PROVINCE_COORDS, R5_GEO } from "@/lib/r5-data";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const BICOL_CENTER = { longitude: 123.5, latitude: 13.0, zoom: 7.5 };
const PH_CENTER    = { longitude: 122.0, latitude: 12.0, zoom: 5.0 };

const LOGO_MAP: Record<string, string> = {
  EGOV:     "egov_ph_logo.png",
  ELGU:     "elgu_logo.png",
  FREEWIFI: "freewifi_logo.png",
  GOVNET:   "govnet_logo.png",
  NBP:      "nbp_logo.png",
  CYBER:    "cybersecurity_logo.png",
  PNPKI:    "pnpki_logo.png",
  DRRM:     "drrm_logo.png",
  ILCDB:    "ilcdb_logo.jpg",
  IIDB:     "iidb_logo.png",
};

const LEFT_PROGRAMS  = DICT_PROJECTS.slice(0, 5);
const RIGHT_PROGRAMS = DICT_PROJECTS.slice(5, 10);

type MapLevel = "province" | "lgu" | "barangay";

interface ProvPin {
  provinceId: string;
  provinceName: string;
  lat: number;
  lng: number;
  activityCount: number;
  participantCount: number;
  byProject: Record<string, number>;
}

interface LGURow {
  name: string;
  lng: number;
  lat: number;
  barangays: Array<{ name: string; coords: [number, number] }>;
  activityCount: number;
  participantCount: number;
  lguId?: string;
}

interface BarangayRow {
  name: string;
  coords: [number, number];
  activityCount: number;
  participantCount: number;
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen({ done }: { done: boolean }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 2, done ? 100 : 92));
    }, 40);
    return () => clearInterval(interval);
  }, [done]);

  return (
    <div className={cn(
      "fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-700",
      "bg-[#06060f]",
      done ? "opacity-0 pointer-events-none" : "opacity-100"
    )}>
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Glow orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }} />

      <div className={cn("flex flex-col items-center gap-8 transition-all duration-700",
        phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>

        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl blur-xl opacity-60"
            style={{ background: "linear-gradient(135deg, #00d4ff, #0ea5e9)" }} />
          <div className="relative w-24 h-24 rounded-2xl bg-[#0a0a1a] border border-[#00d4ff]/30 flex items-center justify-center shadow-2xl">
            <span className="text-3xl font-black tracking-tight text-white">
              <span style={{ color: "#00d4ff" }}>D</span>ICT
            </span>
          </div>
        </div>

        {/* Title */}
        <div className={cn("text-center transition-all duration-500",
          phase >= 2 ? "opacity-100" : "opacity-0")}>
          <h1 className="text-4xl font-black tracking-tight text-white">
            DICT <span style={{ color: "#00d4ff" }}>Region V</span>
          </h1>
          <p className="text-sm text-[#00d4ff]/60 mt-2 tracking-widest uppercase">
            Program Management System
          </p>
        </div>

        {/* Progress */}
        <div className={cn("w-64 transition-all duration-500",
          phase >= 3 ? "opacity-100" : "opacity-0")}>
          <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #00d4ff, #0ea5e9)",
                boxShadow: "0 0 10px #00d4ff",
              }} />
          </div>
          <p className="text-xs text-white/30 mt-3 text-center tracking-widest">
            LOADING MAP · {progress}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Program Button ───────────────────────────────────────────────────────────

function ProgramBtn({
  project, selected, onClick, dark, activityCount,
}: {
  project: typeof DICT_PROJECTS[0];
  selected: boolean;
  onClick: () => void;
  dark: boolean;
  activityCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-200 text-left group",
        selected
          ? "border-[#00d4ff]/60 shadow-lg shadow-[#00d4ff]/10"
          : dark
            ? "border-white/10 hover:border-white/25 hover:bg-white/5"
            : "border-gray-200 hover:border-blue-300 hover:bg-blue-50",
        selected && dark  ? "bg-[#00d4ff]/10" : "",
        selected && !dark ? "bg-blue-50 border-blue-400" : "",
      )}
      style={selected ? { boxShadow: `0 0 12px ${project.color}30` } : undefined}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
        dark ? "bg-white/10" : "bg-white border border-gray-100",
      )}>
        <Image
          src={`/Logo/${LOGO_MAP[project.code] || "egov_ph_logo.png"}`}
          alt={project.shortName}
          width={32}
          height={32}
          className="object-contain p-0.5"
          unoptimized
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-semibold truncate leading-tight",
          dark ? "text-white" : "text-gray-800",
          selected ? "" : dark ? "text-white/80" : "")}>
          {project.shortName}
        </p>
        {activityCount !== undefined && (
          <p className={cn("text-[10px] mt-0.5", dark ? "text-white/40" : "text-gray-400")}>
            {activityCount} activities
          </p>
        )}
      </div>
      {selected && (
        <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
          style={{ backgroundColor: project.color }} />
      )}
    </button>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel({
  project, dark, summary, onClose,
}: {
  project: typeof DICT_PROJECTS[0] | null;
  dark: boolean;
  summary: any;
  onClose: () => void;
}) {
  if (!project || !summary) return null;

  const proj = summary.summary?.find((s: any) => s.code === project.code);
  if (!proj) return null;

  const completed = (proj.byStatus?.validated ?? 0) + (proj.byStatus?.reported ?? 0);
  const rate = getCompletionRate(completed, proj.totalActivities);

  const statusData = [
    { name: "Draft",     count: proj.byStatus?.draft     ?? 0 },
    { name: "Submit",    count: proj.byStatus?.submitted ?? 0 },
    { name: "Valid.",    count: proj.byStatus?.validated ?? 0 },
    { name: "Report",   count: proj.byStatus?.reported  ?? 0 },
  ].filter(d => d.count > 0);

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      dark ? "bg-[#0d1117]/90 border-white/10" : "bg-white border-gray-200",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "#f0f0f0" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: project.color }} />
          <span className={cn("text-xs font-bold", dark ? "text-white" : "text-gray-800")}>
            {project.shortName}
          </span>
        </div>
        <button onClick={onClose}
          className={cn("w-5 h-5 rounded flex items-center justify-center transition-colors",
            dark ? "hover:bg-white/10 text-white/50" : "hover:bg-gray-100 text-gray-400")}>
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {[
          { label: "Activities", value: proj.totalActivities },
          { label: "Participants", value: numberWithCommas(proj.totalParticipants) },
          { label: "Completion", value: `${rate}%` },
          { label: "Validated", value: proj.byStatus?.validated ?? 0 },
        ].map(k => (
          <div key={k.label} className={cn(
            "rounded-lg p-2 text-center",
            dark ? "bg-white/5" : "bg-gray-50",
          )}>
            <p className="text-sm font-bold" style={{ color: project.color }}>{k.value}</p>
            <p className={cn("text-[9px] uppercase tracking-wide mt-0.5", dark ? "text-white/40" : "text-gray-500")}>
              {k.label}
            </p>
          </div>
        ))}
      </div>

      {/* Mini bar chart by status */}
      {statusData.length > 0 && (
        <div className="px-3 pb-3">
          <p className={cn("text-[9px] uppercase tracking-widest mb-1.5", dark ? "text-white/30" : "text-gray-400")}>
            By Status
          </p>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={statusData} barSize={10}>
              <Bar dataKey="count" fill={project.color} radius={[2, 2, 0, 0]} />
              <XAxis dataKey="name" tick={{ fontSize: 7, fill: dark ? "#ffffff60" : "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 10, background: dark ? "#1a1a2e" : "#fff", border: "none", borderRadius: 6 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="px-3 pb-3">
        <Link href={`/projects/${project.code.toLowerCase()}`}>
          <button className="w-full text-xs py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: `${project.color}20`,
              color: project.color,
              border: `1px solid ${project.color}40`,
            }}>
            View All Activities →
          </button>
        </Link>
      </div>
    </div>
  );
}

// ─── Barangay Popup ───────────────────────────────────────────────────────────

function BarangayPopup({
  barangay, dark, images, onClose,
}: {
  barangay: BarangayRow | null;
  dark: boolean;
  images: any[];
  onClose: () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => { setImgIdx(0); }, [barangay]);

  if (!barangay) return null;

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden w-72",
      dark ? "bg-[#0d1117]/95 border-white/15 backdrop-blur-md" : "bg-white/95 border-gray-200 backdrop-blur-md",
    )}>
      <div className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "#f0f0f0" }}>
        <div className="flex items-center gap-1.5">
          <Home className={cn("w-3.5 h-3.5", dark ? "text-[#00d4ff]" : "text-blue-500")} />
          <span className={cn("text-xs font-bold truncate", dark ? "text-white" : "text-gray-800")}>
            {barangay.name}
          </span>
        </div>
        <button onClick={onClose}
          className={cn("w-5 h-5 rounded flex items-center justify-center",
            dark ? "hover:bg-white/10 text-white/50" : "hover:bg-gray-100 text-gray-400")}>
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-2 p-3">
        <div className={cn("flex-1 rounded-lg p-2 text-center", dark ? "bg-white/5" : "bg-gray-50")}>
          <p className={cn("text-base font-bold", dark ? "text-[#00d4ff]" : "text-blue-600")}>
            {barangay.activityCount}
          </p>
          <p className={cn("text-[9px] uppercase tracking-wide", dark ? "text-white/40" : "text-gray-500")}>
            Activities
          </p>
        </div>
        <div className={cn("flex-1 rounded-lg p-2 text-center", dark ? "bg-white/5" : "bg-gray-50")}>
          <p className={cn("text-base font-bold", dark ? "text-white" : "text-gray-800")}>
            {numberWithCommas(barangay.participantCount)}
          </p>
          <p className={cn("text-[9px] uppercase tracking-wide", dark ? "text-white/40" : "text-gray-500")}>
            Participants
          </p>
        </div>
      </div>

      {/* Images */}
      {images.length > 0 ? (
        <div className="px-3 pb-3">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20">
            <Image
              src={images[imgIdx]?.url ?? ""}
              alt={images[imgIdx]?.activityTitle ?? "Activity"}
              fill
              className="object-cover"
              unoptimized
            />
            {images.length > 1 && (
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                  className="w-6 h-6 rounded bg-black/50 text-white flex items-center justify-center">
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
                  className="w-6 h-6 rounded bg-black/50 text-white flex items-center justify-center">
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full">
              {imgIdx + 1}/{images.length}
            </div>
          </div>
          <p className={cn("text-[10px] mt-1.5 line-clamp-2", dark ? "text-white/50" : "text-gray-500")}>
            {images[imgIdx]?.activityTitle}
          </p>
        </div>
      ) : (
        <div className={cn("text-center py-4 text-[10px]", dark ? "text-white/30" : "text-gray-400")}>
          No activity images recorded
        </div>
      )}
    </div>
  );
}

// ─── Map Pin SVG ──────────────────────────────────────────────────────────────

function MapPinEl({ color, count, size = 36, pulsing = false, label }: {
  color: string; count: number; size?: number; pulsing?: boolean; label?: string;
}) {
  return (
    <div className="relative flex flex-col items-center" style={{ pointerEvents: "none" }}>
      {pulsing && (
        <div className="absolute rounded-full animate-ping opacity-30"
          style={{
            width: size + 8, height: size + 8,
            top: -4, left: -4,
            backgroundColor: color,
          }} />
      )}
      <div className="rounded-full border-2 flex items-center justify-center font-bold text-white shadow-lg"
        style={{
          width: size, height: size,
          backgroundColor: color,
          borderColor: "rgba(255,255,255,0.4)",
          fontSize: size > 32 ? 12 : 9,
          boxShadow: `0 0 16px ${color}80`,
        }}>
        {count}
      </div>
      {label && (
        <div className="mt-0.5 text-[8px] font-semibold text-white bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ level, province, lgu, dark, onRegion, onProvince, onLGU }: {
  level: MapLevel;
  province: ProvPin | null;
  lgu: LGURow | null;
  dark: boolean;
  onRegion: () => void;
  onProvince: () => void;
  onLGU: () => void;
}) {
  const base = dark ? "text-white/40 hover:text-white/80" : "text-gray-400 hover:text-gray-700";
  const active = dark ? "text-[#00d4ff] font-semibold" : "text-blue-600 font-semibold";

  return (
    <div className={cn(
      "flex items-center gap-1 text-[11px] px-3 py-2 rounded-xl border",
      dark ? "bg-[#0d1117]/80 border-white/10 backdrop-blur-md" : "bg-white/90 border-gray-200 backdrop-blur-md",
    )}>
      <Globe className={cn("w-3 h-3 shrink-0", level === "province" ? (dark ? "text-[#00d4ff]" : "text-blue-500") : (dark ? "text-white/40" : "text-gray-400"))} />
      <button onClick={onRegion} className={cn("transition-colors", level === "province" ? active : base)}>
        Bicol Region
      </button>
      {province && (
        <>
          <ChevronRight className={cn("w-3 h-3 shrink-0", dark ? "text-white/20" : "text-gray-300")} />
          <MapPin className={cn("w-3 h-3 shrink-0", level === "lgu" ? (dark ? "text-[#00d4ff]" : "text-blue-500") : (dark ? "text-white/40" : "text-gray-400"))} />
          <button onClick={onProvince} className={cn("transition-colors truncate max-w-[100px]",
            level === "lgu" ? active : base)}>
            {province.provinceName}
          </button>
        </>
      )}
      {lgu && (
        <>
          <ChevronRight className={cn("w-3 h-3 shrink-0", dark ? "text-white/20" : "text-gray-300")} />
          <Building2 className={cn("w-3 h-3 shrink-0", dark ? "text-[#00d4ff]" : "text-blue-500")} />
          <span className={cn("truncate max-w-[80px]", active)}>{lgu.name}</span>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FrontPage() {
  const [dark, setDark] = useState(true);
  const [loadingDone, setLoadingDone] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [MapLib, setMapLib] = useState<any>(null);

  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [mapLevel, setMapLevel] = useState<MapLevel>("province");
  const [selProvince, setSelProvince] = useState<ProvPin | null>(null);
  const [selLGU, setSelLGU] = useState<LGURow | null>(null);
  const [selBarangay, setSelBarangay] = useState<BarangayRow | null>(null);

  const [viewState, setViewState] = useState({
    longitude: PH_CENTER.longitude,
    latitude:  PH_CENTER.latitude,
    zoom:      PH_CENTER.zoom,
  });

  const mapRef = useRef<any>(null);

  // ── Scroll functions ───────────────────────────────────────
  const scrollToMission = () => {
    document.getElementById('mission-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMap = () => {
    setIsLocked(false); // Unlock to allow navigation
    setTimeout(() => {
      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Track if user is locked in DTC section
  const [isLocked, setIsLocked] = useState(false);

  // ── Lock scroll when entering DTC section ──────────────────
  useEffect(() => {
    const container = document.querySelector('.scroll-container') as HTMLElement;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const windowHeight = window.innerHeight;
      
      // If scrolled past 80% of first screen, lock in DTC section
      if (scrollTop > windowHeight * 0.8 && !isLocked) {
        setIsLocked(true);
        // Snap to DTC section
        document.getElementById('mission-section')?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLocked]);

  // ── Prevent all scroll when locked ─────────────────────────
  useEffect(() => {
    if (!isLocked) return;

    const preventScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Disable all scroll methods
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('scroll', preventScroll, { passive: false });
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('scroll', preventScroll);
      document.body.style.overflow = '';
    };
  }, [isLocked]);

  // ── Load Mapbox ────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    import("react-map-gl").then((m) => {
      setMapLib(m);
    });
  }, []);

  // ── Loading sequence ───────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setLoadingDone(true), 2800);
    return () => clearTimeout(t);
  }, []);

  // ── Fly to Bicol after loading ─────────────────────────────
  useEffect(() => {
    if (!loadingDone || !mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.flyTo({
        center: [BICOL_CENTER.longitude, BICOL_CENTER.latitude],
        zoom: BICOL_CENTER.zoom,
        duration: 2500,
        essential: true,
      });
    }, 400);
  }, [loadingDone, mapReady]);

  // ── Convex data ────────────────────────────────────────────
  const filterProjectData = useQuery(
    api.projects.getByCode,
    selectedProgram ? { code: selectedProgram } : "skip"
  );
  const provincePins = useQuery(api.activities.activitiesByProvince, {
    projectId: selectedProgram && filterProjectData ? filterProjectData._id : undefined,
    year: CURRENT_YEAR,
  });
  const summary = useQuery(api.activities.dashboardSummary, {
    year: CURRENT_YEAR,
    projectCode: selectedProgram ?? undefined,
  });
  const lguActivityData = useQuery(
    api.activities.activitiesByLGU,
    selProvince
      ? {
          provinceId: selProvince.provinceId as any,
          projectId: selectedProgram && filterProjectData ? filterProjectData._id : undefined,
          year: CURRENT_YEAR,
        }
      : "skip"
  );
  const barangayData = useQuery(
    api.activities.activitiesBarangayBreakdown,
    selProvince
      ? {
          provinceId: selProvince.provinceId as any,
          lguId: selLGU?.lguId ? (selLGU.lguId as any) : undefined,
          projectId: selectedProgram && filterProjectData ? filterProjectData._id : undefined,
          year: CURRENT_YEAR,
        }
      : "skip"
  );
  const barangayImages = useQuery(
    api.activityImages.getRecentImagesForDashboard,
    selProvince
      ? { provinceId: selProvince.provinceId as any, year: CURRENT_YEAR, limit: 20 }
      : "skip"
  );

  // ── Build province pins ────────────────────────────────────
  const provPins = useMemo<ProvPin[]>(() => {
    return (provincePins ?? []).map(p => {
      const r5 = R5_PROVINCE_COORDS[p.provinceName];
      return { ...p, provinceId: p.provinceId, lat: r5?.[1] ?? p.lat, lng: r5?.[0] ?? p.lng };
    });
  }, [provincePins]);

  // ── Build LGU rows ─────────────────────────────────────────
  const lguRows = useMemo<LGURow[]>(() => {
    if (!selProvince) return [];
    const r5Prov = R5_GEO[selProvince.provinceName];
    if (!r5Prov) return [];
    return Object.entries(r5Prov).map(([lguName, geo]) => {
      const lower = lguName.toLowerCase();
      const matched = (lguActivityData ?? []).find(a =>
        a.lguName.toLowerCase() === lower ||
        a.lguName.toLowerCase().includes(lower) ||
        lower.includes(a.lguName.toLowerCase())
      );
      return {
        name: lguName,
        lng: geo.coords[0],
        lat: geo.coords[1],
        barangays: geo.barangays,
        activityCount:    matched?.activityCount    ?? 0,
        participantCount: matched?.participantCount ?? 0,
        lguId: matched?.lguId,
      };
    });
  }, [selProvince, lguActivityData]);

  // ── Build barangay rows ────────────────────────────────────
  const barangayRows = useMemo<BarangayRow[]>(() => {
    if (!selLGU) return [];
    const activeMap = new Map<string, { count: number; participants: number }>();
    for (const b of barangayData ?? []) {
      if (b.barangay !== "(No barangay)") {
        activeMap.set(b.barangay.toLowerCase(), { count: b.activityCount, participants: b.participantCount });
      }
    }
    return selLGU.barangays.map(b => {
      const matched = activeMap.get(b.name.toLowerCase());
      return {
        name: b.name,
        coords: b.coords,
        activityCount: matched?.count ?? 0,
        participantCount: matched?.participants ?? 0,
      };
    });
  }, [selLGU, barangayData]);

  // ── Barangay images ────────────────────────────────────────
  const barangayImagesForSel = useMemo(() => {
    if (!selBarangay || !barangayImages) return [];
    return barangayImages.filter((img: any) =>
      img.barangay?.toLowerCase() === selBarangay.name.toLowerCase()
    );
  }, [selBarangay, barangayImages]);

  // ── Fly helpers ────────────────────────────────────────────
  const flyTo = useCallback((lng: number, lat: number, zoom: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1200, essential: true });
  }, []);

  const handleProvinceClick = useCallback((pin: ProvPin) => {
    setSelProvince(pin);
    setSelLGU(null);
    setSelBarangay(null);
    setMapLevel("lgu");
    flyTo(pin.lng, pin.lat, 10);
  }, [flyTo]);

  const handleLGUClick = useCallback((lgu: LGURow) => {
    setSelLGU(lgu);
    setSelBarangay(null);
    setMapLevel("barangay");
    flyTo(lgu.lng, lgu.lat, 12.5);
  }, [flyTo]);

  const handleBarangayClick = useCallback((brgy: BarangayRow) => {
    setSelBarangay(brgy);
  }, []);

  const handleProgramSelect = useCallback((code: string) => {
    setSelectedProgram(prev => prev === code ? null : code);
    setSelProvince(null);
    setSelLGU(null);
    setSelBarangay(null);
    setMapLevel("province");
    flyTo(BICOL_CENTER.longitude, BICOL_CENTER.latitude, BICOL_CENTER.zoom);
  }, [flyTo]);

  const resetToRegion = useCallback(() => {
    setSelProvince(null);
    setSelLGU(null);
    setSelBarangay(null);
    setMapLevel("province");
    flyTo(BICOL_CENTER.longitude, BICOL_CENTER.latitude, BICOL_CENTER.zoom);
  }, [flyTo]);

  const resetToProvince = useCallback(() => {
    if (!selProvince) return;
    setSelLGU(null);
    setSelBarangay(null);
    setMapLevel("lgu");
    flyTo(selProvince.lng, selProvince.lat, 10);
  }, [selProvince, flyTo]);

  const selectedProjectDef = DICT_PROJECTS.find(p => p.code === selectedProgram) ?? null;
  const maxProv = Math.max(...provPins.map(p => p.activityCount), 1);
  const maxLGU  = Math.max(...lguRows.map(l => l.activityCount), 1);

  const mapStyle = dark
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11";

  // ── Styles ─────────────────────────────────────────────────
  const bgClass = dark ? "bg-[#06060f] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = dark
    ? "bg-[#0d1117]/80 border-white/10 backdrop-blur-md"
    : "bg-white/90 border-gray-200 backdrop-blur-md";

  return (
    <div className="scroll-container h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth">
      {/* ── MAP SECTION ── */}
      <div id="map-section" className={cn("snap-start relative h-screen overflow-hidden", bgClass)}>
      {/* Loading overlay */}
      <LoadingScreen done={loadingDone} />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className={cn(
        "absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2.5 border-b",
        dark ? "bg-[#06060f]/80 border-white/10 backdrop-blur-md" : "bg-white/90 border-gray-200 backdrop-blur-md",
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center border text-sm font-black",
            dark ? "bg-[#00d4ff]/10 border-[#00d4ff]/30 text-white" : "bg-blue-50 border-blue-200 text-blue-700",
          )}>
            <span style={{ color: dark ? "#00d4ff" : "#2563eb" }}>D</span>ICT
          </div>
          <div>
            <p className={cn("text-sm font-bold leading-tight", dark ? "text-white" : "text-gray-900")}>
              DICT Region V
            </p>
            <p className={cn("text-[10px] leading-tight", dark ? "text-white/40" : "text-gray-400")}>
              Program Management · Bicol Region
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Breadcrumb */}
          {loadingDone && (selProvince || mapLevel !== "province") && (
            <Breadcrumb
              level={mapLevel}
              province={selProvince}
              lgu={selLGU}
              dark={dark}
              onRegion={resetToRegion}
              onProvince={resetToProvince}
              onLGU={() => {}}
            />
          )}

          {/* Dark/light toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className={cn(
              "w-9 h-9 rounded-xl border flex items-center justify-center transition-all",
              dark ? "bg-white/5 border-white/15 hover:bg-white/10 text-yellow-300"
                   : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700",
            )}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link href="/dashboard">
            <button className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
              dark
                ? "bg-[#00d4ff]/10 border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/20"
                : "bg-blue-600 border-blue-700 text-white hover:bg-blue-700",
            )}>
              Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </header>

      {/* ── Left program panel ─────────────────────────────── */}
      <div className={cn(
        "absolute left-3 top-[52px] bottom-3 z-30 w-48 flex flex-col gap-2 overflow-hidden",
      )}>
        <div className={cn("rounded-xl border p-2 flex flex-col gap-1.5", panelClass)}>
          <p className={cn("text-[9px] uppercase tracking-widest px-1 mb-0.5", dark ? "text-white/30" : "text-gray-400")}>
            Programs
          </p>
          {LEFT_PROGRAMS.map(proj => (
            <ProgramBtn
              key={proj.code}
              project={proj}
              selected={selectedProgram === proj.code}
              onClick={() => handleProgramSelect(proj.code)}
              dark={dark}
              activityCount={summary?.summary?.find((s: any) => s.code === proj.code)?.totalActivities}
            />
          ))}
        </div>

        {/* Zoom controls */}
        {loadingDone && (
          <div className={cn("rounded-xl border p-1.5 flex flex-col gap-1", panelClass)}>
            <button
              onClick={() => setViewState(v => ({ ...v, zoom: Math.min(v.zoom + 1, 18) }))}
              className={cn(
                "w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all",
                dark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-100 text-gray-600",
              )}>
              <ZoomIn className="w-3.5 h-3.5" /> Zoom In
            </button>
            <button
              onClick={() => setViewState(v => ({ ...v, zoom: Math.max(v.zoom - 1, 3) }))}
              className={cn(
                "w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all",
                dark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-100 text-gray-600",
              )}>
              <ZoomOut className="w-3.5 h-3.5" /> Zoom Out
            </button>
            <button
              onClick={resetToRegion}
              className={cn(
                "w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all",
                dark ? "hover:bg-white/10 text-[#00d4ff]/60" : "hover:bg-blue-50 text-blue-500",
              )}>
              <Globe className="w-3.5 h-3.5" /> Reset View
            </button>
          </div>
        )}
      </div>

      {/* ── Right panel ────────────────────────────────────── */}
      <div className="absolute right-3 top-[52px] bottom-3 z-30 w-52 flex flex-col gap-2 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: "none" }}>
        <div className={cn("rounded-xl border p-2 flex flex-col gap-1.5", panelClass)}>
          <p className={cn("text-[9px] uppercase tracking-widest px-1 mb-0.5", dark ? "text-white/30" : "text-gray-400")}>
            Programs
          </p>
          {RIGHT_PROGRAMS.map(proj => (
            <ProgramBtn
              key={proj.code}
              project={proj}
              selected={selectedProgram === proj.code}
              onClick={() => handleProgramSelect(proj.code)}
              dark={dark}
              activityCount={summary?.summary?.find((s: any) => s.code === proj.code)?.totalActivities}
            />
          ))}
        </div>

        {/* Stats panel for selected program */}
        {selectedProjectDef && (
          <StatsPanel
            project={selectedProjectDef}
            dark={dark}
            summary={summary}
            onClose={() => setSelectedProgram(null)}
          />
        )}

        {/* Barangay popup */}
        {selBarangay && (
          <BarangayPopup
            barangay={selBarangay}
            dark={dark}
            images={barangayImagesForSel}
            onClose={() => setSelBarangay(null)}
          />
        )}

        {/* Level info when province/lgu selected */}
        {!selBarangay && selProvince && (
          <div className={cn("rounded-xl border p-3", panelClass)}>
            <div className="flex items-center gap-2 mb-2">
              {mapLevel === "lgu"
                ? <Building2 className={cn("w-4 h-4", dark ? "text-[#00d4ff]" : "text-blue-500")} />
                : <Home className={cn("w-4 h-4", dark ? "text-[#00d4ff]" : "text-blue-500")} />
              }
              <span className={cn("text-xs font-bold", dark ? "text-white" : "text-gray-800")}>
                {mapLevel === "lgu" ? selProvince.provinceName : selLGU?.name}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className={cn("rounded-lg p-2 text-center", dark ? "bg-white/5" : "bg-gray-50")}>
                <p className={cn("text-sm font-bold", dark ? "text-[#00d4ff]" : "text-blue-600")}>
                  {mapLevel === "lgu" ? selProvince.activityCount : selLGU?.activityCount ?? 0}
                </p>
                <p className={cn("text-[9px] uppercase tracking-wide", dark ? "text-white/40" : "text-gray-400")}>
                  Activities
                </p>
              </div>
              <div className={cn("rounded-lg p-2 text-center", dark ? "bg-white/5" : "bg-gray-50")}>
                <p className={cn("text-sm font-bold", dark ? "text-white" : "text-gray-700")}>
                  {numberWithCommas(mapLevel === "lgu" ? selProvince.participantCount : selLGU?.participantCount ?? 0)}
                </p>
                <p className={cn("text-[9px] uppercase tracking-wide", dark ? "text-white/40" : "text-gray-400")}>
                  Participants
                </p>
              </div>
            </div>
            <p className={cn("text-[9px] mt-2 text-center", dark ? "text-white/30" : "text-gray-400")}>
              {mapLevel === "lgu"
                ? "Click an LGU marker to drill down"
                : "Click a barangay to see activities"}
            </p>
          </div>
        )}
      </div>

      {/* ── Map ────────────────────────────────────────────── */}
      <div className="absolute inset-0 top-[52px]">
        {!MapLib ? (
          <div className={cn("flex items-center justify-center h-full", dark ? "bg-[#0a0a1a]" : "bg-gray-100")}>
            <div className={cn("text-sm", dark ? "text-white/30" : "text-gray-400")}>
              {!MAPBOX_TOKEN ? "No Mapbox token configured" : "Loading map…"}
            </div>
          </div>
        ) : (
          <MapLib.Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={mapStyle}
            {...viewState}
            onMove={(e: any) => setViewState(e.viewState)}
            onLoad={() => setMapReady(true)}
            style={{ width: "100%", height: "100%" }}
            cursor="auto"
          >
            {/* Province pins */}
            {mapLevel === "province" && provPins.map(pin => (
              <MapLib.Marker
                key={pin.provinceId}
                longitude={pin.lng}
                latitude={pin.lat}
                onClick={(e: any) => { e.originalEvent.stopPropagation(); handleProvinceClick(pin); }}
                style={{ cursor: "pointer" }}
              >
                <MapPinEl
                  color={selectedProjectDef?.color ?? "#0ea5e9"}
                  count={pin.activityCount}
                  size={Math.max(32, Math.min(52, 32 + (pin.activityCount / maxProv) * 20))}
                  pulsing={selectedProgram !== null}
                  label={pin.provinceName.replace("Camarines ", "Cam.")}
                />
              </MapLib.Marker>
            ))}

            {/* LGU pins */}
            {mapLevel === "lgu" && lguRows.filter(l => l.activityCount > 0 || true).map((lgu, i) => (
              <MapLib.Marker
                key={`${lgu.name}-${i}`}
                longitude={lgu.lng}
                latitude={lgu.lat}
                onClick={(e: any) => { e.originalEvent.stopPropagation(); handleLGUClick(lgu); }}
                style={{ cursor: "pointer" }}
              >
                <div className="relative flex flex-col items-center" style={{ pointerEvents: "none" }}>
                  <div
                    className="rounded-full border-2 flex items-center justify-center font-bold text-white text-[9px]"
                    style={{
                      width: lgu.activityCount > 0 ? Math.max(24, Math.min(38, 24 + (lgu.activityCount / maxLGU) * 14)) : 18,
                      height: lgu.activityCount > 0 ? Math.max(24, Math.min(38, 24 + (lgu.activityCount / maxLGU) * 14)) : 18,
                      backgroundColor: lgu.activityCount > 0 ? "#7c3aed" : (dark ? "#ffffff20" : "#e5e7eb"),
                      borderColor: "rgba(255,255,255,0.3)",
                      boxShadow: lgu.activityCount > 0 ? "0 0 12px #7c3aed80" : "none",
                    }}>
                    {lgu.activityCount > 0 ? lgu.activityCount : "·"}
                  </div>
                  <div className="mt-0.5 text-[7px] font-semibold text-white bg-black/60 px-1 py-0.5 rounded-full whitespace-nowrap"
                    style={{ maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {lgu.name}
                  </div>
                </div>
              </MapLib.Marker>
            ))}

            {/* Barangay pins */}
            {mapLevel === "barangay" && barangayRows.map((brgy, i) => (
              <MapLib.Marker
                key={`${brgy.name}-${i}`}
                longitude={brgy.coords[0]}
                latitude={brgy.coords[1]}
                onClick={(e: any) => { e.originalEvent.stopPropagation(); handleBarangayClick(brgy); }}
                style={{ cursor: "pointer" }}
              >
                <div className="relative flex flex-col items-center" style={{ pointerEvents: "none" }}>
                  <div
                    className="rounded-full border flex items-center justify-center"
                    style={{
                      width: brgy.activityCount > 0 ? 16 : 8,
                      height: brgy.activityCount > 0 ? 16 : 8,
                      backgroundColor: brgy.activityCount > 0 ? "#f59e0b" : (dark ? "#ffffff30" : "#d1d5db"),
                      borderColor: "rgba(255,255,255,0.4)",
                      boxShadow: brgy.activityCount > 0 ? "0 0 8px #f59e0b80" : "none",
                      fontSize: 7,
                      color: "white",
                      fontWeight: "bold",
                    }}>
                    {brgy.activityCount > 0 ? brgy.activityCount : ""}
                  </div>
                  {brgy.activityCount > 0 && (
                    <div className="mt-0.5 text-[6px] font-semibold text-white bg-black/70 px-1 py-0.5 rounded-full whitespace-nowrap"
                      style={{ maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {brgy.name}
                    </div>
                  )}
                </div>
              </MapLib.Marker>
            ))}
          </MapLib.Map>
        )}
      </div>

      {/* ── Bottom info strip ──────────────────────────────── */}
      {loadingDone && (
        <div className={cn(
          "absolute bottom-3 left-[204px] right-[220px] z-30 flex items-center justify-between px-4 py-2 rounded-xl border",
          panelClass,
        )}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Activity className={cn("w-3.5 h-3.5", dark ? "text-[#00d4ff]" : "text-blue-500")} />
              <span className={cn("text-xs font-semibold", dark ? "text-white" : "text-gray-800")}>
                {numberWithCommas(summary?.totalActivities ?? 0)}
              </span>
              <span className={cn("text-[10px]", dark ? "text-white/40" : "text-gray-400")}>activities</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className={cn("w-3.5 h-3.5", dark ? "text-violet-400" : "text-violet-600")} />
              <span className={cn("text-xs font-semibold", dark ? "text-white" : "text-gray-800")}>
                {numberWithCommas(summary?.totalParticipants ?? 0)}
              </span>
              <span className={cn("text-[10px]", dark ? "text-white/40" : "text-gray-400")}>participants</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className={cn("w-3.5 h-3.5", dark ? "text-green-400" : "text-green-600")} />
              <span className={cn("text-xs font-semibold", dark ? "text-white" : "text-gray-800")}>
                {summary
                  ? getCompletionRate(
                      (summary.byStatus?.validated ?? 0) + (summary.byStatus?.reported ?? 0),
                      summary.totalActivities
                    )
                  : 0}%
              </span>
              <span className={cn("text-[10px]", dark ? "text-white/40" : "text-gray-400")}>completion</span>
            </div>
          </div>

          <div className={cn("flex items-center gap-1 text-[10px]", dark ? "text-white/30" : "text-gray-400")}>
            <MapPin className="w-3 h-3" />
            {mapLevel === "province" && "Click a province marker to explore"}
            {mapLevel === "lgu"       && `Exploring ${selProvince?.provinceName} · Click an LGU`}
            {mapLevel === "barangay"  && `Exploring ${selLGU?.name} · Click a barangay for details`}
          </div>
        </div>
      )}

      {/* ── Scroll Down Button ── */}
      <button
        onClick={scrollToMission}
        title="Scroll down for more information"
        className={cn(
          "absolute bottom-8 left-1/2 -translate-x-1/2 z-50",
          "w-10 h-10 rounded-full border transition-all",
          "hover:scale-110 animate-bounce",
          dark
            ? "bg-[#00d4ff]/5 border-[#00d4ff]/20 text-[#00d4ff]/60 hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]"
            : "bg-white/50 border-gray-300/50 text-gray-400 hover:bg-white hover:border-gray-400 hover:text-gray-600"
        )}
      >
        <ChevronDown className="w-5 h-5 mx-auto" />
      </button>
    </div>

    {/* ── DIGITAL TRANSFORMATION CENTER SECTION ── */}
    <div 
      id="mission-section" 
      className={cn(
        "snap-start relative min-h-screen",
        isLocked ? "overflow-y-auto" : "overflow-hidden"
      )}
      style={{ background: dark ? '#0e0f0d' : '#f8f9fa' }}
    >
      {/* Scroll to Top Button */}
      <button
        onClick={scrollToMap}
        title="Back to map"
        className={cn(
          "absolute top-8 left-1/2 -translate-x-1/2 z-50",
          "w-10 h-10 rounded-full border transition-all",
          "hover:scale-110",
          dark
            ? "bg-[#00d4ff]/5 border-[#00d4ff]/20 text-[#00d4ff]/60 hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]"
            : "bg-white/50 border-gray-300/50 text-gray-400 hover:bg-white hover:border-gray-400 hover:text-gray-600"
        )}
      >
        <ChevronUp className="w-5 h-5 mx-auto" />
      </button>

      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col justify-center items-center text-center px-6 pt-20">
        {/* Background with DICT building image */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* DICT Building Image - subtle overlay */}
          <div className="absolute inset-0">
            <Image
              src="/dict-building.jpg"
              alt="DICT Building"
              fill
              className="object-cover"
              style={{ 
                opacity: dark ? 0.08 : 0.12,
                filter: dark ? 'grayscale(100%) brightness(0.4)' : 'grayscale(50%) brightness(1.2)'
              }}
              priority
            />
          </div>
          
          {/* Gradient overlays */}
          <div className={cn(
            "absolute inset-0",
            dark 
              ? "bg-gradient-to-br from-blue-950/50 via-[#070e1b] to-[#070e1b]"
              : "bg-gradient-to-br from-blue-50 via-white to-gray-50"
          )} />
          <div 
            className="absolute inset-0 opacity-[0.022]" 
            style={{ 
              backgroundImage: dark 
                ? 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)'
                : 'linear-gradient(rgba(0,0,0,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.05) 1px,transparent 1px)', 
              backgroundSize: '60px 60px' 
            }} 
          />
          <div 
            className={cn(
              "absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full blur-3xl",
              dark ? "opacity-[0.06]" : "opacity-[0.15]"
            )}
            style={{ background: dark ? 'radial-gradient(circle,#3b82f6,transparent)' : 'radial-gradient(circle,#60a5fa,transparent)' }} 
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          <div className={cn(
            "text-xs font-bold uppercase tracking-[4px] mb-6",
            dark ? "text-[#00d4ff]" : "text-blue-600"
          )}>
            DICT Region V · Bicol
          </div>
          
          <h1 className={cn(
            "text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight",
            dark ? "text-white" : "text-gray-900"
          )}>
            Digital Transformation
            <br />
            <span style={{ color: dark ? "#00d4ff" : "#2563eb" }}>Center</span>
          </h1>

          <p className={cn(
            "text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed",
            dark ? "text-white/60" : "text-gray-600"
          )}>
            Free digital services for every Bicolano — Empowering communities through technology access and digital literacy
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Link href="/dtc-logbook">
              <button className={cn(
                "px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-105 shadow-lg",
                dark
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}>
                🖥️ Open Logbook →
              </button>
            </Link>
            <Link href="/intern-logbook">
              <button className={cn(
                "px-8 py-4 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-lg border",
                dark
                  ? "bg-white/10 border-white/20 text-white hover:bg-white/15"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              )}>
                🎓 Intern Logbook
              </button>
            </Link>
            <Link href="/event">
              <button className={cn(
                "px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-105 shadow-lg",
                "bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-500 text-white",
                "shadow-violet-500/30 border border-violet-400/30"
              )}>
                ✨ Events Calendar
              </button>
            </Link>
          </div>

          {/* Staff Portal Links */}
          <div className={cn(
            "flex items-center justify-center gap-3 text-sm pt-4",
            dark ? "text-white/40" : "text-gray-500"
          )}>
            <span>Staff portal:</span>
            <Link href="/intern/login" className={cn(
              "underline underline-offset-2 transition-colors",
              dark ? "text-violet-300/80 hover:text-violet-200" : "text-violet-600 hover:text-violet-700"
            )}>
              Intern
            </Link>
            <span className={dark ? "text-white/15" : "text-gray-300"}>·</span>
            <Link href="/supervisor/login" className={cn(
              "underline underline-offset-2 transition-colors",
              dark ? "text-indigo-300/80 hover:text-indigo-200" : "text-indigo-600 hover:text-indigo-700"
            )}>
              Supervisor
            </Link>
            <span className={dark ? "text-white/15" : "text-gray-300"}>·</span>
            <Link href="/sign-in" className={cn(
              "underline underline-offset-2 transition-colors",
              dark ? "text-white/30 hover:text-white/60" : "text-gray-400 hover:text-gray-600"
            )}>
              Admin
            </Link>
          </div>
        </div>
      </div>

      {/* 3D Horizontal Showcase */}
      <DTCShowcase dark={dark} />

      {/* Stats Section */}
      <div className={cn(
        "py-16 px-6 border-t",
        dark ? "border-white/5 bg-white/[0.012]" : "border-gray-200 bg-gray-50/50"
      )}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '12', label: 'Workstations', color: dark ? 'text-blue-400' : 'text-blue-600' },
            { value: '100%', label: 'Always Free', color: dark ? 'text-emerald-400' : 'text-emerald-600' },
            { value: '50+', label: 'Daily Users', color: dark ? 'text-amber-400' : 'text-amber-600' },
            { value: '24/7', label: 'Support', color: dark ? 'text-violet-400' : 'text-violet-600' },
          ].map((stat) => (
            <div 
              key={stat.label} 
              className={cn(
                "rounded-xl p-6 text-center transition-all hover:scale-105",
                dark ? "bg-white/[0.02] hover:bg-white/[0.04]" : "bg-white hover:bg-gray-50 border border-gray-200"
              )}
            >
              <p className={cn("text-3xl sm:text-4xl font-black mb-2", stat.color)}>
                {stat.value}
              </p>
              <p className={cn("text-xs font-medium uppercase tracking-wide", dark ? "text-gray-500" : "text-gray-600")}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      
      {/* Facebook Page Embed */}
      <FacebookPageEmbed />

      {/* DTC Offices Section */}
      <DTCOffices />
    </div>
  </div>
  );
}
