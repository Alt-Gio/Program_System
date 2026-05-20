"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useDashboardFilters } from "@/components/layout/DashboardFilterContext";

// Split `recharts` out of the initial dashboard bundle. Shows a skeleton
// while the chart chunk loads — the page's KPIs stay interactive meanwhile.
const DashboardQuarterChart = dynamic(
  () => import("@/components/dashboard/DashboardQuarterChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[150px] w-full animate-pulse rounded-md bg-gray-100" />
    ),
  },
);
import {
  Monitor, Building2, Wifi, Network, Shield,
  GraduationCap, TrendingUp, Key, AlertTriangle, Globe,
  Users, Activity, ArrowRight, MapPin, Calendar,
  Download, ChevronLeft, ChevronRight, Heart, FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, getStatusColor, numberWithCommas, getCompletionRate, calcTotal } from "@/lib/utils";
import { CURRENT_YEAR, DICT_PROJECTS } from "@/lib/types";
import { Id } from "@/convex/_generated/dataModel";
import { DashboardActivityStrip } from "@/components/dashboard/DashboardActivityStrip";
import { ProgramHealthBadge } from "@/components/program-health/ProgramHealthBadge";

const ICON_MAP: Record<string, React.ElementType> = {
  Monitor, Building2, Wifi, Network, Shield,
  GraduationCap, TrendingUp, Key, AlertTriangle, Globe,
};

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
  return `/logo/${LOGO_MAP[code.toUpperCase()] || "egov_ph_logo.png"}`;
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

  const yearLabel = selectedYear === "all" ? "All Years" : `FY ${selectedYear}`;
  const inProgressCount =
    (summary.byStatus.draft ?? 0) + (summary.byStatus.submitted ?? 0);
  const quarterTotal = quarterData.reduce((s, q) => s + q.count, 0);
  const currentMonth = new Date().getMonth() + 1;
  const activeQuarterIdx =
    selectedYear === "all" ? -1 : Math.min(3, Math.floor((currentMonth - 1) / 3));

  return (
    <div className="pms-dashboard page-content">
      {/* Live strip: pending imports + recent sync activity */}
      <DashboardActivityStrip />

      {/* Page header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-5 mt-3">
        <div>
          <h1 className="pms-page-title">Programs Overview</h1>
          <p className="pms-page-sub">
            Live snapshot of DICT Region V program activity across the six
            Bicol provinces — filtered by {yearLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/looker-export?year=${selectedYear === "all" ? CURRENT_YEAR : selectedYear}`}
            target="_blank" rel="noopener noreferrer"
          >
            <button className="pms-btn pms-btn-ghost">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </a>
          <button
            className="pms-btn pms-btn-primary"
            onClick={handleExportToSheets}
            disabled={isExporting}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {isExporting ? "Exporting…" : "Export to Sheets"}
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Activities · YTD"
          value={numberWithCommas(total)}
          deltaLabel={yearLabel}
          deltaKind="flat"
        />
        <StatTile
          label="Validated / Reported"
          value={numberWithCommas(completed)}
          deltaLabel={`${completionRate}%`}
          deltaKind={completionRate >= 70 ? "up" : completionRate >= 40 ? "flat" : "down"}
          spark="up"
        />
        <StatTile
          label="Total participants"
          value={numberWithCommas(summary.totalParticipants)}
          deltaLabel={`${numberWithCommas(summary.totalMale)}M / ${numberWithCommas(summary.totalFemale)}F`}
          deltaKind="flat"
        />
        <StatTile
          label="In progress"
          value={numberWithCommas(inProgressCount)}
          deltaLabel={`${summary.byStatus.draft ?? 0} draft · ${summary.byStatus.submitted ?? 0} submitted`}
          deltaKind="flat"
        />
      </div>

      {/* Quarters strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {quarterData.map((q, idx) => {
          const target = Math.max(1, Math.round(total / 4) || 12);
          const pct = Math.min(100, Math.round((q.count / target) * 100));
          let stateClass = "queued";
          let stateLabel = "Queued";
          if (idx < activeQuarterIdx) { stateClass = "done"; stateLabel = "Closed"; }
          else if (idx === activeQuarterIdx) { stateClass = "active"; stateLabel = "Active"; }
          return (
            <div key={q.quarter} className="pms-q">
              <div className="flex items-center justify-between">
                <span className="pms-q-label">{q.quarter} · {["Jan–Mar","Apr–Jun","Jul–Sep","Oct–Dec"][idx]}</span>
                <span className={`pms-q-state ${stateClass}`}>{stateLabel}</span>
              </div>
              <div className="pms-q-num">{q.count}</div>
              <div className="pms-q-bar">
                <div
                  className="pms-q-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: idx === activeQuarterIdx ? "var(--pms-accent)" : "var(--pms-ink)",
                  }}
                />
              </div>
              <div className="pms-q-foot">target {target} · {pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Main Layout: Carousel (Left) + Progress (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        {/* LEFT: Activity Carousel */}
        <div className="xl:col-span-2">
          <ActivityCarousel
            provinceId={selectedProvince === "all" ? undefined : selectedProvince}
            year={selectedYear === "all" ? undefined : selectedYear}
            month={selectedMonth === 0 ? undefined : selectedMonth}
            programCode={selectedProgram === "all" ? undefined : selectedProgram}
          />
        </div>

        {/* RIGHT: Completion summary */}
        <div className="space-y-3">
          <div className="pms-card">
            <div className="pms-card-head">
              <span className="pms-card-title">{yearLabel} Progress</span>
              <span className="pms-card-sub">{completed} of {total} validated</span>
              <div className="pms-card-tools">
                <span className="pms-pill">{completionRate}%</span>
              </div>
            </div>
            <div className="pms-card-body" style={{ paddingTop: 14 }}>
              <div
                className="pms-q-bar"
                style={{ height: 6, marginTop: 0, marginBottom: 14, background: "rgba(14,15,19,0.06)" }}
              >
                <div
                  className="pms-q-bar-fill"
                  style={{
                    width: `${completionRate}%`,
                    background:
                      completionRate >= 70 ? "var(--pms-ok)"
                      : completionRate >= 40 ? "var(--pms-warn)"
                      : "var(--pms-danger)",
                  }}
                />
              </div>
              <div className="space-y-2">
                {[
                  { label: "Draft",     count: summary.byStatus.draft     ?? 0, color: "rgba(14,15,19,0.35)" },
                  { label: "Submitted", count: summary.byStatus.submitted ?? 0, color: "var(--pms-warn)" },
                  { label: "Validated", count: summary.byStatus.validated ?? 0, color: "var(--pms-accent)" },
                  { label: "Reported",  count: summary.byStatus.reported  ?? 0, color: "var(--pms-ok)" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span style={{ color: "var(--pms-muted)" }}>{s.label}</span>
                    </div>
                    <span style={{ color: "var(--pms-ink)", fontWeight: 500 }}>
                      {numberWithCommas(s.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Programs grid + Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        {/* Programs — 2/3 width */}
        <div className="xl:col-span-2">
          <div className="pms-card">
            <div className="pms-card-head">
              <span className="pms-card-title">
                {selectedProgram === "all"
                  ? "By program"
                  : `${DICT_PROJECTS.find(p => p.code === selectedProgram)?.shortName || "Program"} overview`}
              </span>
              <span className="pms-card-sub">
                ranked by activity volume · {yearLabel}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
              {summary.summary
                .filter(proj => selectedProgram === "all" || proj.code === selectedProgram)
                .map((proj, idx) => {
                const def = DICT_PROJECTS.find(p => p.code === proj.code);
                const projCompleted = (proj.byStatus?.validated ?? 0) + (proj.byStatus?.reported ?? 0);
                const rate = getCompletionRate(projCompleted, proj.totalActivities);
                const isLead = idx === 0 && selectedProgram === "all";
                return (
                  <Link key={proj.code} href={`/projects/${proj.code.toLowerCase()}`}>
                    <div
                      className="flex items-start gap-3 p-4 rounded-[9px] cursor-pointer transition-all group"
                      style={isLead ? {
                        background: "linear-gradient(160deg, #0e0f13, #1a1b22)",
                        color: "#fff",
                        border: "1px solid transparent",
                      } : {
                        background: "#fff",
                        border: "1px solid var(--pms-line)",
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 overflow-hidden p-1"
                        style={isLead
                          ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }
                          : { background: "#fff", border: "1px solid var(--pms-line)" }}
                      >
                        {def?.code ? (
                          <Image
                            src={getProjectLogo(def.code)}
                            alt={def.shortName}
                            width={44}
                            height={44}
                            className="object-contain"
                            unoptimized
                          />
                        ) : (
                          <Activity style={{ width: 18, height: 18, color: proj.color }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className="text-[13px] font-semibold truncate"
                            style={{ color: isLead ? "#fff" : "var(--pms-ink)", letterSpacing: "-0.005em" }}
                          >
                            {proj.shortName}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <ProgramHealthBadge projectCode={proj.code} showLabel={false} />
                            <span
                              className="pms-mono"
                              style={{
                                fontSize: 10.5,
                                padding: "2px 6px",
                                borderRadius: 5,
                                background: isLead ? "rgba(255,255,255,0.12)" : "rgba(14,15,19,0.05)",
                                color: isLead ? "rgba(255,255,255,0.85)" : "var(--pms-muted)",
                              }}
                            >
                              #{idx + 1}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2.5">
                          <div
                            className="flex items-center justify-between"
                            style={{
                              fontSize: 11,
                              color: isLead ? "rgba(255,255,255,0.55)" : "var(--pms-muted)",
                              marginBottom: 6,
                            }}
                          >
                            <span>{numberWithCommas(proj.totalActivities)} activities · {projCompleted} validated</span>
                            <span style={{ fontWeight: 500 }}>{rate}%</span>
                          </div>
                          <div
                            className="rounded-full"
                            style={{
                              height: 4,
                              background: isLead ? "rgba(255,255,255,0.1)" : "rgba(14,15,19,0.05)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              className="rounded-full transition-all"
                              style={{
                                width: `${rate}%`,
                                height: "100%",
                                background: isLead ? "#fff" : "var(--pms-accent)",
                              }}
                            />
                          </div>
                        </div>
                        {proj.totalParticipants > 0 && (
                          <p
                            style={{
                              fontSize: 10.5,
                              marginTop: 6,
                              color: isLead ? "rgba(255,255,255,0.55)" : "var(--pms-faint)",
                              fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                            }}
                          >
                            {numberWithCommas(proj.totalParticipants)} participants
                          </p>
                        )}
                      </div>
                      <ArrowRight
                        className="w-4 h-4 shrink-0 mt-1 transition-colors"
                        style={{ color: isLead ? "rgba(255,255,255,0.45)" : "var(--pms-faint)" }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Charts — 1/3 width */}
        <div className="space-y-3">
          <div className="pms-card">
            <div className="pms-card-head">
              <span className="pms-card-title">Activities by quarter</span>
              <span className="pms-card-sub">{yearLabel}</span>
            </div>
            <div className="pms-card-body pt-2">
              <DashboardQuarterChart data={quarterData} />
            </div>
          </div>

          <div className="pms-card">
            <div className="pms-card-head">
              <span className="pms-card-title">Gender breakdown</span>
              <span className="pms-card-sub">{numberWithCommas(summary.totalParticipants)} total</span>
            </div>
            <div className="pms-card-body space-y-3">
              {[
                { label: "Male",   value: summary.totalMale,   pct: 100 - genderRate, color: "var(--pms-accent)" },
                { label: "Female", value: summary.totalFemale, pct: genderRate,        color: "var(--pms-warn)" },
              ].map(g => (
                <div key={g.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: "var(--pms-muted)" }}>{g.label}</span>
                    <span style={{ color: "var(--pms-ink)", fontWeight: 500 }}>
                      {numberWithCommas(g.value)} <span style={{ color: "var(--pms-faint)" }}>({g.pct}%)</span>
                    </span>
                  </div>
                  <div
                    className="rounded-full"
                    style={{ height: 5, background: "rgba(14,15,19,0.06)", overflow: "hidden" }}
                  >
                    <div
                      className="rounded-full"
                      style={{ width: `${g.pct}%`, height: "100%", background: g.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pms-card">
            <div className="pms-card-head">
              <span className="pms-card-title">Coverage</span>
            </div>
            <div className="pms-card-body space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--pms-muted)" }}>Active programs</span>
                <span style={{ color: "var(--pms-ink)", fontWeight: 500 }}>
                  {summary.summary.filter(s => s.totalActivities > 0).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--pms-muted)" }}>Total programs</span>
                <span style={{ color: "var(--pms-ink)", fontWeight: 500 }}>{summary.summary.length}</span>
              </div>
              <div
                className="flex items-center justify-between text-xs pt-2"
                style={{ borderTop: "1px solid var(--pms-line-2)" }}
              >
                <span style={{ color: "var(--pms-muted)" }}>Fiscal year</span>
                <span style={{ color: "var(--pms-ink)", fontWeight: 500 }}>{yearLabel}</span>
              </div>
              <Link href="/map" className="block pt-1">
                <button className="pms-btn pms-btn-soft w-full justify-center">
                  <MapPin className="w-3.5 h-3.5" /> Open Activity Map
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="pms-card">
        <div className="pms-card-head">
          <span className="pms-card-title">Recent activity</span>
          <span className="pms-card-sub">latest entries across all programs</span>
          <div className="pms-card-tools">
            <Link href="/activities">
              <button className="pms-btn pms-btn-soft" style={{ padding: "4px 10px", fontSize: 11.5 }}>
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
        <div className="pms-card-body pt-1">
          <RecentActivitiesList />
        </div>
      </div>
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
      <div className="text-center py-10" style={{ color: "var(--pms-faint)" }}>
        <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No activities yet.</p>
        <Link href="/activities/new" className="mt-3 inline-block">
          <button className="pms-btn pms-btn-ghost">Add First Activity</button>
        </Link>
      </div>
    );
  }
  return (
    <div>
      {activities.map((activity) => {
        const def = DICT_PROJECTS.find(p => p.code === (activity as any).projectCode);
        const total = calcTotal(activity.participants);
        return (
          <Link key={activity._id} href={`/activities/${activity._id}`}>
            <div className="pms-feed-row">
              <div
                className="pms-feed-icon"
                style={def?.code ? { background: "#fff", border: "1px solid var(--pms-line)", color: "var(--pms-ink)" } : undefined}
              >
                {def?.code ? (
                  <Image
                    src={getProjectLogo(def.code)}
                    alt={def.shortName}
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <Activity style={{ width: 14, height: 14 }} />
                )}
              </div>
              <div className="pms-feed-text">
                <strong>{activity.activityTitle}</strong>
                <div className="pms-feed-meta flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{activity.venue}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(activity.startDate, "MMM d")}</span>
                  {total > 0 && <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{numberWithCommas(total)}</span>}
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

function StatTile({
  label,
  value,
  deltaLabel,
  deltaKind = "flat",
  spark,
}: {
  label: string;
  value: string;
  deltaLabel?: string;
  deltaKind?: "up" | "down" | "flat";
  spark?: "up" | "flat";
}) {
  const deltaCls =
    deltaKind === "up" ? "pms-delta-up"
    : deltaKind === "down" ? "pms-delta-down"
    : "pms-delta-flat";
  return (
    <div className="pms-stat">
      <div className="pms-stat-label">{label}</div>
      <div className="pms-stat-row">
        <div className="pms-stat-num">{value}</div>
        {deltaLabel && <span className={`pms-stat-delta ${deltaCls}`}>{deltaLabel}</span>}
      </div>
      {spark === "up" ? (
        <svg className="pms-spark" viewBox="0 0 200 24" preserveAspectRatio="none">
          <path
            d="M0,18 L25,14 L50,16 L75,10 L100,11 L125,7 L150,9 L175,5 L200,8"
            stroke="oklch(0.58 0.15 155)" strokeWidth="1.5" fill="none" strokeLinecap="round"
          />
          <path
            d="M0,18 L25,14 L50,16 L75,10 L100,11 L125,7 L150,9 L175,5 L200,8 L200,24 L0,24 Z"
            fill="oklch(0.58 0.15 155 / 0.08)"
          />
        </svg>
      ) : (
        <svg className="pms-spark" viewBox="0 0 200 24" preserveAspectRatio="none">
          <path
            d="M0,18 L20,14 L40,16 L60,10 L80,12 L100,8 L120,6 L140,9 L160,11 L180,7 L200,12"
            stroke="rgba(14,15,19,0.18)" strokeWidth="1.5" fill="none" strokeLinecap="round"
          />
        </svg>
      )}
    </div>
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
