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
    <div className="space-y-4 md:space-y-5">
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
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3">
            <span className="text-[10px] sm:text-xs bg-gray-100 text-gray-600 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">{projectDef.division}</span>
            {projectDef.requirementNote && (
              <span className="text-[10px] sm:text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                {projectDef.requirementNote}
              </span>
            )}
            {projectDef.targetSectors.slice(0, 3).map(s => (
              <span key={s} className="text-[10px] sm:text-xs bg-blue-50 text-blue-700 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <a href={`/api/looker-export?year=${CURRENT_YEAR}&project=${projectCode}`} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
            <Button variant="outline" size="sm" className="gap-1 sm:gap-1.5 text-xs w-full sm:w-auto">
              <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          </a>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1 sm:gap-1.5 text-xs flex-1 sm:flex-none"
            onClick={handleExportToSheets}
            disabled={isExporting}
          >
            <FileSpreadsheet className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 
            <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export to Sheets"}</span>
            <span className="sm:hidden">Sheets</span>
          </Button>
          <Button size="sm" className="gap-1 sm:gap-1.5 text-xs flex-1 sm:flex-none" style={{ backgroundColor: projectDef.color }}
            onClick={() => setShowAddActivity(true)}>
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" /> 
            <span className="hidden sm:inline">Add Activity</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {[
          { label: "Total Activities", icon: <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: projectDef.color }} />, value: stats?.totalActivities ?? 0, sub: `FY ${CURRENT_YEAR}`, bg: `${projectDef.color}12` },
          { label: "Total Participants", icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600" />, value: stats?.totalParticipants ?? 0, sub: "beneficiaries", bg: "#7c3aed12" },
          { label: "Validated / Reported", icon: <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />, value: validated, sub: `${completionRate}% rate`, bg: "#16a34a12" },
          { label: "Provinces Covered", icon: <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />, value: (provincePins ?? []).filter(p => p.activityCount > 0).length, sub: "of 6 provinces", bg: "#d9770612" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">{k.label}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1">{numberWithCommas(k.value)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">{k.sub}</p>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ml-1 sm:ml-2" style={{ backgroundColor: k.bg }}>
                  {k.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Province Distribution + Map - Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
        {/* LEFT - Province Distribution (2/3 width) */}
        <div className="xl:col-span-2">
          <Card className="border-2" style={{ borderColor: `${projectDef.color}30` }}>
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
            <CardContent className="pb-3 sm:pb-4 px-3 sm:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {provinces?.map((prov, idx) => {
                  const pin = (provincePins ?? []).find(p => p.provinceId === prov._id);
                  const count = pin?.activityCount ?? 0;
                  const pax = pin?.participantCount ?? 0;
                  const isSelected = selectedProvince === prov._id;
                  const percentage = stats?.totalActivities ? Math.round((count / stats.totalActivities) * 100) : 0;
                  
                  return (
                    <button
                      key={prov._id}
                      onClick={() => setSelectedProvince(isSelected ? null : prov._id)}
                      disabled={count === 0}
                      className={cn(
                        "text-left p-2.5 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all w-full relative overflow-hidden",
                        count === 0
                          ? "opacity-40 cursor-not-allowed bg-gray-50 border-gray-200"
                          : "cursor-pointer hover:shadow-md active:scale-[0.98]",
                        isSelected
                          ? "border-blue-400 bg-blue-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      {/* Header with ranking badge */}
                      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
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
                      <div className="space-y-1 sm:space-y-1.5 mb-1.5 sm:mb-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase">Activities</p>
                          <p className="text-base sm:text-lg font-bold" style={{ color: count > 0 ? projectDef.color : "#9ca3af" }}>
                            {count}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase">Participants</p>
                          <p className="text-base sm:text-lg font-bold text-violet-600">{pax > 0 ? numberWithCommas(pax) : "0"}</p>
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

        {/* RIGHT - Map (1/3 width) */}
        <div className="xl:col-span-1">
          <Card className="overflow-hidden h-full">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] sm:text-xs font-semibold text-gray-700">Activity Map — Region V</CardTitle>
                <Link href="/map">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-6 sm:h-7 px-2">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[300px] sm:h-[350px] md:h-[400px]">
                <ProjectMap pins={provincePins ?? []} projectColor={projectDef.color}
                  onProvinceClick={setSelectedProvince} selectedProvince={selectedProvince} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs - Monthly (default) and Activities only */}
      <Tabs defaultValue="monthly">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="monthly" className="flex-1 sm:flex-none text-xs sm:text-sm">Monthly</TabsTrigger>
          <TabsTrigger value="activities" className="flex-1 sm:flex-none text-xs sm:text-sm">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-3 sm:mt-4">
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
              <CardTitle className="text-xs sm:text-sm font-semibold">{projectDef.shortName} — Monthly Trend</CardTitle>
              <CardDescription className="text-[10px] sm:text-xs">FY {CURRENT_YEAR}</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pb-3 sm:pb-6">
              <ResponsiveContainer width="100%" height={180} className="sm:hidden">
                <BarChart data={monthData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} cursor={{ fill: "#f9fafb" }} />
                  <Bar dataKey="count" name="Activities" fill={projectDef.color} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={220} className="hidden sm:block">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-3">
            {[{q:"Q1",months:[1,2,3]},{q:"Q2",months:[4,5,6]},{q:"Q3",months:[7,8,9]},{q:"Q4",months:[10,11,12]}].map(({q, months}) => {
              const total = months.reduce((s, m) => s + (stats?.byMonth?.[m] ?? 0), 0);
              return (
                <Card key={q}>
                  <CardContent className="p-3 sm:p-4 text-center">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{q}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1" style={{ color: projectDef.color }}>{total}</p>
                    <p className="text-[10px] sm:text-xs text-gray-400">activities</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="activities" className="mt-3 sm:mt-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 px-1">
            <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 sm:w-36 h-7 sm:h-8 text-[11px] sm:text-xs"><SelectValue /></SelectTrigger>
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
                className="text-[10px] sm:text-xs text-blue-600 bg-blue-50 px-2 py-0.5 sm:py-1 rounded-full flex items-center gap-1 hover:bg-blue-100 active:scale-95 transition-transform">
                <span className="max-w-[100px] sm:max-w-none truncate">{provinceMap[selectedProvince]?.name}</span> ✕
              </button>
            )}
            <span className="text-[10px] sm:text-xs text-gray-400 ml-auto">{filteredActivities.length} activities</span>
          </div>

          {!activities ? (
            <div className="space-y-2 sm:space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 sm:h-20 w-full rounded-lg sm:rounded-xl" />)}</div>
          ) : filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="py-10 sm:py-14 text-center px-4">
                <Globe className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-gray-200" />
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">No activities match your filter.</p>
                <Link href={`/activities/new?project=${projectCode.toLowerCase()}`}>
                  <Button size="sm" variant="outline" className="gap-1 sm:gap-1.5 text-xs"><Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Activity</Button>
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
                    <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-white rounded-lg sm:rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer group">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 mt-1.5 sm:mt-2" style={{ backgroundColor: projectDef.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-blue-700 line-clamp-2 sm:truncate">{a.activityTitle}</p>
                          <span className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shrink-0 border whitespace-nowrap", getStatusColor(a.status))}>
                            {a.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-gray-500">
                          <span className="flex items-center gap-0.5 sm:gap-1"><MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" /><span className="truncate max-w-[120px] sm:max-w-none">{prov?.name ?? a.venue}</span></span>
                          <span className="flex items-center gap-0.5 sm:gap-1 whitespace-nowrap"><Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />{formatDate(a.startDate, "MMM d, yyyy")}</span>
                          {total > 0 && <span className="flex items-center gap-0.5 sm:gap-1 whitespace-nowrap"><Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />{numberWithCommas(total)} pax</span>}
                          <span className="text-gray-400 hidden sm:inline">{a.modeOfConduct}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover:text-blue-400 shrink-0 mt-0.5 sm:mt-1 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Activity CTA section ── */}
      <div className="rounded-xl sm:rounded-2xl border-2 border-dashed p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0"
        style={{ borderColor: `${projectDef.color}30`, background: `${projectDef.color}04` }}>
        <div className="flex-1">
          <p className="text-xs sm:text-sm font-bold text-gray-800">Record a new {projectDef.shortName} activity</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
            Saves to database{" "}
            <span className="font-medium" style={{ color: projectDef.color }}>and syncs to Google Sheet</span>
            {" "}if connected in Settings.
          </p>
        </div>
        <Button onClick={() => setShowAddActivity(true)} className="gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto text-xs sm:text-sm"
          style={{ backgroundColor: projectDef.color }}>
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Activity
        </Button>
      </div>

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
function ProjectMap({ pins, projectColor, onProvinceClick, selectedProvince }: {
  pins: ProvPin[];
  projectColor: string;
  onProvinceClick: (id: string | null) => void;
  selectedProvince: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markersRef   = useRef<Map<string, any>>(new Map());
  const [mapReady, setMapReady] = useState(false);

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
