"use client";

import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import Link from "next/link";
import { X, Globe, MapPin, Home, ZoomIn, ZoomOut } from "lucide-react";
import { cn, numberWithCommas, getCompletionRate } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR } from "@/lib/types";
import { R5_PROVINCE_COORDS, R5_GEO } from "@/lib/r5-data";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const BICOL_CENTER = { longitude: 123.5, latitude: 13.0, zoom: 7.5 };
const PH_CENTER = { longitude: 122.0, latitude: 12.0, zoom: 5.0 };
const CYAN = "#00d4ff";
const BLUE = "#0ea5e9";

const LOGO_MAP: Record<string, string> = {
  EGOV: "egov_ph_logo.png", ELGU: "elgu_logo.png",
  FREEWIFI: "freewifi_logo.png", GOVNET: "govnet_logo.png",
  NBP: "nbp_logo.png", CYBER: "cybersecurity_logo.png",
  PNPKI: "pnpki_logo.png", DRRM: "drrm_logo.png",
  ILCDB: "ilcdb_logo.jpg", IIDB: "iidb_logo.png",
};

const LEFT_PROGRAMS = DICT_PROJECTS.slice(0, 5);
const RIGHT_PROGRAMS = DICT_PROJECTS.slice(5, 10);

const PROVINCES_STATIC = [
  { name: "Albay", short: "Albay", lat: 13.18, lng: 123.63 },
  { name: "Camarines Norte", short: "Cam. N.", lat: 14.14, lng: 122.76 },
  { name: "Camarines Sur", short: "Cam. S.", lat: 13.63, lng: 123.19 },
  { name: "Catanduanes", short: "Catand.", lat: 13.71, lng: 124.24 },
  { name: "Masbate", short: "Masbate", lat: 12.37, lng: 123.62 },
  { name: "Sorsogon", short: "Sorsogon", lat: 12.97, lng: 124.00 },
];

interface BoxDef { id: string; kind: string; side?: "left" | "right"; }

const BOXES: Record<string, BoxDef> = {
  "3,3": { id: "home", kind: "hero" },
  "3,2": { id: "mission", kind: "mission" },
  "3,1": { id: "logbook", kind: "logbook" },
  "3,4": { id: "showcase", kind: "showcase" },
  "3,5": { id: "events", kind: "events" },
  "2,3": { id: "map", kind: "map" },
  "1,3": { id: "programsL", kind: "programs", side: "left" },
  "4,3": { id: "stats", kind: "stats" },
  "5,3": { id: "programsR", kind: "programs", side: "right" },
  "2,2": { id: "offices", kind: "offices" },
  "4,2": { id: "dashboard", kind: "dashboard" },
  "2,4": { id: "provinces", kind: "provinces" },
  "4,4": { id: "social", kind: "social" },
};

const COORDS: Array<[number, number]> = Object.keys(BOXES).map(
  (k) => k.split(",").map(Number) as [number, number],
);

const BOX_TITLES: Record<string, string> = {
  home: "Home · Origin", mission: "DTC · Mission", logbook: "Logbooks",
  showcase: "DTC Showcase", events: "Events", map: "Interactive Map",
  programsL: "Programs · 01-05", programsR: "Programs · 06-10",
  stats: "Region V · Stats", offices: "DTC Offices",
  dashboard: "Admin Dashboard", provinces: "6 Provinces", social: "Facebook · Social",
};

type MapLevel = "province" | "lgu" | "barangay";

interface ProvPin {
  provinceId: string; provinceName: string;
  lat: number; lng: number;
  activityCount: number; participantCount: number;
  byProject: Record<string, number>;
}
interface LGURow {
  name: string; lng: number; lat: number;
  barangays: Array<{ name: string; coords: [number, number] }>;
  activityCount: number; participantCount: number;
  lguId?: string;
}
interface BarangayRow {
  name: string; coords: [number, number];
  activityCount: number; participantCount: number;
}

// ─── Shared Context ───────────────────────────────────────────────────────────
interface LandingCtxType {
  summary: any;
  selectedProgram: string | null;
  setSelectedProgram: (code: string | null) => void;
  navigateTo: (c: number, r: number) => void;
  MapLib: any;
  mapRef: React.RefObject<any>;
  viewState: any;
  setViewState: (v: any) => void;
  mapLevel: MapLevel;
  selProvince: ProvPin | null;
  selLGU: LGURow | null;
  selBarangay: BarangayRow | null;
  provPins: ProvPin[];
  lguRows: LGURow[];
  barangayRows: BarangayRow[];
  handleProvinceClick: (p: ProvPin) => void;
  handleLGUClick: (l: LGURow) => void;
  handleBarangayClick: (b: BarangayRow) => void;
  resetToRegion: () => void;
  resetToProvince: () => void;
  setSelBarangay: (b: BarangayRow | null) => void;
  setMapReady: (b: boolean) => void;
  isMapActive: boolean;
}
const LandingCtx = createContext<LandingCtxType | null>(null);
const useLanding = () => useContext(LandingCtx) as LandingCtxType;

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
      setProgress((p) => Math.min(p + 2, done ? 100 : 92));
    }, 40);
    return () => clearInterval(interval);
  }, [done]);

  return (
    <div className={cn(
      "fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-700 bg-[#06060f]",
      done ? "opacity-0 pointer-events-none" : "opacity-100",
    )}>
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }} />
      <div className={cn("flex flex-col items-center gap-8 transition-all duration-700",
        phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl blur-xl opacity-60"
            style={{ background: "linear-gradient(135deg, #00d4ff, #0ea5e9)" }} />
          <div className="relative w-24 h-24 rounded-2xl bg-[#0a0a1a] border border-[#00d4ff]/30 flex items-center justify-center shadow-2xl">
            <span className="text-3xl font-black tracking-tight text-white">
              <span style={{ color: "#00d4ff" }}>D</span>ICT
            </span>
          </div>
        </div>
        <div className={cn("text-center transition-all duration-500",
          phase >= 2 ? "opacity-100" : "opacity-0")}>
          <h1 className="text-4xl font-black tracking-tight text-white">
            DICT <span style={{ color: "#00d4ff" }}>Region V</span>
          </h1>
          <p className="text-sm text-[#00d4ff]/60 mt-2 tracking-widest uppercase">
            Program Management System
          </p>
        </div>
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

// ─── Box Shell ────────────────────────────────────────────────────────────────
function Shell({ tag, title, accent = CYAN, children, lead }: {
  tag: string; title: string; accent?: string;
  children?: React.ReactNode; lead?: string;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      padding: "clamp(36px,4.8vw,72px)",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      gap: "clamp(24px,3vh,40px)",
      background: `radial-gradient(ellipse at 100% 0%, ${accent}1f, transparent 55%),
                   radial-gradient(ellipse at 0% 100%, ${accent}10, transparent 60%),
                   linear-gradient(155deg, #0a0a1a 0%, #0d1117 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.35,
        backgroundImage: `radial-gradient(${accent}1a 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        maskImage: "radial-gradient(ellipse at top right, #000, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "min(1100px,85%)" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "7px 14px", borderRadius: 99,
          background: `${accent}14`, border: `1px solid ${accent}40`,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "clamp(10px,0.75vw,12px)", letterSpacing: 2,
          color: accent, marginBottom: "clamp(20px,3vh,36px)",
          textTransform: "uppercase",
        }}>{tag}</div>
        <h2 style={{
          fontFamily: "inherit", fontWeight: 800,
          fontSize: "clamp(32px,5vw,84px)",
          lineHeight: 1.02, letterSpacing: "-0.035em",
          color: "#fff", whiteSpace: "pre-line",
          marginBottom: lead ? "clamp(16px,2.4vh,28px)" : 0,
        }}>{title}</h2>
        {lead && (
          <p style={{
            fontSize: "clamp(15px,1.2vw,21px)", lineHeight: 1.5,
            color: "rgba(255,255,255,0.6)", maxWidth: "min(720px,90%)", fontWeight: 300,
          }}>{lead}</p>
        )}
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Box: Hero ────────────────────────────────────────────────────────────────
function HeroBox() {
  const { navigateTo } = useLanding();
  return (
    <div style={{
      width: "100%", height: "100%",
      padding: "clamp(40px,5.5vw,90px)",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      background: `radial-gradient(ellipse at 15% 0%, ${CYAN}22, transparent 55%),
                   radial-gradient(ellipse at 100% 100%, ${BLUE}1a, transparent 60%),
                   linear-gradient(155deg, #0a0a1a 0%, #06060f 100%)`,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.5,
        backgroundImage: `radial-gradient(${CYAN}22 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at center, #000 20%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "clamp(24px,3vh,40px)", right: "clamp(24px,3vw,48px)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: "clamp(56px,4.5vw,76px)", height: "clamp(56px,4.5vw,76px)",
          borderRadius: 18, background: "rgba(10,10,26,1)",
          border: `1px solid ${CYAN}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: "clamp(20px,1.7vw,28px)", letterSpacing: "-0.04em",
          boxShadow: `0 0 30px ${CYAN}33`,
        }}>
          <span style={{ color: CYAN }}>D</span><span style={{ color: "#fff" }}>ICT</span>
        </div>
      </div>

      <div className="bm-fade-up" style={{ position: "relative", zIndex: 1, maxWidth: "min(1200px,82%)" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "9px 18px", borderRadius: 99,
          background: "rgba(0,212,255,0.08)",
          border: "1px solid rgba(0,212,255,0.25)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "clamp(10px,0.78vw,13px)", letterSpacing: 2,
          color: CYAN, marginBottom: "clamp(28px,4vh,52px)",
          textTransform: "uppercase",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: CYAN,
            animation: "bm-pulseDot 2s ease infinite",
          }} />
          DICT Region V · Bicol
        </div>
        <h1 style={{
          fontWeight: 900,
          fontSize: "clamp(48px,7.8vw,150px)",
          lineHeight: 0.94, letterSpacing: "-0.045em",
          color: "#fff", marginBottom: "clamp(24px,3.5vh,44px)",
        }}>
          <span style={{ display: "block" }}>Program</span>
          <span style={{ display: "block", color: CYAN }}>Management</span>
          <span style={{ display: "block" }}>System</span>
        </h1>
        <p style={{
          fontSize: "clamp(16px,1.4vw,26px)", lineHeight: 1.5,
          color: "rgba(255,255,255,0.65)",
          maxWidth: "min(820px,90%)", fontWeight: 300,
        }}>
          Mapping the digital transformation of the Bicol Region — 10 programs,
          6 provinces, 114 LGUs, thousands of barangays — all in one navigable board.
        </p>
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        flexWrap: "wrap", gap: 24,
      }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard">
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 12,
              padding: "clamp(14px,1.5vh,20px) clamp(22px,2.2vw,36px)", borderRadius: 14,
              background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
              color: "#06060f", fontWeight: 700, border: "none",
              fontSize: "clamp(14px,1.05vw,17px)",
              boxShadow: `0 16px 40px -12px ${CYAN}aa`,
              letterSpacing: "-0.01em", cursor: "pointer",
            }}>
              Open Dashboard <span style={{ fontSize: "1.2em", lineHeight: 1 }}>→</span>
            </button>
          </Link>
          <button onClick={() => navigateTo(2, 3)} style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            padding: "clamp(14px,1.5vh,20px) clamp(22px,2.2vw,36px)", borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", fontWeight: 600,
            fontSize: "clamp(14px,1.05vw,17px)", cursor: "pointer",
          }}>
            Explore the Map
          </button>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2,auto)",
          columnGap: "clamp(20px,2.5vw,40px)", rowGap: 8,
          fontSize: "clamp(10px,0.78vw,13px)",
          fontFamily: "var(--font-mono, monospace)",
          letterSpacing: 1.4, color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
        }}>
          <div>↑ Mission</div><div>↓ Showcase</div>
          <div>← Map</div><div>→ Stats</div>
        </div>
      </div>
    </div>
  );
}

// ─── Box: Programs ────────────────────────────────────────────────────────────
function ProgramsBox({ side }: { side: "left" | "right" }) {
  const { selectedProgram, setSelectedProgram, navigateTo } = useLanding();
  const list = side === "left" ? LEFT_PROGRAMS : RIGHT_PROGRAMS;
  const startIdx = side === "left" ? 1 : 6;
  return (
    <Shell
      tag={side === "left" ? "Programs · 01 – 05" : "Programs · 06 – 10"}
      title={side === "left" ? "Connectivity\n& Infrastructure" : "Literacy,\nSecurity, Industry"}
      lead={side === "left"
        ? "Programs that build the physical and digital backbone of Region V."
        : "Programs that empower citizens, secure systems, and grow the ICT economy."}
      accent={CYAN}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "clamp(10px,1.1vh,16px)" }}>
        {list.map((p, i) => {
          const selected = selectedProgram === p.code;
          return (
            <button
              key={p.code}
              onClick={() => {
                setSelectedProgram(selected ? null : p.code);
                navigateTo(2, 3);
              }}
              style={{
                padding: "clamp(14px,1.6vh,22px) clamp(16px,1.5vw,24px)",
                borderRadius: 14,
                background: selected ? `${p.color}20` : "rgba(255,255,255,0.03)",
                border: `1px solid ${selected ? p.color : p.color + "33"}`,
                display: "flex", alignItems: "center", gap: "clamp(14px,1.4vw,22px)",
                cursor: "pointer", textAlign: "left", width: "100%",
                transition: "all 200ms ease",
              }}
            >
              <div style={{
                width: "clamp(40px,3.2vw,56px)", height: "clamp(40px,3.2vw,56px)",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${p.color}, ${p.color}88)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", flexShrink: 0,
                boxShadow: `0 6px 18px -6px ${p.color}aa`,
              }}>
                <Image
                  src={`/Logo/${LOGO_MAP[p.code] || "egov_ph_logo.png"}`}
                  alt={p.shortName} width={40} height={40}
                  className="object-contain p-1" unoptimized
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "clamp(15px,1.15vw,19px)", color: "#fff" }}>
                    {p.shortName}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "clamp(10px,0.75vw,12px)",
                    color: "rgba(255,255,255,0.4)", letterSpacing: 1.2,
                  }}>
                    {String(startIdx + i).padStart(2, "0")}
                  </span>
                </div>
                <div style={{ fontSize: "clamp(12px,0.9vw,14px)", color: "rgba(255,255,255,0.55)" }}>
                  {p.description || p.shortName}
                </div>
              </div>
              <span style={{
                color: p.color, fontSize: "clamp(16px,1.3vw,20px)",
                opacity: selected ? 1 : 0.7, flexShrink: 0,
              }}>→</span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

// ─── MapPin element ───────────────────────────────────────────────────────────
function MapPinEl({ color, count, size = 36, pulsing = false, label }: {
  color: string; count: number; size?: number; pulsing?: boolean; label?: string;
}) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
      {pulsing && (
        <div style={{
          position: "absolute", borderRadius: "50%",
          width: size + 8, height: size + 8, top: -4, left: -4,
          background: color, opacity: 0.3, animation: "bm-pulseDot 1.5s ease infinite",
        }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: color, border: "2px solid rgba(255,255,255,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size > 32 ? 12 : 9, fontWeight: 700, color: "#fff",
        boxShadow: `0 0 16px ${color}80`,
      }}>{count}</div>
      {label && (
        <div style={{
          marginTop: 2, fontSize: 8, fontWeight: 600, color: "#fff",
          background: "rgba(0,0,0,0.6)", padding: "1px 6px", borderRadius: 99,
          maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{label}</div>
      )}
    </div>
  );
}

// ─── Box: Map (real Mapbox) ───────────────────────────────────────────────────
function MapBox() {
  const {
    MapLib, mapRef, viewState, setViewState, mapLevel,
    selProvince, selLGU, selBarangay, provPins, lguRows, barangayRows,
    handleProvinceClick, handleLGUClick, handleBarangayClick,
    resetToRegion, resetToProvince, setSelBarangay, setMapReady,
    selectedProgram, isMapActive,
  } = useLanding();
  const selectedProjectDef = DICT_PROJECTS.find((p) => p.code === selectedProgram) ?? null;
  const maxProv = Math.max(...provPins.map((p) => p.activityCount), 1);
  const maxLGU = Math.max(...lguRows.map((l) => l.activityCount), 1);
  const mapStyle = "mapbox://styles/mapbox/dark-v11";

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "#0a1929", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 16, left: 16, zIndex: 10,
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "7px 14px", borderRadius: 99,
        background: `${CYAN}14`, border: `1px solid ${CYAN}40`,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 11, letterSpacing: 1.6, color: CYAN,
        textTransform: "uppercase", backdropFilter: "blur(8px)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%", background: CYAN,
          animation: "bm-pulseDot 2s ease infinite",
        }} />
        Interactive Map · Mapbox
      </div>

      {(selProvince || mapLevel !== "province") && (
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 10, display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 99,
          background: "rgba(13,17,23,0.7)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
        }}>
          <Globe className="w-3 h-3" style={{ color: mapLevel === "province" ? CYAN : "rgba(255,255,255,0.3)" }} />
          <button onClick={resetToRegion} style={{ color: mapLevel === "province" ? CYAN : "inherit", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            Bicol Region
          </button>
          {selProvince && (
            <>
              <span style={{ opacity: 0.3 }}>›</span>
              <button onClick={resetToProvince} style={{ color: mapLevel === "lgu" ? CYAN : "inherit", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
                {selProvince.provinceName}
              </button>
            </>
          )}
          {selLGU && (<><span style={{ opacity: 0.3 }}>›</span><span style={{ color: CYAN }}>{selLGU.name}</span></>)}
        </div>
      )}

      <div style={{
        position: "absolute", top: 64, right: 16, zIndex: 10,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {[
          { ic: <ZoomIn className="w-4 h-4" />, fn: () => setViewState({ ...viewState, zoom: Math.min(viewState.zoom + 1, 18) }) },
          { ic: <ZoomOut className="w-4 h-4" />, fn: () => setViewState({ ...viewState, zoom: Math.max(viewState.zoom - 1, 3) }) },
          { ic: <Globe className="w-4 h-4" />, fn: resetToRegion },
        ].map((b, i) => (
          <button key={i} onClick={b.fn} style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(13,17,23,0.75)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}>{b.ic}</button>
        ))}
      </div>

      <div style={{ position: "absolute", inset: 0, pointerEvents: isMapActive ? "auto" : "none" }}>
        {!MapLib ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: "rgba(255,255,255,0.3)", fontSize: 14,
          }}>
            {!MAPBOX_TOKEN ? "No Mapbox token configured" : "Loading map…"}
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
            {mapLevel === "province" && provPins.map((pin) => (
              <MapLib.Marker
                key={pin.provinceId}
                longitude={pin.lng} latitude={pin.lat}
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
            {mapLevel === "lgu" && lguRows.map((lgu, i) => (
              <MapLib.Marker
                key={`${lgu.name}-${i}`} longitude={lgu.lng} latitude={lgu.lat}
                onClick={(e: any) => { e.originalEvent.stopPropagation(); handleLGUClick(lgu); }}
                style={{ cursor: "pointer" }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
                  <div style={{
                    width: lgu.activityCount > 0 ? Math.max(24, Math.min(38, 24 + (lgu.activityCount / maxLGU) * 14)) : 18,
                    height: lgu.activityCount > 0 ? Math.max(24, Math.min(38, 24 + (lgu.activityCount / maxLGU) * 14)) : 18,
                    backgroundColor: lgu.activityCount > 0 ? "#7c3aed" : "#ffffff20",
                    borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 9,
                    boxShadow: lgu.activityCount > 0 ? "0 0 12px #7c3aed80" : "none",
                  }}>{lgu.activityCount > 0 ? lgu.activityCount : "·"}</div>
                </div>
              </MapLib.Marker>
            ))}
            {mapLevel === "barangay" && barangayRows.map((brgy, i) => (
              <MapLib.Marker
                key={`${brgy.name}-${i}`}
                longitude={brgy.coords[0]} latitude={brgy.coords[1]}
                onClick={(e: any) => { e.originalEvent.stopPropagation(); handleBarangayClick(brgy); }}
                style={{ cursor: "pointer" }}
              >
                <div style={{
                  width: brgy.activityCount > 0 ? 16 : 8,
                  height: brgy.activityCount > 0 ? 16 : 8,
                  background: brgy.activityCount > 0 ? "#f59e0b" : "#ffffff30",
                  borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 7,
                  boxShadow: brgy.activityCount > 0 ? "0 0 8px #f59e0b80" : "none",
                }}>{brgy.activityCount > 0 ? brgy.activityCount : ""}</div>
              </MapLib.Marker>
            ))}
          </MapLib.Map>
        )}
      </div>

      {selBarangay && (
        <div style={{
          position: "absolute", bottom: 16, left: 16, zIndex: 10,
          width: 280, padding: 14, borderRadius: 14,
          background: "rgba(13,17,23,0.9)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(0,212,255,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#fff" }}>
              <Home className="w-3.5 h-3.5" style={{ color: CYAN }} /> {selBarangay.name}
            </div>
            <button onClick={() => setSelBarangay(null)} style={{
              width: 22, height: 22, borderRadius: 6,
              background: "rgba(255,255,255,0.05)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.5)", cursor: "pointer",
            }}><X className="w-3 h-3" /></button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.05)", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: CYAN }}>{selBarangay.activityCount}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2 }}>Activities</div>
            </div>
            <div style={{ flex: 1, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.05)", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{numberWithCommas(selBarangay.participantCount)}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2 }}>Participants</div>
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 16, right: 16, zIndex: 10,
        padding: "8px 14px", borderRadius: 99,
        background: "rgba(13,17,23,0.7)", backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 10, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6,
      }}>
        <MapPin className="w-3 h-3" />
        {mapLevel === "province" && "Click a province"}
        {mapLevel === "lgu" && `Exploring ${selProvince?.provinceName}`}
        {mapLevel === "barangay" && `Exploring ${selLGU?.name}`}
      </div>
    </div>
  );
}

// ─── Box: Stats ───────────────────────────────────────────────────────────────
function StatsBox() {
  const { summary } = useLanding();
  const totalActivities = summary?.totalActivities ?? 0;
  const totalParticipants = summary?.totalParticipants ?? 0;
  const completion = summary
    ? getCompletionRate(
        (summary.byStatus?.validated ?? 0) + (summary.byStatus?.reported ?? 0),
        summary.totalActivities,
      )
    : 0;
  const stats = [
    { v: numberWithCommas(totalActivities), k: "Activities", c: CYAN },
    { v: numberWithCommas(totalParticipants), k: "Participants", c: "#7e3af2" },
    { v: `${completion}%`, k: "Completion", c: "#10b981" },
    { v: "10", k: "Programs", c: "#f59e0b" },
  ];
  const status = [
    { k: "Draft", v: summary?.byStatus?.draft ?? 0, c: "#6b7280" },
    { k: "Submitted", v: summary?.byStatus?.submitted ?? 0, c: "#f59e0b" },
    { k: "Validated", v: summary?.byStatus?.validated ?? 0, c: "#3b82f6" },
    { k: "Reported", v: summary?.byStatus?.reported ?? 0, c: "#10b981" },
  ];
  const total = status.reduce((a, b) => a + b.v, 0) || 1;

  return (
    <Shell tag={`Dashboard Summary · ${CURRENT_YEAR}`} title={"Region V\nby the numbers"} accent="#0ea5e9">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "clamp(10px,1.2vw,18px)" }}>
        {stats.map((s) => (
          <div key={s.k} style={{
            padding: "clamp(16px,1.8vh,28px)", borderRadius: 14,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{
              fontWeight: 800, fontSize: "clamp(28px,3.2vw,52px)", color: s.c,
              lineHeight: 1, letterSpacing: "-0.03em",
            }}>{s.v}</div>
            <div style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "clamp(10px,0.75vw,13px)", letterSpacing: 1.4,
              color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
              marginTop: "clamp(6px,0.8vh,10px)",
            }}>{s.k}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: "clamp(14px,1.8vh,24px)",
        padding: "clamp(14px,1.6vh,22px)", borderRadius: 14,
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono, monospace)", fontSize: 10,
          color: "rgba(255,255,255,0.4)", letterSpacing: 1.5,
          textTransform: "uppercase", marginBottom: 10,
        }}>Activity Status</div>
        <div style={{ display: "flex", gap: 6, height: "clamp(22px,2.6vh,36px)" }}>
          {status.map((s) => (
            <div key={s.k} style={{
              flex: s.v / total, background: s.c, borderRadius: 6,
              position: "relative", minWidth: 24,
            }}>
              <span style={{
                position: "absolute", top: "50%", left: 8, transform: "translateY(-50%)",
                fontSize: 10, fontWeight: 700, color: "#fff",
                fontFamily: "var(--font-mono, monospace)",
              }}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ─── Box: Mission ─────────────────────────────────────────────────────────────
function MissionBox() {
  return (
    <Shell
      tag="Mission · DTC"
      title={"Digital\nTransformation\nCenter"}
      lead="Free digital services for every Bicolano — empowering communities through technology access and digital literacy."
      accent="#10b981"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "clamp(10px,1vw,18px)" }}>
        {[
          { v: "12", k: "Workstations" }, { v: "100%", k: "Always Free" },
          { v: "50+", k: "Daily Users" }, { v: "24/7", k: "Support" },
        ].map((s) => (
          <div key={s.k} style={{
            padding: "clamp(14px,1.6vh,22px)", borderRadius: 14,
            background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)",
            textAlign: "center",
          }}>
            <div style={{
              fontWeight: 900, fontSize: "clamp(22px,2.6vw,40px)",
              color: "#10b981", lineHeight: 1, letterSpacing: "-0.03em",
            }}>{s.v}</div>
            <div style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "clamp(9px,0.7vw,11px)", letterSpacing: 1.2,
              color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginTop: 8,
            }}>{s.k}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Box: Logbook ─────────────────────────────────────────────────────────────
function LogbookBox() {
  return (
    <Shell
      tag="Logbooks · Live"
      title={"Track every visit,\nevery service"}
      lead="Walk-in DTC patrons and student intern attendance, kept live in one place."
      accent="#6366f1"
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(12px,1.2vw,20px)" }}>
        {[
          { n: "DTC Logbook", d: "For DTC patrons", c: "🖥️", col: "#3b82f6", stat: "Live attendance", href: "/dtc-logbook" },
          { n: "Intern Logbook", d: "For student trainees", c: "🎓", col: "#8b5cf6", stat: "24 active interns", href: "/intern-logbook" },
        ].map((b) => (
          <Link key={b.n} href={b.href}>
            <div style={{
              padding: "clamp(18px,2vh,30px)", borderRadius: 18,
              background: `linear-gradient(135deg, ${b.col}1a, transparent)`,
              border: `1px solid ${b.col}44`, cursor: "pointer",
              transition: "transform 200ms ease",
            }}>
              <div style={{ fontSize: "clamp(28px,3vw,42px)", marginBottom: "clamp(10px,1.2vh,16px)" }}>{b.c}</div>
              <div style={{ fontWeight: 700, fontSize: "clamp(15px,1.2vw,20px)", color: "#fff", marginBottom: 4 }}>{b.n}</div>
              <div style={{ fontSize: "clamp(12px,0.9vw,14px)", color: "rgba(255,255,255,0.5)", marginBottom: "clamp(12px,1.5vh,20px)" }}>{b.d}</div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 99, background: `${b.col}22`,
                fontFamily: "var(--font-mono, monospace)", fontSize: 11,
                color: b.col, letterSpacing: 1.2,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: b.col, animation: "bm-pulseDot 2s ease infinite" }} />
                {b.stat}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

// ─── Box: Showcase ────────────────────────────────────────────────────────────
function ShowcaseBox() {
  return (
    <Shell
      tag="DTC Showcase · What you can do"
      title={"Computer access,\ntraining, & support"}
      accent="#f59e0b"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "clamp(10px,1.2vw,18px)" }}>
        {[
          { ic: "💻", t: "Free Workstations", d: "12 PCs, fast internet, all software ready" },
          { ic: "🎓", t: "Trainings", d: "Digital literacy, MS Office, AI tools" },
          { ic: "📄", t: "Documents", d: "Print, scan, photocopy — free of charge" },
          { ic: "🛂", t: "Gov. Services", d: "PhilSys, PNPKI, e-Gov apps assistance" },
          { ic: "🤝", t: "Mentorship", d: "One-on-one tech help, walk-in welcome" },
          { ic: "📡", t: "Free WiFi", d: "Public access, no registration needed" },
        ].map((c) => (
          <div key={c.t} style={{
            padding: "clamp(14px,1.6vh,22px)", borderRadius: 14,
            background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)",
          }}>
            <div style={{ fontSize: "clamp(22px,2.4vw,32px)", marginBottom: 8 }}>{c.ic}</div>
            <div style={{ fontWeight: 700, fontSize: "clamp(13px,1vw,16px)", color: "#fff", marginBottom: 4 }}>{c.t}</div>
            <div style={{ fontSize: "clamp(11px,0.8vw,13px)", color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{c.d}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Box: Events ──────────────────────────────────────────────────────────────
function EventsBox() {
  return (
    <Shell
      tag="Events · Upcoming"
      title={"Workshops & meetups,\nacross all six provinces"}
      accent="#ec4899"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "clamp(10px,1.2vw,18px)" }}>
        {[
          { d: "NOV 12", m: "Cybersecurity Forum", l: "Naga City", c: "#ff5a1f" },
          { d: "NOV 18", m: "Free WiFi Rollout", l: "Sorsogon", c: "#7e3af2" },
          { d: "NOV 24", m: "Tech4ED Trainers Meet", l: "Legazpi", c: "#046c4e" },
        ].map((e) => (
          <Link key={e.d} href="/event">
            <div style={{
              padding: "clamp(16px,1.8vh,26px)", borderRadius: 16,
              background: `linear-gradient(135deg, ${e.c}10, transparent)`,
              border: `1px solid ${e.c}40`, cursor: "pointer",
            }}>
              <div style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "clamp(11px,0.8vw,13px)", color: e.c,
                letterSpacing: 1.6, marginBottom: 12,
              }}>{e.d}</div>
              <div style={{ fontWeight: 700, fontSize: "clamp(14px,1.1vw,18px)", color: "#fff", marginBottom: 6 }}>{e.m}</div>
              <div style={{ fontSize: "clamp(11px,0.85vw,13px)", color: "rgba(255,255,255,0.55)" }}>📍 {e.l}</div>
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

// ─── Box: Offices ─────────────────────────────────────────────────────────────
function OfficesBox() {
  const offices = [
    "Naga City · Cam. Sur", "Legazpi · Albay", "Daet · Cam. Norte",
    "Virac · Catanduanes", "Masbate City", "Sorsogon City",
  ];
  return (
    <Shell tag="DTC Offices · Region V" title={"Six provinces,\nsix offices"} accent="#06b6d4">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "clamp(8px,1vw,14px)" }}>
        {offices.map((o) => (
          <div key={o} style={{
            padding: "clamp(12px,1.4vh,20px) clamp(14px,1.2vw,20px)",
            borderRadius: 12,
            background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.2)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(6,182,212,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>📍</div>
            <div style={{ fontWeight: 600, fontSize: "clamp(12px,0.95vw,15px)", color: "#fff" }}>{o}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Box: Dashboard ───────────────────────────────────────────────────────────
function DashboardBox() {
  const { summary } = useLanding();
  return (
    <Shell
      tag="Admin Dashboard"
      title={"Full data\ncontrol surface"}
      lead="For program managers — log activities, validate reports, sync with Sheets, export to Looker Studio."
      accent="#a855f7"
    >
      <div style={{ borderRadius: 14, overflow: "hidden", background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
          <div style={{
            flex: 1, textAlign: "center", fontFamily: "var(--font-mono, monospace)",
            fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1,
          }}>dict-r5.gov.ph/dashboard</div>
        </div>
        <div style={{ padding: "clamp(14px,1.5vh,22px)", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { v: numberWithCommas(summary?.totalActivities ?? 0), k: "Activities" },
            { v: numberWithCommas(summary?.totalParticipants ?? 0), k: "People" },
            { v: `${summary ? getCompletionRate((summary.byStatus?.validated ?? 0) + (summary.byStatus?.reported ?? 0), summary.totalActivities) : 0}%`, k: "Done" },
            { v: "10", k: "Programs" },
          ].map((s) => (
            <div key={s.k} style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
            }}>
              <div style={{ fontWeight: 800, fontSize: "clamp(15px,1.3vw,20px)", color: "#a855f7" }}>{s.v}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>{s.k}</div>
            </div>
          ))}
        </div>
        <div style={{
          padding: "0 clamp(14px,1.5vh,22px) clamp(14px,1.5vh,22px)",
          display: "flex", alignItems: "flex-end", gap: 6, height: "clamp(60px,8vh,100px)",
        }}>
          {[40, 72, 55, 88, 62, 95, 70, 84, 50, 77].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`,
              background: "linear-gradient(180deg, #a855f7, #6366f1)",
              borderRadius: "4px 4px 0 0", opacity: 0.8,
            }} />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href="/dashboard">
          <button style={{
            padding: "10px 18px", borderRadius: 12,
            background: "linear-gradient(135deg, #a855f7, #6366f1)",
            color: "#fff", fontWeight: 700, fontSize: 13, border: "none",
            cursor: "pointer", boxShadow: "0 8px 24px -8px #a855f7aa",
          }}>Open Admin Dashboard →</button>
        </Link>
      </div>
    </Shell>
  );
}

// ─── Box: Provinces ───────────────────────────────────────────────────────────
function ProvincesBox() {
  return (
    <Shell tag="Bicol Region · 6 Provinces" title={"One region,\nsix realities"} accent="#0ea5e9">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "clamp(10px,1.2vw,18px)" }}>
        {PROVINCES_STATIC.map((p, i) => (
          <div key={p.name} style={{
            padding: "clamp(14px,1.6vh,22px)", borderRadius: 14,
            background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: "clamp(13px,1.05vw,18px)", color: "#fff" }}>{p.name}</div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                {String(i + 1).padStart(2, "0")}
              </div>
            </div>
            <div style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "clamp(10px,0.75vw,12px)",
              color: "rgba(255,255,255,0.45)", letterSpacing: 1,
            }}>{p.lat.toFixed(2)}°N · {p.lng.toFixed(2)}°E</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Box: Social ──────────────────────────────────────────────────────────────
function SocialBox() {
  return (
    <Shell
      tag="Facebook · @DICTRegion5"
      title={"Live from\nthe field"}
      lead="Photos, news, and updates from DTC offices and program rollouts across the region."
      accent="#1877f2"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "clamp(8px,1vw,14px)" }}>
        {[
          { t: "Cybersecurity workshop wraps in Naga", d: "2h ago", l: "124 ❤️" },
          { t: "Free WiFi goes live in Sorsogon City", d: "1d ago", l: "89 ❤️" },
          { t: "Tech4ED graduates in Albay", d: "3d ago", l: "212 ❤️" },
        ].map((p, i) => (
          <div key={i} style={{
            padding: "clamp(12px,1.4vh,18px)", borderRadius: 12,
            background: "rgba(24,119,242,0.05)", border: "1px solid rgba(24,119,242,0.2)",
          }}>
            <div style={{
              height: "clamp(40px,5vh,70px)", borderRadius: 8,
              background: "linear-gradient(135deg, #1877f2, #4267B2)",
              marginBottom: 10, opacity: 0.5,
            }} />
            <div style={{
              fontWeight: 600, fontSize: "clamp(11px,0.85vw,14px)",
              color: "#fff", lineHeight: 1.3, marginBottom: 6,
            }}>{p.t}</div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: "var(--font-mono, monospace)", fontSize: 10,
              color: "rgba(255,255,255,0.45)",
            }}>
              <span>{p.d}</span><span>{p.l}</span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Box Dispatcher ───────────────────────────────────────────────────────────
function BoxCard({ data }: { data: BoxDef }) {
  switch (data.kind) {
    case "hero": return <HeroBox />;
    case "mission": return <MissionBox />;
    case "logbook": return <LogbookBox />;
    case "showcase": return <ShowcaseBox />;
    case "events": return <EventsBox />;
    case "map": return <MapBox />;
    case "programs": return <ProgramsBox side={data.side!} />;
    case "stats": return <StatsBox />;
    case "offices": return <OfficesBox />;
    case "dashboard": return <DashboardBox />;
    case "provinces": return <ProvincesBox />;
    case "social": return <SocialBox />;
    default: return null;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FrontPage() {
  const [loadingDone, setLoadingDone] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [MapLib, setMapLib] = useState<any>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [mapLevel, setMapLevel] = useState<MapLevel>("province");
  const [selProvince, setSelProvince] = useState<ProvPin | null>(null);
  const [selLGU, setSelLGU] = useState<LGURow | null>(null);
  const [selBarangay, setSelBarangay] = useState<BarangayRow | null>(null);
  const [viewState, setViewState] = useState({
    longitude: PH_CENTER.longitude, latitude: PH_CENTER.latitude, zoom: PH_CENTER.zoom,
  });
  const mapRef = useRef<any>(null);

  const [pos, setPos] = useState({ c: 3, r: 3 });
  const [vw, setVw] = useState({ w: 1280, h: 800 });
  const [overview, setOverview] = useState(false);
  const [drag, setDrag] = useState({ active: false, dx: 0, dy: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setVw({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setVw({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    import("react-map-gl").then((m) => setMapLib(m));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoadingDone(true), 2800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loadingDone || !mapRef.current) return;
    const t = setTimeout(() => {
      mapRef.current?.flyTo({
        center: [BICOL_CENTER.longitude, BICOL_CENTER.latitude],
        zoom: BICOL_CENTER.zoom, duration: 2500, essential: true,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [loadingDone, mapReady]);

  const filterProjectData = useQuery(
    api.projects.getByCode,
    selectedProgram ? { code: selectedProgram } : "skip",
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
      : "skip",
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
      : "skip",
  );

  const provPins = useMemo<ProvPin[]>(() => {
    return (provincePins ?? []).map((p) => {
      const r5 = R5_PROVINCE_COORDS[p.provinceName];
      return { ...p, provinceId: p.provinceId, lat: r5?.[1] ?? p.lat, lng: r5?.[0] ?? p.lng };
    });
  }, [provincePins]);

  const lguRows = useMemo<LGURow[]>(() => {
    if (!selProvince) return [];
    const r5Prov = R5_GEO[selProvince.provinceName];
    if (!r5Prov) return [];
    return Object.entries(r5Prov).map(([lguName, geo]) => {
      const lower = lguName.toLowerCase();
      const matched = (lguActivityData ?? []).find((a) =>
        a.lguName.toLowerCase() === lower ||
        a.lguName.toLowerCase().includes(lower) ||
        lower.includes(a.lguName.toLowerCase()),
      );
      return {
        name: lguName, lng: geo.coords[0], lat: geo.coords[1],
        barangays: geo.barangays,
        activityCount: matched?.activityCount ?? 0,
        participantCount: matched?.participantCount ?? 0,
        lguId: matched?.lguId,
      };
    });
  }, [selProvince, lguActivityData]);

  const barangayRows = useMemo<BarangayRow[]>(() => {
    if (!selLGU) return [];
    const activeMap = new Map<string, { count: number; participants: number }>();
    for (const b of barangayData ?? []) {
      if (b.barangay !== "(No barangay)") {
        activeMap.set(b.barangay.toLowerCase(), {
          count: b.activityCount, participants: b.participantCount,
        });
      }
    }
    return selLGU.barangays.map((b) => {
      const matched = activeMap.get(b.name.toLowerCase());
      return {
        name: b.name, coords: b.coords,
        activityCount: matched?.count ?? 0,
        participantCount: matched?.participants ?? 0,
      };
    });
  }, [selLGU, barangayData]);

  const flyTo = useCallback((lng: number, lat: number, zoom: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1200, essential: true });
  }, []);

  const handleProvinceClick = useCallback((pin: ProvPin) => {
    setSelProvince(pin); setSelLGU(null); setSelBarangay(null);
    setMapLevel("lgu"); flyTo(pin.lng, pin.lat, 10);
  }, [flyTo]);

  const handleLGUClick = useCallback((lgu: LGURow) => {
    setSelLGU(lgu); setSelBarangay(null);
    setMapLevel("barangay"); flyTo(lgu.lng, lgu.lat, 12.5);
  }, [flyTo]);

  const handleBarangayClick = useCallback((b: BarangayRow) => setSelBarangay(b), []);

  const resetToRegion = useCallback(() => {
    setSelProvince(null); setSelLGU(null); setSelBarangay(null);
    setMapLevel("province");
    flyTo(BICOL_CENTER.longitude, BICOL_CENTER.latitude, BICOL_CENTER.zoom);
  }, [flyTo]);

  const resetToProvince = useCallback(() => {
    if (!selProvince) return;
    setSelLGU(null); setSelBarangay(null); setMapLevel("lgu");
    flyTo(selProvince.lng, selProvince.lat, 10);
  }, [selProvince, flyTo]);

  const inset = Math.min(24, vw.w * 0.012);
  const BOX_W = vw.w - inset * 2;
  const BOX_H = vw.h - inset * 2;
  const GAP = Math.max(40, vw.w * 0.04);
  const STEP_X = BOX_W + GAP;
  const STEP_Y = BOX_H + GAP;

  const exists = useCallback((c: number, r: number) => !!BOXES[`${c},${r}`], []);

  const rayMove = useCallback(
    (dc: number, dr: number) => {
      setPos((p) => {
        let nc = p.c + dc, nr = p.r + dr;
        for (let step = 0; step < 10; step++) {
          if (exists(nc, nr)) return { c: nc, r: nr };
          nc += dc; nr += dr;
          if (nc < 0 || nc >= 7 || nr < 0 || nr >= 7) break;
        }
        return p;
      });
    },
    [exists],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") rayMove(-1, 0);
      if (e.key === "ArrowRight") rayMove(1, 0);
      if (e.key === "ArrowUp") rayMove(0, -1);
      if (e.key === "ArrowDown") rayMove(0, 1);
      if (e.key === "m" || e.key === "M" || e.key === " ") {
        e.preventDefault(); setOverview((o) => !o);
      }
      if (e.key === "Escape") {
        setOverview(false); setPos({ c: 3, r: 3 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rayMove]);

  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!touchRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchRef.current.x;
      const dy = t.clientY - touchRef.current.y;
      const dt = Date.now() - touchRef.current.t;
      touchRef.current = null;
      if (dt > 800) return;
      const TH = 50;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > TH) rayMove(-1, 0);
        if (dx < -TH) rayMove(1, 0);
      } else {
        if (dy > TH) rayMove(0, -1);
        if (dy < -TH) rayMove(0, 1);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [rayMove]);

  const wheelAcc = useRef({ x: 0, y: 0, lock: 0 });
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".mapboxgl-canvas") || target.closest(".mapboxgl-map")) return;
      e.preventDefault();
      const now = Date.now();
      if (now < wheelAcc.current.lock) return;
      wheelAcc.current.x += e.deltaX;
      wheelAcc.current.y += e.deltaY;
      const TH = 80;
      const a = wheelAcc.current;
      if (Math.abs(a.x) > Math.abs(a.y)) {
        if (a.x > TH) { rayMove(1, 0); a.lock = now + 650; a.x = 0; a.y = 0; }
        if (a.x < -TH) { rayMove(-1, 0); a.lock = now + 650; a.x = 0; a.y = 0; }
      } else {
        if (a.y > TH) { rayMove(0, 1); a.lock = now + 650; a.x = 0; a.y = 0; }
        if (a.y < -TH) { rayMove(0, -1); a.lock = now + 650; a.x = 0; a.y = 0; }
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [rayMove]);

  const dragRef = useRef<{ sx: number; sy: number; started: boolean } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, .bm-minimap, .bm-arrow, .bm-hud, .mapboxgl-canvas, .mapboxgl-map")) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, started: false };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      if (!dragRef.current.started && Math.hypot(dx, dy) > 6) {
        dragRef.current.started = true;
        setDrag((d) => ({ ...d, active: true }));
      }
      if (dragRef.current.started) setDrag({ active: true, dx, dy });
    };
    const onUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      if (dragRef.current.started) {
        const dx = e.clientX - dragRef.current.sx;
        const dy = e.clientY - dragRef.current.sy;
        if (overview) {
          setPanOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
        } else {
          const TH = 120;
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > TH) rayMove(-1, 0);
            if (dx < -TH) rayMove(1, 0);
          } else {
            if (dy > TH) rayMove(0, -1);
            if (dy < -TH) rayMove(0, 1);
          }
        }
        setDrag({ active: false, dx: 0, dy: 0 });
      }
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [overview, rayMove]);

  let tx: number, ty: number, scale: number;
  if (overview) {
    const fitX = vw.w * 0.85 / (STEP_X * 5);
    const fitY = vw.h * 0.78 / (STEP_Y * 5);
    scale = Math.min(fitX, fitY);
    tx = panOffset.x + (drag.active ? drag.dx : 0);
    ty = panOffset.y + (drag.active ? drag.dy : 0);
  } else {
    scale = 1;
    tx = -(pos.c - 3) * STEP_X + (drag.active ? drag.dx : 0);
    ty = -(pos.r - 3) * STEP_Y + (drag.active ? drag.dy : 0);
  }

  const connectors = useMemo(() => {
    const lines: Array<{ kind: "h" | "v"; x: number; y: number; len: number }> = [];
    const hCols = COORDS.filter(([, r]) => r === 3).map(([c]) => c).sort((a, b) => a - b);
    for (let i = 0; i < hCols.length - 1; i++) {
      const c1 = hCols[i], c2 = hCols[i + 1];
      lines.push({ kind: "h", x: ((c1 + c2) / 2 - 3) * STEP_X, y: 0, len: (c2 - c1) * STEP_X - BOX_W });
    }
    const vRows = COORDS.filter(([c]) => c === 3).map(([, r]) => r).sort((a, b) => a - b);
    for (let i = 0; i < vRows.length - 1; i++) {
      const r1 = vRows[i], r2 = vRows[i + 1];
      lines.push({ kind: "v", x: 0, y: ((r1 + r2) / 2 - 3) * STEP_Y, len: (r2 - r1) * STEP_Y - BOX_H });
    }
    return lines;
  }, [STEP_X, STEP_Y, BOX_W, BOX_H]);

  const currentKey = `${pos.c},${pos.r}`;
  const currentBox = BOXES[currentKey];
  const canRay = (dc: number, dr: number) => {
    let nc = pos.c + dc, nr = pos.r + dr;
    for (let s = 0; s < 10; s++) {
      if (nc < 0 || nc >= 7 || nr < 0 || nr >= 7) return false;
      if (exists(nc, nr)) return true;
      nc += dc; nr += dr;
    }
    return false;
  };

  const navigateTo = useCallback((c: number, r: number) => {
    setOverview(false); setPos({ c, r }); setPanOffset({ x: 0, y: 0 });
  }, []);

  const ctxValue: LandingCtxType = {
    summary, selectedProgram, setSelectedProgram, navigateTo,
    MapLib, mapRef, viewState, setViewState, mapLevel,
    selProvince, selLGU, selBarangay, provPins, lguRows, barangayRows,
    handleProvinceClick, handleLGUClick, handleBarangayClick,
    resetToRegion, resetToProvince, setSelBarangay, setMapReady,
    isMapActive: currentBox?.id === "map",
  };

  return (
    <LandingCtx.Provider value={ctxValue}>
      <LoadingScreen done={loadingDone} />
      <div
        className={cn("bm-stage", overview && "bm-grab", drag.active && "bm-grabbing")}
        onMouseDown={onMouseDown}
      >
        <div className="bm-grid-bg" />
        <div
          className={cn("bm-canvas", drag.active && "bm-dragging", overview && "bm-overview")}
          style={{ transform: `translate(-50%,-50%) translate(${tx}px, ${ty}px) scale(${scale})` }}
        >
          {connectors.map((l, i) => (
            <div key={"c" + i}
              className={cn("bm-connector", l.kind === "h" ? "bm-connector-h" : "bm-connector-v")}
              style={{
                left: l.x, top: l.y,
                width: l.kind === "h" ? l.len : 3,
                height: l.kind === "v" ? l.len : 3,
                opacity: overview ? 0.7 : 1,
              }}
            />
          ))}
          {COORDS.map(([c, r]) => {
            const key = `${c},${r}`;
            const isActive = key === currentKey && !overview;
            const data = BOXES[key];
            const d = Math.abs(c - pos.c) + Math.abs(r - pos.r);
            const opacity = overview ? 1 : isActive ? 1 : Math.max(0.18, 1 - d * 0.34);
            return (
              <div
                key={key}
                className={cn("bm-box", isActive ? "bm-active" : overview ? "" : "bm-dim")}
                style={{
                  width: BOX_W, height: BOX_H,
                  left: (c - 3) * STEP_X, top: (r - 3) * STEP_Y,
                  opacity, cursor: overview ? "pointer" : "default",
                }}
                onClick={() => overview && navigateTo(c, r)}
              >
                <BoxCard data={data} />
              </div>
            );
          })}
        </div>

        <div className="bm-hud bm-topbar">
          <div className="bm-brand">
            <div className="bm-brand-mark"><span>D</span>ICT</div>
            <div className="bm-brand-text">
              DICT Region V
              <span className="bm-brand-sub">Program Management · Bicol Region</span>
            </div>
          </div>
          <div className="bm-crumbs">
            <span style={{ cursor: "pointer" }} onClick={() => setOverview(true)}>
              {overview ? "Board · Overview" : "Board"}
            </span>
            <span style={{ opacity: 0.4 }}>›</span>
            <span className="bm-crumbs-now">{BOX_TITLES[currentBox?.id] || "—"}</span>
            <span className="bm-crumbs-coord">[ {pos.c} , {pos.r} ]</span>
          </div>
        </div>

        {!overview && (
          <div className="bm-arrows">
            <button className="bm-arrow bm-arrow-up" onClick={() => rayMove(0, -1)} disabled={!canRay(0, -1)} aria-label="Up">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5l-7 7M12 5l7 7M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button className="bm-arrow bm-arrow-down" onClick={() => rayMove(0, 1)} disabled={!canRay(0, 1)} aria-label="Down">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 19l-7-7M12 19l7-7M12 19V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button className="bm-arrow bm-arrow-left" onClick={() => rayMove(-1, 0)} disabled={!canRay(-1, 0)} aria-label="Left">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12l7-7M5 12l7 7M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button className="bm-arrow bm-arrow-right" onClick={() => rayMove(1, 0)} disabled={!canRay(1, 0)} aria-label="Right">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19 12l-7-7M19 12l-7 7M19 12H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}

        {overview && (
          <button
            onClick={() => navigateTo(3, 3)}
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%,-50%)", zIndex: 31,
              padding: "14px 28px", borderRadius: 99,
              background: "rgba(13,17,23,0.85)", backdropFilter: "blur(14px)",
              border: `1px solid ${CYAN}55`, color: CYAN,
              fontWeight: 600, fontSize: 13, letterSpacing: 1,
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)", cursor: "pointer",
            }}
          >Click any box to enter</button>
        )}

        <div className="bm-minimap">
          <div className="bm-minimap-label">
            <span>MAP · {COORDS.length} NODES</span>
            <button className="bm-mm-toggle" onClick={() => setOverview((o) => !o)}>
              {overview ? "◳ ENTER" : "⊟ BOARD"}
            </button>
          </div>
          <div className="bm-minimap-grid">
            {Array.from({ length: 49 }).map((_, i) => {
              const c = i % 7, r = Math.floor(i / 7);
              const has = exists(c, r);
              const isNow = c === pos.c && r === pos.r && !overview;
              return (
                <div
                  key={i}
                  className={cn("bm-mm-cell", has && "bm-exists", isNow && "bm-current")}
                  onClick={() => has && navigateTo(c, r)}
                  title={has ? BOX_TITLES[BOXES[`${c},${r}`].id] : ""}
                />
              );
            })}
          </div>
        </div>

        <div className="bm-hint">
          <span className="bm-kbd">←</span>
          <span className="bm-kbd">↑</span>
          <span className="bm-kbd">↓</span>
          <span className="bm-kbd">→</span>
          <span style={{ opacity: 0.5 }}>navigate</span>
          <span style={{ margin: "0 6px", opacity: 0.3 }}>·</span>
          <span className="bm-kbd">M</span>
          <span style={{ opacity: 0.5 }}>board view</span>
          <span style={{ margin: "0 6px", opacity: 0.3 }}>·</span>
          <span style={{ opacity: 0.5 }}>drag to pan</span>
        </div>
      </div>
    </LandingCtx.Provider>
  );
}
