"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Monitor, Building2, Wifi, Network, Shield, GraduationCap,
  TrendingUp, Key, AlertTriangle, Globe,
  Plus, MapPin, Calendar, Users, ArrowLeft, Download,
  CheckCircle2, ChevronRight, ExternalLink, Filter, FileSpreadsheet, Loader2,
  Settings as SettingsIcon,
} from "lucide-react";
import { ProjectSettingsDialog } from "@/components/project-settings/ProjectSettingsDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn, formatDate, getStatusColor, numberWithCommas, calcTotal, getCompletionRate } from "@/lib/utils";
import { AddActivityDialog } from "@/components/AddActivityDialog";
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
  const [isExporting, setIsExporting] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<{ lat: number; lng: number; ts: number } | null>(null);

  const project = useQuery(api.projects.getByCode, { code: projectCode });

  const stats = useQuery(
    api.activities.projectStats,
    project?._id ? { projectId: project._id, year: selectedYear } : "skip"
  );

  const provincePins = useQuery(
    api.activities.activitiesByProvince,
    project?._id ? { projectId: project._id, year: selectedYear } : "skip"
  );

  const activities = useQuery(
    api.activities.listActivities,
    project?._id
      ? { projectId: project._id, provinceId: selectedProvince ? (selectedProvince as any) : undefined, year: selectedYear }
      : "skip"
  );

  const provinces = useQuery(api.provinces.list, {});

  const handleExportToSheets = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ 
        year: String(CURRENT_YEAR),
        project: projectCode 
      });

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

  if (!project || !projectDef) {
    return <ProjectSkeleton />;
  }

  const Icon = ICON_MAP[projectDef.icon] ?? Globe;
  const provinceMap = Object.fromEntries((provinces ?? []).map(p => [p._id, p]));
  
  const projectLogo = `/logo/${projectCode.toLowerCase() === 'egov' ? 'egov_ph' : projectCode.toLowerCase() === 'wifi' ? 'freewifi' : projectCode.toLowerCase() === 'cyber' ? 'cybersecurity' : projectCode.toLowerCase() === 'ilcdb' || projectCode.toLowerCase() === 'iidb' ? 'iidb' : projectCode.toLowerCase()}_logo.png`;

  const QUARTER_MONTHS: Record<number, number[]> = { 1:[1,2,3], 2:[4,5,6], 3:[7,8,9], 4:[10,11,12] };

  const yearMonthData = MONTHS.map((m, i) => ({
    name: m.slice(0, 3),
    count: stats?.byMonth?.[i + 1] ?? 0,
    monthNum: i + 1,
  }));

  const validated = (stats?.byStatus?.validated ?? 0) + (stats?.byStatus?.reported ?? 0);
  const completionRate = getCompletionRate(validated, stats?.totalActivities ?? 0);

  const displayActivities = (activities ?? [])
    .filter(a => {
      const matchesProv = !selectedProvince || a.provinceId === selectedProvince;
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      const matchesPeriod = selectedMonth
        ? a.month === selectedMonth
        : selectedQuarter
          ? QUARTER_MONTHS[selectedQuarter].includes(a.month)
          : true;
      return matchesProv && matchesStatus && matchesPeriod;
    })
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const handleProvinceSelect = (provId: string | null) => {
    setSelectedProvince(provId);
    if (provId !== null) {
      const pin = (provincePins ?? []).find(p => p.provinceId === provId);
      if (pin?.lat && pin?.lng) setFlyToCoords({ lat: pin.lat, lng: pin.lng, ts: Date.now() });
    }
  };

  return (
    <div className="page-content space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full mt-1 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center shrink-0 border-2" style={{ backgroundColor: `${projectDef.color}10`, borderColor: `${projectDef.color}30` }}>
              <Image src={projectLogo} alt={projectDef.shortName} width={48} height={48} className="object-contain w-8 h-8 sm:w-12 sm:h-12" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{projectDef.name}</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{projectDef.shortName}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-1.5 text-xs flex-1 sm:flex-none"
            onClick={() => setShowExport(true)}
          >
            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Export…</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button size="sm" className="gap-1 sm:gap-1.5 text-xs flex-1 sm:flex-none" style={{ backgroundColor: projectDef.color }}
            onClick={() => setShowAddActivity(true)}>
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Add Activity</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            onClick={() => setShowProjectSettings(true)}
            aria-label={`${projectDef.shortName} settings`}
            title="Project settings"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-gray-500" />
          </Button>
        </div>
      </div>

      <ProjectSettingsDialog
        open={showProjectSettings}
        onOpenChange={setShowProjectSettings}
        projectCode={projectCode}
        projectRoute={code}
        shortName={projectDef.shortName}
        color={projectDef.color}
      />

      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        scope={{ label: `${projectDef.shortName} activities`, projectCode }}
        defaultYear={selectedYear}
      />

      {/* Program Description - Modal Trigger - Compact */}
      {PROJECT_DESCRIPTIONS[projectCode] && (
        <div className="flex justify-end px-1">
          <button
            onClick={() => setShowDescriptionModal(true)}
            className="text-[11px] sm:text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors flex items-center gap-1"
          >
            See More About {projectDef.shortName}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Program Description Modal */}
      <Dialog open={showDescriptionModal} onOpenChange={setShowDescriptionModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto backdrop-blur-xl w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${projectDef.color}15` }}>
                <Image src={projectLogo} alt={projectDef.shortName} width={32} height={32} className="object-contain w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <span className="text-base sm:text-2xl">{projectDef.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">
              {projectDef.shortName} - {projectDef.division}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6 mt-3 sm:mt-4">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 sm:mb-3 flex items-center gap-2" style={{ color: projectDef.color }}>
                <div className="w-1 h-3 sm:h-4 rounded-full" style={{ backgroundColor: projectDef.color }} />
                Overview
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{PROJECT_DESCRIPTIONS[projectCode].overview}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 sm:mb-3 flex items-center gap-2" style={{ color: projectDef.color }}>
                  <div className="w-1 h-3 sm:h-4 rounded-full" style={{ backgroundColor: projectDef.color }} />
                  Intent
                </h3>
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{PROJECT_DESCRIPTIONS[projectCode].intent}</p>
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 sm:mb-3 flex items-center gap-2" style={{ color: projectDef.color }}>
                  <div className="w-1 h-3 sm:h-4 rounded-full" style={{ backgroundColor: projectDef.color }} />
                  Purpose
                </h3>
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{PROJECT_DESCRIPTIONS[projectCode].purpose}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 sm:mb-3 flex items-center gap-2" style={{ color: projectDef.color }}>
                <div className="w-1 h-3 sm:h-4 rounded-full" style={{ backgroundColor: projectDef.color }} />
                Key Features
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                {PROJECT_DESCRIPTIONS[projectCode].keyFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-gray-700">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 mt-0.5" style={{ color: projectDef.color }} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="pt-3 sm:pt-4 border-t border-gray-200">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 sm:mb-3 flex items-center gap-2" style={{ color: projectDef.color }}>
                <div className="w-1 h-3 sm:h-4 rounded-full" style={{ backgroundColor: projectDef.color }} />
                Impact
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium">{PROJECT_DESCRIPTIONS[projectCode].impact}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Province Distribution + Map - Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
        {/* LEFT - Province Distribution (compact) */}
        <div className="xl:col-span-1 h-full">
          <Card className="border-2 h-full flex flex-col" style={{ borderColor: `${projectDef.color}30` }}>
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold">Province Distribution</CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs mt-0.5">Activities & Participants by Province - FY {CURRENT_YEAR}</CardDescription>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs">
                  <div className="text-center px-2 sm:px-3 py-1 bg-gray-50 rounded-lg">
                    <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">Active</p>
                    <p className="text-base sm:text-lg font-bold" style={{ color: projectDef.color }}>
                      {(provincePins ?? []).filter(p => p.activityCount > 0).length}
                    </p>
                  </div>
                  <div className="text-center px-2 sm:px-3 py-1 bg-gray-50 rounded-lg">
                    <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">Coverage</p>
                    <p className="text-base sm:text-lg font-bold text-green-600">
                      {Math.round(((provincePins ?? []).filter(p => p.activityCount > 0).length / (provinces?.length ?? 1)) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pb-3 sm:pb-4 px-3 sm:px-6">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 grid-rows-2 gap-1.5">
                {provinces?.map((prov, idx) => {
                  const pin = (provincePins ?? []).find(p => p.provinceId === prov._id);
                  const count = pin?.activityCount ?? 0;
                  const pax = pin?.participantCount ?? 0;
                  const isSelected = selectedProvince === prov._id;
                  const percentage = stats?.totalActivities ? Math.round((count / stats.totalActivities) * 100) : 0;
                  
                  return (
                    <button
                      key={prov._id}
                      onClick={() => handleProvinceSelect(isSelected ? null : prov._id)}
                      disabled={count === 0}
                      className={cn(
                        "text-left p-2 rounded-lg border-2 transition-all w-full h-full relative overflow-hidden",
                        count === 0
                          ? "opacity-40 cursor-not-allowed bg-gray-50 border-gray-200"
                          : "cursor-pointer hover:shadow-md active:scale-[0.98]",
                        isSelected
                          ? "border-blue-400 bg-blue-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      {/* Header with ranking badge */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <div
                            className={cn(
                              "w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white shrink-0",
                              count === 0 ? "bg-gray-300" : ""
                            )}
                            style={{ backgroundColor: count > 0 ? projectDef.color : undefined }}
                          >
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[11px] sm:text-xs font-bold truncate", isSelected ? "text-blue-900" : "text-gray-900")}>
                              {prov.name}
                            </p>
                            <span
                              className={cn(
                                "text-[8px] sm:text-[9px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-full inline-block",
                                isSelected ? "bg-blue-200 text-blue-700" : "bg-gray-100 text-gray-600"
                              )}
                            >
                              {prov.code}
                            </span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />}
                      </div>

                      {/* Stats in compact layout */}
                      <div className="space-y-0.5 mb-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase">Activities</p>
                          <p className="text-sm font-bold" style={{ color: count > 0 ? projectDef.color : "#9ca3af" }}>
                            {count}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase">Participants</p>
                          <p className="text-sm font-bold text-violet-600">{pax > 0 ? numberWithCommas(pax) : "0"}</p>
                        </div>
                      </div>

                      {/* Compact progress bar */}
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[8px] sm:text-[9px] font-medium text-gray-500">Contribution</p>
                          <p className="text-[8px] sm:text-[9px] font-bold" style={{ color: count > 0 ? projectDef.color : "#9ca3af" }}>
                            {percentage}%
                          </p>
                        </div>
                        <div className="h-1 sm:h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: count > 0 ? projectDef.color : "#e5e7eb",
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT - Map (enlarged) */}
        <div className="xl:col-span-1">
          <Card className="overflow-hidden h-full">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] sm:text-xs font-semibold text-gray-700">Activity Map — Region V
                  {selectedProvince && (
                    <span className="ml-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${projectDef.color}20`, color: projectDef.color }}>
                      {provinceMap[selectedProvince]?.name ?? ""}
                    </span>
                  )}
                </CardTitle>
                <Link href="/map">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-6 sm:h-7 px-2">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[380px] sm:h-[450px] md:h-[520px]">
                <ProjectMap
                  pins={provincePins ?? []}
                  projectColor={projectDef.color}
                  onProvinceClick={handleProvinceSelect}
                  selectedProvince={selectedProvince}
                  flyToCoords={flyToCoords}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full-year chart + Activity list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">

        {/* Left – interactive full-year bar chart */}
        <Card>
          <CardHeader className="px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xs sm:text-sm font-semibold">Monthly Trend</CardTitle>
                <CardDescription className="text-[10px] sm:text-xs flex items-center gap-1">
                  {selectedMonth ? MONTHS[selectedMonth - 1] : "Full Year"} · FY {selectedYear}
                  {selectedMonth && (
                    <button onClick={() => setSelectedMonth(null)} className="ml-1 text-blue-500 hover:text-blue-700 leading-none">✕</button>
                  )}
                </CardDescription>
              </div>
              <Select value={String(selectedYear)} onValueChange={v => { setSelectedYear(Number(v)); setSelectedMonth(null); setSelectedQuarter(null); }}>
                <SelectTrigger className="w-24 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-1 sm:px-2 pb-3 sm:pb-4">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={yearMonthData} barSize={13} margin={{ left: -14, right: 4 }}
                onClick={(data) => {
                  if (!data?.activePayload?.[0]) return;
                  const mn = (data.activePayload[0].payload as any).monthNum as number;
                  setSelectedMonth(selectedMonth === mn ? null : mn);
                  setSelectedQuarter(null);
                }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={26} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} cursor={{ fill: "#f3f4f6" }} />
                <Bar dataKey="count" name="Activities" radius={[3, 3, 0, 0]} cursor="pointer">
                  {yearMonthData.map((entry) => {
                    const isHighlighted =
                      (selectedMonth === null && selectedQuarter === null) ||
                      selectedMonth === entry.monthNum ||
                      (selectedQuarter !== null && QUARTER_MONTHS[selectedQuarter].includes(entry.monthNum));
                    return (
                      <Cell
                        key={`cell-${entry.monthNum}`}
                        fill={isHighlighted ? projectDef.color : `${projectDef.color}28`}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right – activity list, filtered by month / quarter */}
        <Card className="flex flex-col">
          <CardHeader className="px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-xs sm:text-sm font-semibold">Activities</CardTitle>
                <CardDescription className="text-[10px] sm:text-xs">
                  {selectedMonth ? MONTHS[selectedMonth - 1] : selectedQuarter ? `Q${selectedQuarter}` : `All · FY ${selectedYear}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedProvince && (
                  <button onClick={() => setSelectedProvince(null)}
                    className="text-[9px] sm:text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 hover:bg-blue-100">
                    <span className="truncate max-w-[60px]">{provinceMap[selectedProvince]?.name}</span> ✕
                  </button>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-24 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Validated">Validated</SelectItem>
                    <SelectItem value="Reported">Reported</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${projectDef.color}15`, color: projectDef.color }}>
                  {displayActivities.length}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 flex-1">
            {!activities ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
            ) : displayActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <Calendar className="w-8 h-8 mb-2" />
                <p className="text-[10px] sm:text-xs text-center">
                  {selectedMonth ? `No activities in ${MONTHS[selectedMonth - 1]}` : selectedQuarter ? `No Q${selectedQuarter} activities` : "No activities yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                {displayActivities.map(a => {
                  const prov = provinceMap[a.provinceId];
                  const total = calcTotal(a.participants);
                  return (
                    <div key={a._id} className="flex items-stretch rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all group overflow-hidden">
                      <Link href={`/activities/${a._id}`} className="flex items-start gap-2 p-2 sm:p-2.5 flex-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: projectDef.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs font-semibold text-gray-900 group-hover:text-blue-700 truncate">{a.activityTitle}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[9px] sm:text-[10px] text-gray-400">
                            <span className="whitespace-nowrap">{formatDate(a.startDate, "MMM d, yyyy")}</span>
                            {prov && <span className="truncate max-w-[80px]">{prov.name}</span>}
                            {total > 0 && <span className="whitespace-nowrap">{numberWithCommas(total)} pax</span>}
                          </div>
                        </div>
                        <span className={cn("text-[8px] sm:text-[9px] px-1 py-0.5 rounded-full font-medium shrink-0 border whitespace-nowrap self-start mt-0.5", getStatusColor(a.status))}>{a.status}</span>
                      </Link>
                      {a.provinceId && (
                        <button
                          title="Locate on map"
                          onClick={() => handleProvinceSelect(a.provinceId)}
                          className="px-1.5 border-l border-gray-100 text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors shrink-0 flex items-center"
                        >
                          <MapPin className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Q1–Q4 clickable quarter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {([{q:1,label:"Q1",months:[1,2,3]},{q:2,label:"Q2",months:[4,5,6]},{q:3,label:"Q3",months:[7,8,9]},{q:4,label:"Q4",months:[10,11,12]}] as const).map(({q, label, months}) => {
          const qTotal = (months as readonly number[]).reduce((s, m) => s + (stats?.byMonth?.[m] ?? 0), 0);
          const isActive = selectedQuarter === q;
          return (
            <button
              key={label}
              onClick={() => { setSelectedQuarter(selectedQuarter === q ? null : q); setSelectedMonth(null); }}
              className={cn(
                "text-center p-3 sm:p-4 rounded-xl border-2 transition-all w-full",
                isActive ? "shadow-md" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              )}
              style={isActive ? { borderColor: projectDef.color, background: `${projectDef.color}08` } : {}}
            >
              <p className="text-[10px] sm:text-xs font-semibold" style={{ color: isActive ? projectDef.color : "#9ca3af" }}>{label}</p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1" style={{ color: isActive ? projectDef.color : "#111827" }}>{qTotal}</p>
              <p className="text-[10px] sm:text-xs text-gray-400">activities</p>
            </button>
          );
        })}
      </div>

      {/* ── Extra Field Schema cards (unique per project, from lib/types.ts) ── */}
      {projectDef.extraFieldSchema.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3 px-0.5">
            <p className="text-xs sm:text-sm font-bold text-gray-700">{projectDef.shortName} — Tracked Metrics</p>
            <Button onClick={() => setShowAddActivity(true)} size="sm" className="gap-1.5 text-xs"
              style={{ backgroundColor: projectDef.color }}>
              <Plus className="w-3.5 h-3.5" /> Add Activity
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {projectDef.extraFieldSchema.map(field => (
              <Card key={field.key}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <p className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-gray-400 truncate">{field.group ?? "General"}</p>
                    <span className={cn(
                      "text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                      field.type === "number" ? "bg-blue-50 text-blue-600" :
                      field.type === "select" ? "bg-purple-50 text-purple-600" :
                      field.type === "url"    ? "bg-green-50 text-green-600" :
                      "bg-gray-100 text-gray-500"
                    )}>{field.type}</span>
                  </div>
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-800 leading-tight">{field.label}</p>
                  {field.options && (
                    <div className="flex flex-wrap gap-0.5 mt-1.5">
                      {field.options.map(opt => (
                        <span key={opt} className="text-[8px] sm:text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{opt}</span>
                      ))}
                    </div>
                  )}
                  {field.required && (
                    <span className="inline-block mt-1.5 text-[8px] sm:text-[9px] text-red-500 font-semibold">Required</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Activity Dialog */}
      {project && (
        <AddActivityDialog
          open={showAddActivity}
          onOpenChange={setShowAddActivity}
          projectDef={projectDef}
          projectId={project._id}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

// ── Project Map Component ────────────────────────────────────
function ProjectMap({ pins, projectColor, onProvinceClick, selectedProvince, flyToCoords }: {
  pins: ProvPin[];
  projectColor: string;
  onProvinceClick: (id: string | null) => void;
  selectedProvince: string | null;
  flyToCoords?: { lat: number; lng: number; ts: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markersRef   = useRef<Map<string, any>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // Fly to province when triggered
  useEffect(() => {
    if (!flyToCoords || !mapRef.current || !mapReady) return;
    mapRef.current.flyTo({
      center: [flyToCoords.lng, flyToCoords.lat],
      zoom: 10,
      duration: 1200,
      essential: true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToCoords]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    let mounted = true;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (!mounted) return;

      if (!document.getElementById("mapbox-gl-css")) {
        const link = document.createElement("link");
        link.id   = "mapbox-gl-css";
        link.rel  = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css";
        document.head.appendChild(link);
      }

      mapboxgl.accessToken = MAPBOX_TOKEN!;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [123.75, 13.45],
        zoom: 7,
        attributionControl: false,
        interactive: true,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("load", () => { if (mounted) setMapReady(true); });

      mapRef.current = map;
    })();

    return () => {
      mounted = false;
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers whenever pins / selection change
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;

      // Remove existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();

      const maxCount = Math.max(...pins.map(p => p.activityCount), 1);

      for (const pin of pins) {
        if (!pin.lat || !pin.lng || pin.activityCount === 0) continue;

        const isSelected = selectedProvince === pin.provinceId;
        const ratio      = pin.activityCount / maxCount;
        const size       = Math.round(28 + ratio * 24);  // 28–52 px

        const el = document.createElement("div");
        el.style.cssText = [
          `width:${size}px`,
          `height:${size}px`,
          `background:${isSelected ? "#1d4ed8" : projectColor}`,
          `border:${isSelected ? 3 : 2.5}px solid ${isSelected ? "#93c5fd" : "rgba(255,255,255,0.9)"}`,
          "border-radius:50%",
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "cursor:pointer",
          `box-shadow:0 2px 10px ${isSelected ? "rgba(29,78,216,0.5)" : "rgba(0,0,0,0.3)"}`,
          "transition:all 0.15s",
          "color:white",
          `font-weight:700`,
          `font-size:${size < 36 ? "10px" : "12px"}`,
          "font-family:sans-serif",
          "user-select:none",
          "z-index:10",
        ].join(";");
        el.textContent = String(pin.activityCount);
        el.title = `${pin.provinceName}: ${pin.activityCount} activities`;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onProvinceClick(selectedProvince === pin.provinceId ? null : pin.provinceId);
        });

        const popup = new mapboxgl.Popup({
          offset: size / 2 + 4,
          closeButton: false,
          closeOnClick: false,
          className: "province-popup",
        }).setHTML(`
          <div style="font-family:sans-serif;padding:6px 2px;">
            <p style="font-weight:700;font-size:13px;margin:0 0 3px;color:#111">${pin.provinceName}</p>
            <p style="font-size:11px;margin:0;color:#6b7280">
              🗂 ${pin.activityCount} activities &nbsp;·&nbsp; 👥 ${pin.participantCount.toLocaleString()} participants
            </p>
          </div>
        `);

        el.addEventListener("mouseenter", () => popup.addTo(mapRef.current!));
        el.addEventListener("mouseleave", () => popup.remove());

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng, pin.lat])
          .addTo(mapRef.current!);

        markersRef.current.set(pin.provinceId, marker);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, pins, projectColor, selectedProvince]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 p-4">
        <MapPin className="w-6 h-6 text-gray-400" />
        <p className="text-xs text-gray-500 text-center font-medium">Map disabled</p>
        <p className="text-[10px] text-gray-400 text-center">
          Add <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to .env.local
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────
function ProjectSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
