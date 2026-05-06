"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Globe, MapPin, ChevronRight, Filter, ExternalLink,
  ChevronLeft, Building2, Home, Users, PanelLeftClose, PanelLeftOpen,
  BarChart3, Download, FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn, numberWithCommas, getStatusColor } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR } from "@/lib/types";
import { R5_PROVINCE_COORDS, R5_GEO } from "@/lib/r5-data";
import Link from "next/link";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type MapLevel = "province" | "lgu" | "barangay";

// ── Types ─────────────────────────────────────────────────────
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
  barangays: Array<{ name: string; coords: [number, number] }>;  // barangays with coords
  activityCount: number;       // 0 if no activities in DB
  participantCount: number;
  lguId?: string;              // Convex ID if matched
}

// ── Breadcrumb ────────────────────────────────────────────────
function Breadcrumb({ level, province, lgu, onProvince, onLGU }: {
  level: MapLevel;
  province: ProvPin | null;
  lgu: LGURow | null;
  onProvince: () => void;
  onLGU: () => void;
}) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-wrap min-w-0">
      <button onClick={onProvince}
        className={cn("hover:text-blue-600 flex items-center gap-0.5 shrink-0 transition-colors",
          level === "province" ? "text-blue-700 font-semibold" : "")}>
        <Globe className="w-3 h-3" /> Region V
      </button>
      {province && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <button onClick={onLGU}
            className={cn("hover:text-blue-600 flex items-center gap-0.5 transition-colors truncate",
              level === "lgu" ? "text-blue-700 font-semibold" : "")}>
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{province.provinceName}</span>
          </button>
        </>
      )}
      {lgu && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-blue-700 font-semibold flex items-center gap-0.5 truncate">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{lgu.name}</span>
          </span>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MapPage() {
  const [filterProject, setFilterProject] = useState("all");
  const [mapLevel, setMapLevel]           = useState<MapLevel>("province");
  const [selProvince, setSelProvince]     = useState<ProvPin | null>(null);
  const [selLGU, setSelLGU]              = useState<LGURow | null>(null);
  const [viewState, setViewState]         = useState({ longitude: 123.5, latitude: 13.0, zoom: 7.5 });
  const [MapLib, setMapLib]               = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Convex queries ──────────────────────────────────────────
  const filterProjectData = useQuery(
    api.projects.getByCode,
    filterProject !== "all" ? { code: filterProject } : "skip"
  );
  const provincePins = useQuery(api.activities.activitiesByProvince, {
    projectId: filterProject !== "all" && filterProjectData ? filterProjectData._id : undefined,
    year: CURRENT_YEAR,
  });
  const lguActivityData = useQuery(
    api.activities.activitiesByLGU,
    selProvince
      ? {
          provinceId: selProvince.provinceId as any,
          projectId: filterProject !== "all" && filterProjectData ? filterProjectData._id : undefined,
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
          projectId: filterProject !== "all" && filterProjectData ? filterProjectData._id : undefined,
          year: CURRENT_YEAR,
        }
      : "skip"
  );
  const levelActivities = useQuery(
    api.activities.listActivities,
    selProvince
      ? { provinceId: selProvince.provinceId as any, year: CURRENT_YEAR, limit: 10 }
      : "skip"
  );

  const handleExportToSheets = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ year: String(CURRENT_YEAR) });
      if (filterProject !== "all") params.append("project", filterProject);

      const response = await fetch(`/api/export-to-sheets?${params.toString()}`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok && data.sheetUrl) {
        window.open(data.sheetUrl, "_blank");
        alert(`✅ ${data.message}\n\nSheet: ${data.sheetName}\nRows: ${data.rowCount}`);
      } else {
        alert(`❌ Export failed: ${data.error}\n\n${data.hint || ""}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("❌ Failed to export to Google Sheets. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Load Mapbox ─────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    Promise.all([
      import("react-map-gl"),
      import("mapbox-gl/dist/mapbox-gl.css" as any).catch(() => null),
    ]).then(([m]) => setMapLib(m));
  }, []);

  // ── Build province pins (Convex data + R5 coords) ───────────
  const provPins = useMemo<ProvPin[]>(() => {
    const convexPins = provincePins ?? [];
    // Merge: use R5 coords when available (more precise), Convex coords as fallback
    return convexPins.map(p => {
      const r5Coords = R5_PROVINCE_COORDS[p.provinceName];
      return {
        ...p,
        provinceId: p.provinceId,
        lat: r5Coords ? r5Coords[1] : p.lat,
        lng: r5Coords ? r5Coords[0] : p.lng,
      };
    });
  }, [provincePins]);

  // ── Build LGU rows (ALL from R5 data + Convex activity counts) ─
  const lguRows = useMemo<LGURow[]>(() => {
    if (!selProvince) return [];
    const r5Province = R5_GEO[selProvince.provinceName as keyof typeof R5_GEO];
    if (!r5Province) return [];

    const activityMap: Record<string, typeof lguActivityData extends (infer T)[] | undefined ? T : never> = {};
    for (const a of lguActivityData ?? []) {
      activityMap[a.lguName.toLowerCase()] = a;
    }

    return Object.entries(r5Province).map(([lguName, geo]) => {
      // Fuzzy match to Convex activity data
      const lower = lguName.toLowerCase();
      const matched = (lguActivityData ?? []).find(a =>
        a.lguName.toLowerCase() === lower ||
        a.lguName.toLowerCase().includes(lower) ||
        lower.includes(a.lguName.toLowerCase())
      );
      return {
        name: lguName,
        lng:  geo.coords[0],
        lat:  geo.coords[1],
        barangays: geo.barangays,
        activityCount:    matched?.activityCount    ?? 0,
        participantCount: matched?.participantCount ?? 0,
        lguId: matched?.lguId,
      };
    });
  }, [selProvince, lguActivityData]);

  // ── Active barangay set from DB ─────────────────────────────
  const activeBarangays = useMemo(() => {
    const m = new Map<string, { count: number; participants: number }>();
    for (const b of barangayData ?? []) {
      if (b.barangay !== "(No barangay)") m.set(b.barangay, { count: b.activityCount, participants: b.participantCount });
    }
    return m;
  }, [barangayData]);

  // ── Colors ──────────────────────────────────────────────────
  const selDef   = DICT_PROJECTS.find(p => p.code === filterProject);
  const provColor = selDef?.color ?? "#2563eb";
  const lguColor  = "#7c3aed";
  const maxProv   = Math.max(...provPins.map(p => p.activityCount), 1);
  const maxLGU    = Math.max(...lguRows.map(l => l.activityCount), 1);

  // ── Navigation ──────────────────────────────────────────────
  function selectProvince(pin: ProvPin) {
    setSelProvince(pin);
    setSelLGU(null);
    setMapLevel("lgu");
    setViewState({ longitude: pin.lng, latitude: pin.lat, zoom: 9.5 });
  }

  function selectLGU(row: LGURow) {
    setSelLGU(row);
    setMapLevel("barangay");
    setViewState({ longitude: row.lng, latitude: row.lat, zoom: 12 });
  }

  function goProvince() {
    setSelProvince(null); setSelLGU(null); setMapLevel("province");
    setViewState({ longitude: 123.5, latitude: 13.0, zoom: 7.5 });
  }

  function goLGU() {
    setSelLGU(null); setMapLevel("lgu");
    if (selProvince) setViewState({ longitude: selProvince.lng, latitude: selProvince.lat, zoom: 9.5 });
  }

  const totalActivities   = provPins.reduce((s, p) => s + p.activityCount, 0);
  const totalParticipants = provPins.reduce((s, p) => s + p.participantCount, 0);

  if (!MAPBOX_TOKEN) return <NoTokenFallback pins={provPins} />;

  return (
    <div className="page-content flex gap-4 h-[calc(100vh-5rem)] -mt-1">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className={cn(
        "flex-shrink-0 flex flex-col gap-3 overflow-y-auto transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-72"
      )}>

        {/* Toggle button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-3 left-3 z-20 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-sm transition-all hover:shadow-md"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-gray-600" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {sidebarCollapsed ? (
          /* ── Collapsed sidebar (icons only) ── */
          <div className="flex flex-col gap-3 items-center pt-14">
            {/* Level indicator */}
            <div className="flex flex-col items-center gap-2 p-2">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center",
                mapLevel === "province" ? "bg-blue-100" : mapLevel === "lgu" ? "bg-violet-100" : "bg-green-100")}>
                {mapLevel === "province" ? <Globe className="w-4 h-4 text-blue-600" />
                  : mapLevel === "lgu" ? <Building2 className="w-4 h-4 text-violet-600" />
                  : <Home className="w-4 h-4 text-green-600" />}
              </div>
            </div>

            {/* Stats icons */}
            <div className="flex flex-col gap-2 p-2 border-t border-gray-200 w-full">
              <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-blue-50">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span className="text-[9px] font-bold text-blue-700">
                  {mapLevel === "province" ? totalActivities
                    : mapLevel === "lgu" ? (selProvince?.activityCount ?? 0)
                    : (selLGU?.activityCount ?? 0)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-violet-50">
                <Users className="w-4 h-4 text-violet-600" />
                <span className="text-[9px] font-bold text-violet-700">
                  {mapLevel === "province" ? (totalParticipants > 999 ? `${Math.round(totalParticipants/1000)}k` : totalParticipants)
                    : mapLevel === "lgu" ? (selProvince && selProvince.participantCount > 999 ? `${Math.round(selProvince.participantCount/1000)}k` : selProvince?.participantCount ?? 0)
                    : (selLGU && selLGU.participantCount > 999 ? `${Math.round(selLGU.participantCount/1000)}k` : selLGU?.participantCount ?? 0)}
                </span>
              </div>
            </div>

            {/* Back button when drilled down */}
            {(selProvince || selLGU) && (
              <button
                onClick={selLGU ? goLGU : goProvince}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Go back"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        ) : (
          /* ── Expanded sidebar (full content) ── */
          <>
            <div className="pt-12">
              {/* Nav + filter */}
              <Card>
                <CardContent className="p-3 space-y-2.5">
                  <Breadcrumb level={mapLevel} province={selProvince} lgu={selLGU}
                    onProvince={goProvince} onLGU={goLGU} />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Program</p>
                    <Select value={filterProject} onValueChange={v => { setFilterProject(v); goProvince(); }}>
                      <SelectTrigger className="w-full h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        {DICT_PROJECTS.map(p => <SelectItem key={p.code} value={p.code}>{p.shortName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <a href={`/api/looker-export?year=${CURRENT_YEAR}${filterProject !== "all" ? `&project=${filterProject}` : ""}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-[10px] h-7">
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                    </a>
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="flex-1 gap-1.5 text-[10px] h-7"
                      onClick={handleExportToSheets}
                      disabled={isExporting}
                    >
                      <FileSpreadsheet className="w-3 h-3" /> 
                      {isExporting ? "..." : "Sheets"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Stats */}
        <Card>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Activities</span>
              <span className="font-bold text-blue-600">
                {mapLevel === "province" ? totalActivities
                  : mapLevel === "lgu" ? (selProvince?.activityCount ?? 0)
                  : (selLGU?.activityCount ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Participants</span>
              <span className="font-bold text-violet-600">
                {numberWithCommas(
                  mapLevel === "province" ? totalParticipants
                    : mapLevel === "lgu" ? (selProvince?.participantCount ?? 0)
                    : (selLGU?.participantCount ?? 0)
                )}
              </span>
            </div>
            {mapLevel === "lgu" && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">LGUs in {selProvince?.provinceName}</span>
                <span className="font-bold text-gray-700">{lguRows.length}</span>
              </div>
            )}
            {mapLevel === "barangay" && selLGU && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Barangays covered</span>
                <span className="font-bold text-green-600">
                  {activeBarangays.size} / {selLGU.barangays.length}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Province list ── */}
        {mapLevel === "province" && (
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-1 pt-3 shrink-0">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" /> Provinces
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pb-2 pt-0">
              {provPins.length === 0
                ? <p className="text-xs text-gray-400 text-center py-6">No activity data yet.</p>
                : <div className="space-y-1">
                    {[...provPins].sort((a, b) => b.activityCount - a.activityCount).map(p => {
                      const pct = Math.round((p.activityCount / maxProv) * 100);
                      return (
                        <button key={p.provinceId} onClick={() => selectProvince(p)}
                          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-all group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">{p.provinceName}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold" style={{ color: provColor }}>{p.activityCount}</span>
                              <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-blue-400" />
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: provColor }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">{numberWithCommas(p.participantCount)} pax</p>
                        </button>
                      );
                    })}
                  </div>
              }
            </CardContent>
          </Card>
        )}

        {/* ── LGU list ── */}
        {mapLevel === "lgu" && (
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-1 pt-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="truncate">LGUs — {selProvince?.provinceName}</span>
                </CardTitle>
                <button onClick={goProvince} className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-0.5 shrink-0 ml-2">
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pb-2 pt-0">
              {lguRows.length === 0
                ? <p className="text-xs text-gray-400 text-center py-6">No LGU data.</p>
                : <div className="space-y-1">
                    {[...lguRows].sort((a, b) => b.activityCount - a.activityCount).map(lgu => {
                      const isSelected = selLGU?.name === lgu.name;
                      const hasData    = lgu.activityCount > 0;
                      const pct        = hasData ? Math.round((lgu.activityCount / maxLGU) * 100) : 0;
                      return (
                        <button key={lgu.name} onClick={() => selectLGU(lgu)}
                          className={cn("w-full text-left px-3 py-2.5 rounded-lg transition-all group",
                            isSelected ? "bg-violet-50 ring-1 ring-violet-200"
                              : hasData ? "hover:bg-violet-50" : "hover:bg-gray-50 opacity-60")}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn("text-xs font-medium truncate flex-1 mr-1",
                              isSelected ? "text-violet-700" : hasData ? "text-gray-700 group-hover:text-violet-700" : "text-gray-500")}>
                              {lgu.name}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasData
                                ? <span className="text-[10px] font-bold text-violet-600">{lgu.activityCount}</span>
                                : <span className="text-[10px] text-gray-400">—</span>}
                              <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-violet-400" />
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1">
                            {hasData && <div className="h-1 rounded-full bg-violet-400" style={{ width: `${pct}%` }} />}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[10px] text-gray-400">
                              {hasData ? `${numberWithCommas(lgu.participantCount)} pax` : "no data"}
                            </p>
                            <p className="text-[9px] text-gray-300">{lgu.barangays.length} brgy</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
              }
            </CardContent>
          </Card>
        )}

            {/* ── Barangay panel ── */}
            {mapLevel === "barangay" && selLGU && (
              <Card className="flex-1 overflow-hidden flex flex-col">
                <CardHeader className="pb-1 pt-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5 truncate">
                      <Home className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      <span className="truncate">Barangays — {selLGU.name}</span>
                    </CardTitle>
                    <button onClick={goLGU} className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-0.5 shrink-0 ml-2">
                      <ChevronLeft className="w-3 h-3" /> Back
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {activeBarangays.size} of {selLGU.barangays.length} barangays have activity data
                  </p>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto pb-2 pt-0">
                  <div className="space-y-1 pt-1">
                    {selLGU.barangays.map(brgy => {
                      const info = activeBarangays.get(brgy.name);
                      return (
                        <div key={brgy.name}
                          className={cn("px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2",
                            info
                              ? "bg-green-50 border-green-200"
                              : "bg-gray-50 border-gray-100 opacity-70")}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                              info ? "bg-green-500" : "bg-gray-300")} />
                            <span className={cn("font-medium truncate", info ? "text-gray-800" : "text-gray-500")}>
                              {brgy.name}
                            </span>
                          </div>
                          {info && (
                            <div className="flex items-center gap-2 shrink-0 text-[10px]">
                              <span className="font-bold text-green-700">{info.count} act</span>
                              <span className="text-gray-400">{numberWithCommas(info.participants)} pax</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── Map + bottom strip ──────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Map canvas */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative">
          {MapLib ? (
            <MapLib.default
              {...viewState}
              onMove={(e: any) => setViewState(e.viewState)}
              mapStyle="mapbox://styles/mapbox/light-v11"
              mapboxAccessToken={MAPBOX_TOKEN}
              style={{ width: "100%", height: "100%" }}
            >
              <MapLib.NavigationControl position="top-right" showCompass={false} />
              <MapLib.FullscreenControl position="top-right" />
              <MapLib.ScaleControl position="bottom-right" />

              {/* Level badge */}
              <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-gray-100 flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full",
                  mapLevel === "province" ? "bg-blue-500"
                  : mapLevel === "lgu"    ? "bg-violet-500"
                  : "bg-green-500")} />
                <span className="text-[10px] font-semibold text-gray-600">
                  {mapLevel === "province" ? "Region V — All Provinces"
                    : mapLevel === "lgu"   ? `${selProvince?.provinceName} — LGUs (${lguRows.length})`
                    : `${selLGU?.name} — ${selLGU?.barangays.length} Barangays`}
                </span>
              </div>

              {/* ── Province markers ── */}
              {mapLevel === "province" && provPins.map(pin => {
                const scale = 0.6 + (pin.activityCount / maxProv) * 0.7;
                const size  = Math.round(34 * scale);
                return (
                  <MapLib.Marker key={pin.provinceId} longitude={pin.lng} latitude={pin.lat} anchor="center">
                    <div className="relative cursor-pointer flex items-center justify-center hover:z-10"
                      style={{ width: size + 14, height: size + 14 }}
                      onClick={() => selectProvince(pin)}>
                      <div className="absolute inset-[3px] rounded-full opacity-20" style={{ backgroundColor: provColor }} />
                      <div className="absolute rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                        style={{ inset: "5px", backgroundColor: provColor }}>
                        <span className="text-white font-bold leading-none" style={{ fontSize: Math.max(9, size * 0.28) }}>
                          {pin.activityCount}
                        </span>
                      </div>
                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold px-1.5 py-0.5 rounded-full shadow-sm pointer-events-none bg-white border"
                        style={{ borderColor: provColor, color: "#374151" }}>
                        {pin.provinceName}
                      </div>
                    </div>
                  </MapLib.Marker>
                );
              })}

              {/* ── LGU markers (all from R5 data) ── */}
              {(mapLevel === "lgu" || mapLevel === "barangay") && lguRows.map(lgu => {
                const isSelected = selLGU?.name === lgu.name;
                const hasData    = lgu.activityCount > 0;
                const scale      = hasData ? 0.55 + (lgu.activityCount / maxLGU) * 0.6 : 0.45;
                const size       = Math.round(26 * scale);
                const color      = hasData ? lguColor : "#9ca3af";
                return (
                  <MapLib.Marker key={lgu.name} longitude={lgu.lng} latitude={lgu.lat} anchor="center">
                    <div className="relative cursor-pointer flex items-center justify-center hover:z-10"
                      style={{ width: size + 14, height: size + 14 }}
                      onClick={() => selectLGU(lgu)}>
                      {isSelected && (
                        <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                          style={{ backgroundColor: lguColor }} />
                      )}
                      <div className="absolute inset-[3px] rounded-full opacity-15" style={{ backgroundColor: color }} />
                      <div className={cn("absolute rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform",
                        isSelected && "scale-110")}
                        style={{ inset: isSelected ? 0 : "4px", backgroundColor: color }}>
                        <span className="text-white font-bold leading-none" style={{ fontSize: Math.max(7, size * 0.32) }}>
                          {hasData ? lgu.activityCount : ""}
                        </span>
                      </div>
                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-semibold px-1.5 py-0.5 rounded-full shadow-sm pointer-events-none"
                        style={{
                          backgroundColor: isSelected ? lguColor : hasData ? "white" : "#f3f4f6",
                          color:           isSelected ? "white"  : hasData ? "#374151" : "#9ca3af",
                          border:          `1px solid ${isSelected ? lguColor : hasData ? "#e5e7eb" : "#e5e7eb"}`,
                        }}>
                        {lgu.name}
                      </div>
                    </div>
                  </MapLib.Marker>
                );
              })}

              {/* ── Barangay markers ── */}
              {mapLevel === "barangay" && selLGU && selLGU.barangays.map(brgy => {
                const info = activeBarangays.get(brgy.name);
                const hasData = !!info;
                const size = hasData ? 14 : 8;
                const color = hasData ? "#10b981" : "#d1d5db";
                return (
                  <MapLib.Marker key={brgy.name} longitude={brgy.coords[0]} latitude={brgy.coords[1]} anchor="center">
                    <div className="relative cursor-pointer flex items-center justify-center group hover:z-20"
                      style={{ width: size + 10, height: size + 10 }}>
                      {hasData && (
                        <>
                          <div className="absolute inset-0 rounded-full opacity-25 bg-green-500 group-hover:opacity-40 transition-opacity" />
                          <div className="absolute inset-[1px] rounded-full opacity-15 bg-green-400" />
                        </>
                      )}
                      <div className="absolute rounded-full shadow-md border-2 border-white group-hover:scale-125 transition-transform"
                        style={{ 
                          inset: hasData ? "3px" : "4px", 
                          backgroundColor: color 
                        }}>
                        {hasData && info.count > 0 && (
                          <span className="absolute inset-0 flex items-center justify-center text-white font-bold leading-none"
                            style={{ fontSize: Math.max(6, size * 0.35) }}>
                            {info.count}
                          </span>
                        )}
                      </div>
                      <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-medium px-2 py-1 rounded shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-white border z-30"
                        style={{ 
                          borderColor: hasData ? "#10b981" : "#d1d5db",
                          minWidth: "80px"
                        }}>
                        <div className={cn("font-semibold", hasData ? "text-green-700" : "text-gray-600")}>
                          {brgy.name}
                        </div>
                        {info ? (
                          <div className="text-[7px] text-gray-500 mt-0.5 flex items-center justify-between gap-2">
                            <span className="font-semibold text-green-600">{info.count} act</span>
                            <span>{numberWithCommas(info.participants)} pax</span>
                          </div>
                        ) : (
                          <div className="text-[7px] text-gray-400 mt-0.5">No activity data</div>
                        )}
                      </div>
                    </div>
                  </MapLib.Marker>
                );
              })}
            </MapLib.default>
          ) : (
            <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
              <p className="text-xs text-gray-400">Loading map…</p>
            </div>
          )}
        </div>

        {/* ── Activity strip ── */}
        {selProvince && (
          <Card className="max-h-44 overflow-hidden flex flex-col shrink-0">
            <CardHeader className="pb-1 pt-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold">
                  {selLGU ? `${selLGU.name}` : `${selProvince.provinceName}`} — Recent Activities
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Link href={`/activities?province=${selProvince.provinceId}`}>
                    <Button size="sm" variant="ghost" className="text-xs h-7 gap-1">
                      All <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                  <button onClick={goProvince} className="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center text-sm">✕</button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pb-2 pt-0">
              {!levelActivities
                ? <div className="space-y-1">{[1,2,3].map(i => <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />)}</div>
                : levelActivities.length === 0
                ? <p className="text-xs text-gray-400 py-2 text-center">No activities.</p>
                : <div className="space-y-0.5">
                    {levelActivities.slice(0, 8).map(act => {
                      const def = DICT_PROJECTS.find(p => p._id === act.projectId || p.code === (act as any).projectCode);
                      return (
                        <Link key={act._id} href={`/activities/${act._id}`}>
                          <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: def?.color ?? "#6b7280" }} />
                            <p className="flex-1 text-xs text-gray-800 truncate">{act.activityTitle}</p>
                            <span className="text-[10px] text-gray-400 shrink-0">{act.startDate}</span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium border shrink-0", getStatusColor(act.status))}>
                              {act.status}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                    {levelActivities.length > 8 && (
                      <Link href={`/activities?province=${selProvince.provinceId}`}>
                        <p className="text-xs text-blue-600 text-center py-1 hover:underline">
                          +{levelActivities.length - 8} more
                        </p>
                      </Link>
                    )}
                  </div>
              }
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── No token fallback ──────────────────────────────────────────
function NoTokenFallback({ pins }: { pins: ProvPin[] }) {
  return (
    <div className="w-full flex gap-4 h-[calc(100vh-5rem)] -mt-1">
      <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
        <div className="text-center p-8">
          <Globe className="w-14 h-14 mx-auto mb-4 text-gray-200" />
          <h2 className="text-base font-semibold text-gray-700 mb-2">Map Requires Mapbox Token</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Set <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">.env.local</code> to enable the map.
          </p>
          <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="mt-4 gap-1.5">
              Get Token <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </div>
      {pins.length > 0 && (
        <Card className="w-64 flex-shrink-0 overflow-y-auto">
          <CardHeader><CardTitle className="text-sm">Province Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[...pins].sort((a, b) => b.activityCount - a.activityCount).map(p => (
              <div key={p.provinceId}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700">{p.provinceName}</span>
                  <span className="text-gray-500">{p.activityCount} acts</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${(p.activityCount / Math.max(...pins.map(x => x.activityCount), 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
