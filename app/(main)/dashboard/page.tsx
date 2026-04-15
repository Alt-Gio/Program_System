"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useDashboardFilters } from "@/components/layout/DashboardFilterContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Monitor, Building2, Wifi, Network, Shield,
  GraduationCap, TrendingUp, Key, AlertTriangle, Globe,
  CheckCircle2, Clock, Users, Activity, ArrowRight, MapPin, Calendar,
  Download, ChevronLeft, ChevronRight, Heart, Filter, FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDate, getStatusColor, numberWithCommas, getCompletionRate, calcTotal } from "@/lib/utils";
import { CURRENT_YEAR, DICT_PROJECTS } from "@/lib/types";
import { Id } from "@/convex/_generated/dataModel";

const ICON_MAP: Record<string, React.ElementType> = {
  Monitor, Building2, Wifi, Network, Shield,
  GraduationCap, TrendingUp, Key, AlertTriangle, Globe,
};

// Map project codes to actual logo filenames in public/Logo/
const LOGO_MAP: Record<string, string> = {
  EGOVPH: "egov_ph_logo.png",
  ELGU: "elgu_logo.png",
  FREEWIFI: "freewifi_logo.png",
  GOVNET: "govnet_logo.png",
  NBP: "nbp_logo.png",
  CYBER: "cybersecurity_logo.png",
  PNPKI: "pnpki_logo.png",
  DRRM: "drrm_logo.png",
  ILCDB: "ilcdb_logo.jpg",
  IIDB: "iidb_logo.png",
};

function getProjectLogo(code: string): string {
  return `/Logo/${LOGO_MAP[code.toUpperCase()] || "egov_ph_logo.png"}`;
}

const MONTHS = [
  { value: 0, label: "All Months" },
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

export default function DashboardPage() {
  const { selectedProvince, selectedYear, selectedMonth, selectedProgram } = useDashboardFilters();
  const [isExporting, setIsExporting] = useState(false);
  
  const summary = useQuery(api.activities.dashboardSummary, { 
    year: selectedYear,
    provinceId: selectedProvince === "all" ? undefined : selectedProvince,
    month: selectedMonth === 0 ? undefined : selectedMonth,
    projectCode: selectedProgram === "all" ? undefined : selectedProgram,
  });
  const provinces = useQuery(api.provinces.list);
  const seedProjects = useMutation(api.projects.seed);
  const seedProvinces = useMutation(api.provinces.seed);
  const seedPersonnel = useMutation(api.personnel.seed);

  const handleExportToSheets = async () => {
    setIsExporting(true);
    try {
      const year = selectedYear === "all" ? CURRENT_YEAR : selectedYear;
      const params = new URLSearchParams({ year: String(year) });
      if (selectedProgram !== "all") params.append("project", selectedProgram);
      if (selectedMonth !== 0) params.append("month", String(selectedMonth));

      const response = await fetch(`/api/export-to-sheets?${params.toString()}`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok && data.sheetUrl) {
        window.open(data.sheetUrl, "_blank");
        alert(`✅ ${data.message}\n\nSheet: ${data.sheetName}\nRows: ${data.rowCount}\nFilters: ${data.filters}`);
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

  useEffect(() => {
    seedProjects();
    seedProvinces();
    seedPersonnel();
  }, [seedProjects, seedProvinces, seedPersonnel]);

  if (!summary || !provinces) return <DashboardSkeleton />;

  const total = summary.totalActivities;
  const completed = (summary.byStatus.validated ?? 0) + (summary.byStatus.reported ?? 0);
  const completionRate = getCompletionRate(completed, total);
  const genderRate = summary.totalParticipants > 0
    ? Math.round((summary.totalFemale / summary.totalParticipants) * 100)
    : 0;

  const quarterData = [
    { quarter: "Q1", count: [1,2,3].reduce((s, m) => s + (summary.byMonth?.[m] ?? 0), 0) },
    { quarter: "Q2", count: [4,5,6].reduce((s, m) => s + (summary.byMonth?.[m] ?? 0), 0) },
    { quarter: "Q3", count: [7,8,9].reduce((s, m) => s + (summary.byMonth?.[m] ?? 0), 0) },
    { quarter: "Q4", count: [10,11,12].reduce((s, m) => s + (summary.byMonth?.[m] ?? 0), 0) },
  ];

  return (
    <div className="space-y-5">
      {/* Main Layout: Carousel (Left) + Stats + Progress (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* LEFT: Activity Carousel */}
        <div className="xl:col-span-2">
          <ActivityCarousel 
            provinceId={selectedProvince === "all" ? undefined : selectedProvince}
            year={selectedYear === "all" ? undefined : selectedYear}
            month={selectedMonth === 0 ? undefined : selectedMonth}
            programCode={selectedProgram === "all" ? undefined : selectedProgram}
          />
        </div>

        {/* RIGHT: KPI Stats + Progress Bar */}
        <div className="space-y-3">
          <KPICard label="Total Activities" value={numberWithCommas(total)} 
            subtext={selectedYear === "all" ? "All Years" : `FY ${selectedYear}`}
            icon={<Activity className="w-5 h-5 text-blue-600" />} bg="bg-blue-50" />
          <KPICard label="Validated / Reported" value={numberWithCommas(completed)}
            subtext={`${completionRate}% completion rate`}
            icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} bg="bg-green-50"
            highlight={completionRate >= 70 ? "green" : completionRate >= 40 ? "yellow" : "red"} />
          <KPICard label="Total Participants" value={numberWithCommas(summary.totalParticipants)}
            subtext={`${numberWithCommas(summary.totalMale)}M / ${numberWithCommas(summary.totalFemale)}F`}
            icon={<Users className="w-5 h-5 text-violet-600" />} bg="bg-violet-50" />
          <KPICard label="In Progress"
            value={numberWithCommas((summary.byStatus.draft ?? 0) + (summary.byStatus.submitted ?? 0))}
            subtext={`${summary.byStatus.draft ?? 0} draft · ${summary.byStatus.submitted ?? 0} submitted`}
            icon={<Clock className="w-5 h-5 text-amber-600" />} bg="bg-amber-50" />
          
          {/* Overall Progress - Same Column as Stats */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-900">
                  {selectedYear === "all" ? "All Years" : `FY ${selectedYear}`} Progress
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{completed} of {total} validated</p>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Completion Rate</span>
                <span className={cn("text-xl font-bold",
                  completionRate >= 70 ? "text-green-600" : completionRate >= 40 ? "text-amber-600" : "text-red-600")}>
                  {completionRate}%
                </span>
              </div>
              <Progress value={completionRate} className="h-2.5 mb-3" />
              <div className="space-y-1.5">
                {[
                  { label: "Draft",     count: summary.byStatus.draft     ?? 0, color: "bg-gray-400" },
                  { label: "Submitted", count: summary.byStatus.submitted ?? 0, color: "bg-amber-400" },
                  { label: "Validated", count: summary.byStatus.validated ?? 0, color: "bg-blue-500" },
                  { label: "Reported",  count: summary.byStatus.reported  ?? 0, color: "bg-green-500" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", s.color)} />
                      <span className="text-gray-600">{s.label}</span>
                    </div>
                    <span className="font-medium text-gray-900">{s.count}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <a href={`/api/looker-export?year=${selectedYear === "all" ? CURRENT_YEAR : selectedYear}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </Button>
                </a>
                <Button 
                  size="sm" 
                  variant="default" 
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handleExportToSheets}
                  disabled={isExporting}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 
                  {isExporting ? "Exporting..." : "Export to Sheets"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Programs grid + Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Programs — 2/3 width */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {selectedProgram === "all" ? "Programs Overview" : `${DICT_PROJECTS.find(p => p.code === selectedProgram)?.shortName || "Program"} Overview`}
            </h2>
            <span className="text-xs text-gray-500">
              {selectedYear === "all" ? "All Years" : `FY ${selectedYear}`} · click to open
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summary.summary
              .filter(proj => selectedProgram === "all" || proj.code === selectedProgram)
              .map((proj) => {
              const def = DICT_PROJECTS.find(p => p.code === proj.code);
              const projCompleted = (proj.byStatus?.validated ?? 0) + (proj.byStatus?.reported ?? 0);
              const rate = getCompletionRate(projCompleted, proj.totalActivities);
              return (
                <Link key={proj.code} href={`/projects/${proj.code.toLowerCase()}`}>
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer bg-white group">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-white border border-gray-100 overflow-hidden p-1">
                      {def?.code ? (
                        <Image
                          src={getProjectLogo(def.code)}
                          alt={def.shortName}
                          width={48}
                          height={48}
                          className="object-contain"
                          unoptimized
                        />
                      ) : (
                        <Activity style={{ width: 20, height: 20, color: proj.color }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 truncate">
                          {proj.shortName}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">{proj.totalActivities} acts</span>
                      </div>
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{projCompleted} validated</span>
                          <span className={cn("font-medium",
                            rate >= 70 ? "text-green-600" : rate >= 40 ? "text-amber-600" : "text-gray-400")}>
                            {rate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${rate}%`, backgroundColor: proj.color }} />
                        </div>
                      </div>
                      {proj.totalParticipants > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{numberWithCommas(proj.totalParticipants)} participants</p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 shrink-0 mt-2 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Charts — 1/3 width */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Activities by Quarter</CardTitle>
              <CardDescription className="text-xs">
                {selectedYear === "all" ? "All Years" : `FY ${selectedYear}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={quarterData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    cursor={{ fill: "#f9fafb" }} />
                  <Bar dataKey="count" name="Activities" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Gender Breakdown</CardTitle>
              <CardDescription className="text-xs">{numberWithCommas(summary.totalParticipants)} total</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                { label: "Male",   value: summary.totalMale,   pct: 100 - genderRate, color: "bg-blue-500" },
                { label: "Female", value: summary.totalFemale, pct: genderRate,        color: "bg-pink-400" },
              ].map(g => (
                <div key={g.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{g.label}</span>
                    <span className="font-medium text-gray-800">{numberWithCommas(g.value)} ({g.pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={cn("h-2 rounded-full", g.color)} style={{ width: `${g.pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Coverage</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Active programs</span>
                <span className="font-semibold text-gray-800">{summary.summary.filter(s => s.totalActivities > 0).length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Total programs</span>
                <span className="font-semibold text-gray-800">{summary.summary.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600">Fiscal year</span>
                <span className="font-semibold text-gray-800">
                  {selectedYear === "all" ? "All Years" : `FY ${selectedYear}`}
                </span>
              </div>
              <Link href="/map" className="block mt-3">
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <MapPin className="w-3.5 h-3.5" /> Open Activity Map
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Activities</CardTitle>
              <CardDescription>Latest entries across all programs</CardDescription>
            </div>
            <Link href="/activities">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RecentActivitiesList />
        </CardContent>
      </Card>
    </div>
  );
}

function RecentActivitiesList() {
  const { selectedYear } = useDashboardFilters();
  const activities = useQuery(api.activities.listActivities, { 
    year: selectedYear === "all" ? undefined : selectedYear, 
    limit: 8 
  });
  if (!activities) return <Skeleton className="h-32 w-full" />;
  if (activities.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No activities yet.</p>
        <Link href="/activities/new" className="mt-3 inline-block">
          <Button size="sm" variant="outline">Add First Activity</Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="divide-y divide-gray-50">
      {activities.map((activity) => {
        const def = DICT_PROJECTS.find(p => p.code === (activity as any).projectCode);
        const total = calcTotal(activity.participants);
        return (
          <Link key={activity._id} href={`/activities/${activity._id}`}>
            <div className="flex items-start gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-white border border-gray-100 overflow-hidden">
                {def?.code ? (
                  <Image
                    src={getProjectLogo(def.code)}
                    alt={def.shortName}
                    width={32}
                    height={32}
                    className="object-contain p-0.5"
                    unoptimized
                  />
                ) : (
                  <Activity style={{ width: 16, height: 16, color: "#6b7280" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{activity.activityTitle}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{activity.venue}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(activity.startDate, "MMM d")}</span>
                  {total > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{numberWithCommas(total)}</span>}
                </div>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 border", getStatusColor(activity.status))}>
                {activity.status}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function KPICard({ label, value, subtext, icon, bg, highlight }: {
  label: string; value: string; subtext: string;
  icon: React.ReactNode; bg: string; highlight?: "green" | "yellow" | "red";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={cn("text-2xl font-bold mt-1",
              highlight === "green" ? "text-green-600" : highlight === "yellow" ? "text-amber-600" :
              highlight === "red" ? "text-red-600" : "text-gray-900")}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{subtext}</p>
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityCarousel({ provinceId, year, month, programCode }: {
  provinceId?: Id<"provinces">;
  year?: number;
  month?: number;
  programCode?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = useQuery(api.activityImages.getRecentImagesForDashboard, {
    provinceId,
    year,
    month,
    limit: 10,
  });

  // Filter by program if selected
  const filteredImages = programCode && images
    ? images.filter(img => {
        const project = DICT_PROJECTS.find(p => p.name === img.projectName);
        return project?.code === programCode;
      })
    : images;

  // Reset index when program changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [programCode]);

  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (!filteredImages || filteredImages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === filteredImages.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [filteredImages]);

  if (!filteredImages || filteredImages.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-100">
        <CardContent className="p-12 text-center">
          <Heart className="w-16 h-16 mx-auto mb-4 text-blue-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Activity Stories Yet</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Upload images to activities to showcase the amazing work happening across Bicol Region.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentImage = filteredImages[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? filteredImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === filteredImages.length - 1 ? 0 : prev + 1));
  };

  const projectDef = DICT_PROJECTS.find(p => p.name === currentImage.projectName);

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-100 shadow-lg">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              Stories from the Field
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Celebrating our people · FY {CURRENT_YEAR}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-500 min-w-[60px] text-center font-medium">
              {currentIndex + 1} / {filteredImages.length}
            </span>
            <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-4 px-5">
        <div className="space-y-3">
          {/* Large Image with 3D effect */}
          <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-xl transform perspective-1000">
            <div className="absolute inset-0 transition-transform duration-500 hover:scale-105 hover:rotate-y-2" style={{ transformStyle: 'preserve-3d' }}>
              <Image
                src={currentImage.url}
                alt={currentImage.caption || currentImage.activityTitle}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            {/* Project logo overlay */}
            {projectDef?.code && (
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
                <Image
                  src={getProjectLogo(projectDef.code)}
                  alt={projectDef.shortName}
                  width={80}
                  height={32}
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
          </div>
          {/* Details Below Image */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md" 
                style={{ backgroundColor: `${projectDef?.color}15`, color: projectDef?.color }}>
                {currentImage.projectName}
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(currentImage.startDate, "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                <MapPin className="w-3.5 h-3.5" />
                {currentImage.provinceName}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              {currentImage.activityTitle}
            </h3>
            {currentImage.caption && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {currentImage.caption}
              </p>
            )}
            <Link href={`/activities/${currentImage.activityId}`}>
              <Button variant="default" className="w-full mt-2 gap-2" style={{ backgroundColor: projectDef?.color }}>
                View Full Activity <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
      </div>
      <Card><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-2 gap-3">
          {[1,2,3,4,5,6,7,8,9,10].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
        </div>
      </div>
    </div>
  );
}
