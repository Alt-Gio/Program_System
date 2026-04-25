"use client";

import { useState, useMemo, useEffect } from "react";
import { onVoiceEvent } from "@/lib/voice/voiceEvents";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import Image from "next/image";
import { Monitor, Building2, Wifi, Network, Shield, GraduationCap, TrendingUp, Key, AlertTriangle, Globe, Plus, Search, Users, MapPin, Calendar, ImageIcon, LayoutList, LayoutGrid, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, getStatusColor, numberWithCommas, calcTotal } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR, MONTHS, STATUS_OPTIONS } from "@/lib/types";

const ICON_MAP: Record<string, React.ElementType> = { Monitor, Building2, Wifi, Network, Shield, GraduationCap, TrendingUp, Key, AlertTriangle, Globe };
const STATUS_TABS = ["All", ...STATUS_OPTIONS];

function getProjectLogo(code?: string): string | null {
  if (!code) return null;
  const map: Record<string, string> = { egov: "egov_ph", wifi: "freewifi", cyber: "cybersecurity", ilcdb: "iidb", iidb: "iidb" };
  return `/logo/${(map[code.toLowerCase()] ?? code.toLowerCase())}_logo.png`;
}

export default function ActivitiesPage() {
  const [search, setSearch]               = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus]   = useState<string>("All");
  const [filterMonth, setFilterMonth]     = useState<string>("all");
  const [filterYear, setFilterYear]       = useState<string>(String(CURRENT_YEAR));
  const [view, setView]                   = useState<"list" | "grid">("list");

  // Voice command bridge — search/filter/openItem events from VoiceOrb
  useEffect(() => {
    const offs = [
      onVoiceEvent("voice:search", ({ query }) => setSearch(query)),
      onVoiceEvent("voice:filter", ({ field, value }) => {
        if (field === "program" || field === "project") setFilterProject(value);
        else if (field === "status") setFilterStatus(value);
        else if (field === "month") setFilterMonth(value);
        else if (field === "year") setFilterYear(value);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const projects            = useQuery(api.projects.list, { isActive: true });
  const provinces           = useQuery(api.provinces.list, {});
  const activities          = useQuery(api.activities.listActivities, {
    year:   Number(filterYear),
    month:  filterMonth !== "all" ? Number(filterMonth) : undefined,
    status: filterStatus !== "All" ? filterStatus : undefined,
  });
  const allHighlightConfigs = useQuery(api.highlightFields.getAllHighlightFields, {});

  const provinceMap = useMemo(() => Object.fromEntries((provinces ?? []).map(p => [p._id, p.name])), [provinces]);
  const projectMap  = useMemo(() => Object.fromEntries((projects  ?? []).map(p => [p._id, p])), [projects]);

  const filtered = useMemo(() => (activities?.filter(a => {
    if (filterProject !== "all") {
      const proj = projects?.find(p => p._id === a.projectId);
      if (proj?.code !== filterProject) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return a.activityTitle.toLowerCase().includes(q) ||
             a.venue.toLowerCase().includes(q) ||
             (a.personnelRaw ?? "").toLowerCase().includes(q);
    }
    return true;
  }) ?? []), [activities, filterProject, search, projects]);

  // Group by "Month Year"
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const key = `${MONTHS[a.month - 1]} ${a.year}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const [am, ay] = [MONTHS.indexOf(a[0].split(" ")[0]) + 1, Number(a[0].split(" ")[1])];
      const [bm, by] = [MONTHS.indexOf(b[0].split(" ")[0]) + 1, Number(b[0].split(" ")[1])];
      return by !== ay ? by - ay : bm - am;
    });
  }, [filtered]);

  // Status counts for tab badges (from all activities in year, not filtered)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUS_OPTIONS) counts[s] = (activities ?? []).filter(a => a.status === s).length;
    return counts;
  }, [activities]);

  const totalPax = useMemo(() => filtered.reduce((s, a) => s + calcTotal(a.participants), 0), [filtered]);

  return (
    <div className="space-y-4">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-gray-800">{filtered.length} activit{filtered.length === 1 ? "y" : "ies"}</p>
          {totalPax > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Users className="w-3 h-3" />{numberWithCommas(totalPax)} participants
            </span>
          )}
        </div>
        <Link href="/activities/new">
          <Button size="sm" className="gap-1.5 h-8 text-xs font-medium">
            <Plus className="w-3.5 h-3.5" />New Activity
          </Button>
        </Link>
      </div>

      {/* ── Filter panel ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 space-y-3 shadow-sm">

        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                filterStatus === s
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              {s}
              {s !== "All" && statusCounts[s] > 0 && (
                <span className={cn("ml-1.5 tabular-nums", filterStatus === s ? "opacity-60" : "text-gray-400")}>
                  {statusCounts[s]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + dropdowns row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search activities…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-gray-50 border-gray-200"
            />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="All Programs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {DICT_PROJECTS.map(p => <SelectItem key={p.code} value={p.code}>{p.shortName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="All Months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[90px] h-8 text-xs bg-gray-50 border-gray-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024,2025,2026].map(y => <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-auto">
            <button onClick={() => setView("list")} className={cn("p-1.5 transition-colors", view === "list" ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-50")}>
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView("grid")} className={cn("p-1.5 transition-colors", view === "grid" ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-50")}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {!activities ? (
        <div className="space-y-2">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <p className="text-sm text-gray-400 mb-4">No activities found</p>
          <Link href="/activities/new">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />Add Activity
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([monthLabel, items]) => (
            <div key={monthLabel}>

              {/* Month divider */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{monthLabel}</span>
                <div className="flex-1 h-px bg-gray-100" />
                {/* Program color dots for this month */}
                <div className="flex items-center gap-1">
                  {Array.from(new Set(
                    items.map(a => {
                      const p = projectMap[a.projectId];
                      return DICT_PROJECTS.find(d => d.code === p?.code);
                    }).filter(Boolean).map(d => d!.code)
                  )).map(code => {
                    const d = DICT_PROJECTS.find(x => x.code === code);
                    return (
                      <span key={code} title={d?.shortName} className="w-2 h-2 rounded-full" style={{ backgroundColor: d?.color ?? "#9ca3af" }} />
                    );
                  })}
                </div>
                <span className="text-[11px] text-gray-300 tabular-nums">{items.length}</span>
              </div>

              {/* List view */}
              {view === "list" ? (
                <div className="space-y-1">
                  {items.map(activity => {
                    const proj  = projectMap[activity.projectId];
                    const def   = DICT_PROJECTS.find(p => p.code === proj?.code);
                    const Icon  = ICON_MAP[def?.icon ?? "Globe"] ?? Globe;
                    const total = calcTotal(activity.participants);
                    const provinceName  = provinceMap[activity.provinceId] ?? "—";
                    const projectLogo   = getProjectLogo(def?.code);
                    const dbConfig      = allHighlightConfigs?.find(c => c.projectCode === def?.code);
                    const highlightFields = (dbConfig?.fields.filter(f => f.enabled).slice(0, 2) ?? def?.highlightFields?.slice(0, 2) ?? []) as any[];

                    return (
                      <Link key={activity._id} href={`/activities/${activity._id}`}>
                        <div
                          className="group flex items-center gap-3 pr-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all overflow-hidden"
                          style={{ borderLeftColor: def?.color ?? "#6b7280", borderLeftWidth: 3 }}
                        >
                          {/* Program icon */}
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ml-3" style={{ backgroundColor: `${def?.color ?? "#6b7280"}20` }}>
                            {projectLogo ? (
                              <Image src={projectLogo} alt={def?.shortName ?? ""} width={20} height={20} className="object-contain" />
                            ) : (
                              <Icon className="w-4 h-4" style={{ color: def?.color ?? "#6b7280" }} />
                            )}
                          </div>

                          {/* Title + meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors leading-tight">
                                {activity.activityTitle}
                              </p>
                              <span
                                className="hidden sm:inline-flex shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${def?.color ?? "#6b7280"}18`, color: def?.color ?? "#6b7280" }}
                              >
                                {def?.shortName ?? proj?.code ?? ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{provinceName}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(activity.startDate, "MMM d")}</span>
                              {total > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{numberWithCommas(total)} pax</span>}
                              <span className="hidden md:block">{activity.modeOfConduct}</span>
                              {activity.images && activity.images.length > 0 && (
                                <span className="flex items-center gap-1 text-blue-500">
                                  <ImageIcon className="w-3 h-3" />{activity.images.length}
                                </span>
                              )}
                            </div>
                            {/* Highlight fields inline */}
                            {highlightFields.length > 0 && (() => {
                              const chips = highlightFields.map((field: any) => {
                                let value: any = null;
                                if (field.source === "computed" && field.key === "participants") value = total;
                                else if (field.source === "extraFields" && activity.extraFields) {
                                  try { value = JSON.parse(activity.extraFields)[field.key]; } catch {}
                                } else if (field.source === "activity") value = (activity as any)[field.key];
                                if (!value && value !== 0) return null;
                                return (
                                  <span key={field.key} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${def?.color}15`, color: def?.color }}>
                                    {field.label}: {field.format === "number" ? numberWithCommas(value) : value}
                                  </span>
                                );
                              }).filter(Boolean);
                              return chips.length > 0 ? <div className="flex gap-1.5 mt-1">{chips}</div> : null;
                            })()}
                          </div>

                          {/* Status + chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap", getStatusColor(activity.status))}>
                              {activity.status}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                /* Grid view */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(activity => {
                    const proj  = projectMap[activity.projectId];
                    const def   = DICT_PROJECTS.find(p => p.code === proj?.code);
                    const Icon  = ICON_MAP[def?.icon ?? "Globe"] ?? Globe;
                    const total = calcTotal(activity.participants);
                    const provinceName = provinceMap[activity.provinceId] ?? "—";
                    const firstImage   = activity.images?.[0];
                    const projectLogo  = getProjectLogo(def?.code);

                    return (
                      <Link key={activity._id} href={`/activities/${activity._id}`}>
                        <div className="group bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all overflow-hidden h-full flex flex-col">
                          {/* Gradient header area */}
                          <div
                            className="relative shrink-0 p-3"
                            style={{ background: `linear-gradient(135deg, ${def?.color ?? "#6b7280"}25 0%, ${def?.color ?? "#6b7280"}08 100%)` }}
                          >
                            {/* Thumbnail if available */}
                            {firstImage ? (
                              <div className="relative w-full h-24 rounded-lg overflow-hidden mb-2.5">
                                <Image src={firstImage.url} alt={activity.activityTitle} fill className="object-cover group-hover:scale-105 transition-transform" unoptimized />
                                <div className="absolute inset-0 rounded-lg" style={{ background: `linear-gradient(to top, ${def?.color ?? "#000"}55 0%, transparent 55%)` }} />
                              </div>
                            ) : (
                              <div className="w-full h-16 rounded-lg mb-2.5 flex items-center justify-center" style={{ backgroundColor: `${def?.color ?? "#6b7280"}12` }}>
                                <Icon className="w-7 h-7 opacity-20" style={{ color: def?.color ?? "#6b7280" }} />
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${def?.color ?? "#6b7280"}25` }}>
                                  {projectLogo
                                    ? <Image src={projectLogo} alt="" width={14} height={14} className="object-contain" />
                                    : <Icon className="w-3 h-3" style={{ color: def?.color ?? "#6b7280" }} />}
                                </div>
                                <span className="text-[11px] font-bold" style={{ color: def?.color ?? "#6b7280" }}>
                                  {def?.shortName ?? proj?.code ?? ""}
                                </span>
                              </div>
                              <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap", getStatusColor(activity.status))}>{activity.status}</span>
                            </div>
                          </div>
                          {/* Program color bottom strip */}
                          <div className="h-0.5 w-full shrink-0" style={{ backgroundColor: def?.color ?? "#6b7280" }} />
                          {/* Body */}
                          <div className="p-3 flex flex-col flex-1 gap-2">
                            <p className="text-sm font-medium text-gray-900 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2 flex-1">
                              {activity.activityTitle}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{provinceName}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(activity.startDate, "MMM d")}</span>
                              {total > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{numberWithCommas(total)} pax</span>}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
