"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Monitor, Building2, Wifi, Network, Shield, GraduationCap,
  TrendingUp, Key, AlertTriangle, Globe,
  Plus, MapPin, Calendar, Users, ArrowLeft, Download,
  CheckCircle2, ChevronRight, ExternalLink, Filter,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDate, getStatusColor, numberWithCommas, calcTotal, getCompletionRate } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR, MONTHS } from "@/lib/types";
import { PROJECT_DESCRIPTIONS } from "@/lib/project-descriptions";
import { ProjectDataTable } from "@/components/ProjectDataTable";

const ICON_MAP: Record<string, React.ElementType> = {
  Monitor, Building2, Wifi, Network, Shield,
  GraduationCap, TrendingUp, Key, AlertTriangle, Globe,
};
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface ProvPin {
  provinceId: string;
  provinceName: string;
  provinceCode: string;
  lat: number;
  lng: number;
  activityCount: number;
  participantCount: number;
  byProject: Record<string, number>;
}

export default function ProjectPage() {
  const { code } = useParams<{ code: string }>();
  const projectCode = code.toUpperCase();
  const projectDef = DICT_PROJECTS.find(p => p.code === projectCode);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  const project = useQuery(api.projects.getByCode, { code: projectCode });

  const stats = useQuery(
    api.activities.projectStats,
    project?._id ? { projectId: project._id, year: CURRENT_YEAR } : "skip"
  );

  const provincePins = useQuery(
    api.activities.activitiesByProvince,
    project?._id ? { projectId: project._id, year: CURRENT_YEAR } : "skip"
  );

  const activities = useQuery(
    api.activities.listActivities,
    project?._id
      ? { projectId: project._id, provinceId: selectedProvince ? (selectedProvince as any) : undefined, year: CURRENT_YEAR }
      : "skip"
  );

  const provinces = useQuery(api.provinces.list, {});

  if (!project || !projectDef) return <ProjectSkeleton />;

  const Icon = ICON_MAP[projectDef.icon] ?? Globe;
  const provinceMap = Object.fromEntries((provinces ?? []).map(p => [p._id, p]));
  
  const projectLogo = `/logo/${projectCode.toLowerCase() === 'egov' ? 'egov_ph' : projectCode.toLowerCase() === 'wifi' ? 'freewifi' : projectCode.toLowerCase() === 'cyber' ? 'cybersecurity' : projectCode.toLowerCase() === 'ilcdb' || projectCode.toLowerCase() === 'iidb' ? 'iidb' : projectCode.toLowerCase()}_logo.png`;

  const monthData = MONTHS.map((m, i) => ({
    name: m.slice(0, 3),
    count: stats?.byMonth?.[i + 1] ?? 0,
  }));

  const validated = (stats?.byStatus?.validated ?? 0) + (stats?.byStatus?.reported ?? 0);
  const completionRate = getCompletionRate(validated, stats?.totalActivities ?? 0);

  const filteredActivities = (activities ?? []).filter(
    a => statusFilter === "all" || a.status === statusFilter
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full mt-1 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 border-2" style={{ backgroundColor: `${projectDef.color}10`, borderColor: `${projectDef.color}30` }}>
              <Image src={projectLogo} alt={projectDef.shortName} width={48} height={48} className="object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{projectDef.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{projectDef.shortName}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{projectDef.division}</span>
            {projectDef.requirementNote && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                {projectDef.requirementNote}
              </span>
            )}
            {projectDef.targetSectors.slice(0, 3).map(s => (
              <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/api/looker-export?year=${CURRENT_YEAR}&project=${projectCode}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </a>
          <Link href={`/activities/new?project=${projectCode.toLowerCase()}`}>
            <Button size="sm" className="gap-1.5" style={{ backgroundColor: projectDef.color }}>
              <Plus className="w-4 h-4" /> Add Activity
            </Button>
          </Link>
        </div>
      </div>

      {/* Program Description */}
      {PROJECT_DESCRIPTIONS[projectCode] && (
        <Card className="border-l-4" style={{ borderLeftColor: projectDef.color }}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2" style={{ color: projectDef.color }}>Overview</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{PROJECT_DESCRIPTIONS[projectCode].overview}</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2" style={{ color: projectDef.color }}>Intent</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{PROJECT_DESCRIPTIONS[projectCode].intent}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2" style={{ color: projectDef.color }}>Purpose</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{PROJECT_DESCRIPTIONS[projectCode].purpose}</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2" style={{ color: projectDef.color }}>Key Features</h3>
                <ul className="grid md:grid-cols-2 gap-2">
                  {PROJECT_DESCRIPTIONS[projectCode].keyFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: projectDef.color }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2" style={{ color: projectDef.color }}>Impact</h3>
                <p className="text-sm text-gray-700 leading-relaxed font-medium">{PROJECT_DESCRIPTIONS[projectCode].impact}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Activities", icon: <CheckCircle2 className="w-4 h-4" style={{ color: projectDef.color }} />, value: stats?.totalActivities ?? 0, sub: `FY ${CURRENT_YEAR}`, bg: `${projectDef.color}12` },
          { label: "Total Participants", icon: <Users className="w-4 h-4 text-violet-600" />, value: stats?.totalParticipants ?? 0, sub: "beneficiaries", bg: "#7c3aed12" },
          { label: "Validated / Reported", icon: <CheckCircle2 className="w-4 h-4 text-green-600" />, value: validated, sub: `${completionRate}% rate`, bg: "#16a34a12" },
          { label: "Provinces Covered", icon: <MapPin className="w-4 h-4 text-amber-600" />, value: (provincePins ?? []).filter(p => p.activityCount > 0).length, sub: "of 6 provinces", bg: "#d9770612" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{numberWithCommas(k.value)}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: k.bg }}>
                  {k.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">FY {CURRENT_YEAR} Completion</p>
            <span className={cn("text-lg font-bold",
              completionRate >= 70 ? "text-green-600" : completionRate >= 40 ? "text-amber-600" : "text-red-500")}>
              {completionRate}%
            </span>
          </div>
          <Progress value={completionRate} className="h-2.5" />
          <div className="flex flex-wrap gap-4 mt-2.5">
            {[
              { label: "Draft", count: stats?.byStatus?.draft ?? 0, color: "bg-gray-400" },
              { label: "Submitted", count: stats?.byStatus?.submitted ?? 0, color: "bg-amber-400" },
              { label: "Validated", count: stats?.byStatus?.validated ?? 0, color: "bg-blue-500" },
              { label: "Reported",  count: stats?.byStatus?.reported  ?? 0, color: "bg-green-500" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className={cn("w-2 h-2 rounded-full", s.color)} />
                <span>{s.label}: <strong>{s.count}</strong></span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Project Data Table - Connected to Google Sheets */}
      <ProjectDataTable 
        projectId={project._id}
        projectCode={projectCode}
        projectColor={projectDef.color}
        year={CURRENT_YEAR}
      />

      {/* Main: Left Tabs + Right Map */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* LEFT — Tabs */}
        <div className="xl:col-span-3">
          <Tabs defaultValue="activities">
            <TabsList>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="by-month">Monthly</TabsTrigger>
              <TabsTrigger value="by-province">By Province</TabsTrigger>
            </TabsList>

            <TabsContent value="activities" className="mt-4">
              <div className="flex items-center gap-3 mb-3">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Validated">Validated</SelectItem>
                    <SelectItem value="Reported">Reported</SelectItem>
                  </SelectContent>
                </Select>
                {selectedProvince && (
                  <button onClick={() => setSelectedProvince(null)}
                    className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-blue-100">
                    {provinceMap[selectedProvince]?.name} ✕
                  </button>
                )}
                <span className="text-xs text-gray-400 ml-auto">{filteredActivities.length} activities</span>
              </div>

              {!activities ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
              ) : filteredActivities.length === 0 ? (
                <Card>
                  <CardContent className="py-14 text-center">
                    <Globe className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm text-gray-500 mb-4">No activities match your filter.</p>
                    <Link href={`/activities/new?project=${projectCode.toLowerCase()}`}>
                      <Button size="sm" variant="outline" className="gap-1.5"><Plus className="w-4 h-4" /> Add Activity</Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredActivities.map(a => {
                    const total = calcTotal(a.participants);
                    const prov = provinceMap[a.provinceId];
                    return (
                      <Link key={a._id} href={`/activities/${a._id}`}>
                        <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group">
                          <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: projectDef.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 truncate">{a.activityTitle}</p>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0 border", getStatusColor(a.status))}>
                                {a.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{prov?.name ?? a.venue}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(a.startDate, "MMM d, yyyy")}</span>
                              {total > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{numberWithCommas(total)} pax</span>}
                              <span className="text-gray-400">{a.modeOfConduct}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="by-month" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">{projectDef.shortName} — Monthly Trend</CardTitle>
                  <CardDescription className="text-xs">FY {CURRENT_YEAR}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthData} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "#f9fafb" }} />
                      <Bar dataKey="count" name="Activities" fill={projectDef.color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <div className="grid grid-cols-4 gap-3 mt-3">
                {[{q:"Q1",months:[1,2,3]},{q:"Q2",months:[4,5,6]},{q:"Q3",months:[7,8,9]},{q:"Q4",months:[10,11,12]}].map(({q, months}) => {
                  const total = months.reduce((s, m) => s + (stats?.byMonth?.[m] ?? 0), 0);
                  return (
                    <Card key={q}>
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-gray-500 font-medium">{q}</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: projectDef.color }}>{total}</p>
                        <p className="text-xs text-gray-400">activities</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="by-province" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {provinces?.map(prov => {
                  const pin = (provincePins ?? []).find(p => p.provinceId === prov._id);
                  const count = pin?.activityCount ?? 0;
                  const pax   = pin?.participantCount ?? 0;
                  const isSelected = selectedProvince === prov._id;
                  return (
                    <button key={prov._id}
                      onClick={() => setSelectedProvince(isSelected ? null : prov._id)}
                      className={cn("text-left p-4 rounded-xl border transition-all w-full",
                        count === 0 ? "opacity-50" : "cursor-pointer",
                        isSelected ? "border-blue-300 bg-blue-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                      )}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-800">{prov.name}</p>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{prov.code}</span>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: count > 0 ? projectDef.color : "#9ca3af" }}>{count}</div>
                      <p className="text-xs text-gray-500 mt-0.5">{numberWithCommas(pax)} participants</p>
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${getCompletionRate(count, stats?.totalActivities ?? 1)}%`, backgroundColor: count > 0 ? projectDef.color : "#e5e7eb" }} />
                      </div>
                      {isSelected && count > 0 && <p className="text-xs text-blue-600 mt-2">Filtering activities above ↑</p>}
                    </button>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT — Map + Province list */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-gray-700">Activity Map — Region V</CardTitle>
                <Link href="/map">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">Full map <ExternalLink className="w-3 h-3" /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-64">
                <ProjectMap pins={provincePins ?? []} projectColor={projectDef.color}
                  onProvinceClick={setSelectedProvince} selectedProvince={selectedProvince} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-xs font-semibold text-gray-700">Province Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {(provincePins ?? []).length === 0 ? (
                <p className="text-xs text-gray-400 py-2 text-center">No data yet</p>
              ) : (
                [...(provincePins ?? [])].sort((a, b) => b.activityCount - a.activityCount).map(prov => {
                  const maxC = Math.max(...(provincePins ?? []).map(p => p.activityCount), 1);
                  const pct = Math.round((prov.activityCount / maxC) * 100);
                  const isSelected = selectedProvince === prov.provinceId;
                  return (
                    <button key={prov.provinceId}
                      onClick={() => setSelectedProvince(isSelected ? null : prov.provinceId)}
                      className={cn("w-full text-left rounded-lg px-2 py-1.5 transition-colors",
                        isSelected ? "bg-blue-50" : "hover:bg-gray-50")}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                          style={{ backgroundColor: projectDef.color }}>
                          {prov.activityCount}
                        </div>
                        <p className={cn("text-xs font-medium flex-1", isSelected ? "text-blue-700" : "text-gray-700")}>
                          {prov.provinceName}
                        </p>
                        <span className="text-[10px] text-gray-400">{numberWithCommas(prov.participantCount)} pax</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 ml-7">
                        <div className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: projectDef.color }} />
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {activities && activities.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-semibold text-gray-700">Mode of Conduct</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {(() => {
                  const counts: Record<string, number> = {};
                  for (const a of activities) counts[a.modeOfConduct] = (counts[a.modeOfConduct] ?? 0) + 1;
                  const total = activities.length;
                  return (
                    <div className="space-y-2">
                      {Object.entries(counts).sort(([,a],[,b]) => b - a).map(([mode, cnt]) => (
                        <div key={mode}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{mode}</span>
                            <span className="font-medium text-gray-800">{cnt} ({Math.round(cnt/total*100)}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${cnt/total*100}%`, backgroundColor: projectDef.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Province Map ─────────────────────────────────────────────
function ProjectMap({ pins, projectColor, onProvinceClick, selectedProvince }: {
  pins: ProvPin[];
  projectColor: string;
  onProvinceClick: (id: string | null) => void;
  selectedProvince: string | null;
}) {
  const [MapLib, setMapLib] = useState<any>(null);
  const [viewState, setViewState] = useState({ longitude: 123.5, latitude: 13.0, zoom: 7 });
  const [hovered, setHovered] = useState<ProvPin | null>(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    Promise.all([
      import("react-map-gl"),
      import("mapbox-gl/dist/mapbox-gl.css" as any).catch(() => null),
    ]).then(([m]) => setMapLib(m));
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const pin = pins.find(p => p.provinceId === selectedProvince);
      if (pin) setViewState({ longitude: pin.lng, latitude: pin.lat, zoom: 10 });
    }
  }, [selectedProvince, pins]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <Globe className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-xs text-gray-400">Set NEXT_PUBLIC_MAPBOX_TOKEN to enable map</p>
        </div>
      </div>
    );
  }
  if (!MapLib) return <div className="h-full bg-gray-100 animate-pulse" />;

  const maxCount = Math.max(...pins.map(p => p.activityCount), 1);

  return (
    <MapLib.default {...viewState} onMove={(e: any) => setViewState(e.viewState)}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN} style={{ width: "100%", height: "100%" }}>
      <MapLib.NavigationControl position="top-right" showCompass={false} />
      {pins.map(pin => {
        const isSelected = selectedProvince === pin.provinceId;
        const size = Math.round(30 + (pin.activityCount / maxCount) * 20);
        return (
          <MapLib.Marker key={pin.provinceId} longitude={pin.lng} latitude={pin.lat} anchor="center">
            <div className="relative cursor-pointer flex items-center justify-center transition-all"
              style={{ width: size + 10, height: size + 10 }}
              onMouseEnter={() => setHovered(pin)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onProvinceClick(isSelected ? null : pin.provinceId)}>
              {isSelected && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-25"
                  style={{ backgroundColor: projectColor }} />
              )}
              <div className="absolute inset-[3px] rounded-full opacity-20" style={{ backgroundColor: projectColor }} />
              <div className={cn("absolute rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform", isSelected && "scale-110")}
                style={{ inset: isSelected ? 0 : "4px", backgroundColor: projectColor }}>
                <span className="text-white font-bold leading-none" style={{ fontSize: Math.max(8, size * 0.28) }}>
                  {pin.activityCount}
                </span>
              </div>
              <div className="absolute top-full mt-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-semibold px-1 py-0.5 rounded-full pointer-events-none"
                style={{ backgroundColor: isSelected ? projectColor : "white", color: isSelected ? "white" : "#374151", border: `1px solid ${isSelected ? projectColor : "#e5e7eb"}` }}>
                {pin.provinceName}
              </div>
            </div>
          </MapLib.Marker>
        );
      })}
      {hovered && (
        <MapLib.Popup longitude={hovered.lng} latitude={hovered.lat} anchor="top" closeButton={false} offset={22}>
          <div className="p-2">
            <p className="text-xs font-bold text-gray-900">{hovered.provinceName}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              <span className="font-semibold" style={{ color: projectColor }}>{hovered.activityCount}</span> activities
            </p>
            <p className="text-xs text-gray-500">{numberWithCommas(hovered.participantCount)} pax</p>
          </div>
        </MapLib.Popup>
      )}
    </MapLib.default>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex gap-4"><Skeleton className="w-10 h-10 rounded-full" /><Skeleton className="h-20 flex-1" /></div>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3"><Skeleton className="h-96 rounded-xl" /></div>
        <div className="col-span-2 space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
