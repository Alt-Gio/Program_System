"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import Image from "next/image";
import { Monitor, Building2, Wifi, Network, Shield, GraduationCap, TrendingUp, Key, AlertTriangle, Globe, Plus, Search, Filter, Users, MapPin, Calendar, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, getStatusColor, numberWithCommas, calcTotal } from "@/lib/utils";
import { DICT_PROJECTS, CURRENT_YEAR, MONTHS, STATUS_OPTIONS } from "@/lib/types";

const ICON_MAP: Record<string, React.ElementType> = { Monitor, Building2, Wifi, Network, Shield, GraduationCap, TrendingUp, Key, AlertTriangle, Globe };

export default function ActivitiesPage() {
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(String(CURRENT_YEAR));

  const projects = useQuery(api.projects.list, { isActive: true });
  const provinces = useQuery(api.provinces.list, {});
  const activities = useQuery(api.activities.listActivities, {
    year: Number(filterYear),
    month: filterMonth !== "all" ? Number(filterMonth) : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
  });
  const allHighlightConfigs = useQuery(api.highlightFields.getAllHighlightFields, {});

  const filtered = activities?.filter(a => {
    if (filterProject !== "all") {
      const proj = projects?.find(p => p._id === a.projectId);
      if (proj?.code !== filterProject) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return a.activityTitle.toLowerCase().includes(q) || a.venue.toLowerCase().includes(q) ||
        (a.personnelRaw ?? "").toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  const provinceMap = Object.fromEntries((provinces ?? []).map(p => [p._id, p.name]));
  const projectMap = Object.fromEntries((projects ?? []).map(p => [p._id, p]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">{filtered.length} activit{filtered.length === 1 ? "y" : "ies"} found</p>
        <Link href="/activities/new">
          <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />New Activity</Button>
        </Link>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search activities�" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {DICT_PROJECTS.map(p => <SelectItem key={p.code} value={p.code}>{p.shortName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="All Months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024,2025,2026].map(y => <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {!activities ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Filter className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 mb-4">No activities match your filters.</p>
          <Link href="/activities/new"><Button size="sm" variant="outline" className="gap-1.5"><Plus className="w-4 h-4" />Add Activity</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(activity => {
            const proj = projectMap[activity.projectId];
            const def = DICT_PROJECTS.find(p => p.code === proj?.code);
            const Icon = ICON_MAP[def?.icon ?? "Globe"] ?? Globe;
            const total = calcTotal(activity.participants);
            const provinceName = provinceMap[activity.provinceId] ?? "�";
            const firstImage = activity.images?.[0];
            const projectLogo = def?.code ? `/logo/${def.code.toLowerCase() === 'egov' ? 'egov_ph' : def.code.toLowerCase() === 'wifi' ? 'freewifi' : def.code.toLowerCase() === 'cyber' ? 'cybersecurity' : def.code.toLowerCase() === 'ilcdb' || def.code.toLowerCase() === 'iidb' ? 'iidb' : def.code.toLowerCase()}_logo.png` : null;
            return (
              <Link key={activity._id} href={`/activities/${activity._id}`}>
                <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all cursor-pointer group">
                  {/* Thumbnail Image */}
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-200">
                    {firstImage ? (
                      <Image
                        src={firstImage.url}
                        alt={activity.activityTitle}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Program Logo Badge */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2" style={{ backgroundColor: `${def?.color ?? "#6b7280"}10`, borderColor: `${def?.color ?? "#6b7280"}30` }}>
                    {projectLogo ? (
                      <Image src={projectLogo} alt={def?.shortName || ''} width={32} height={32} className="object-contain" />
                    ) : (
                      <Icon className="w-6 h-6" style={{ color: def?.color ?? "#6b7280" }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">{activity.activityTitle}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{def?.shortName ?? proj?.shortName ?? "�"}</p>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0 border whitespace-nowrap", getStatusColor(activity.status))}>{activity.status}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{provinceName}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(activity.startDate, "MMM d, yyyy")}</span>
                      {total > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{numberWithCommas(total)} pax</span>}
                      <span className="text-gray-400">{activity.modeOfConduct}</span>
                      {activity.images && activity.images.length > 0 && (
                        <span className="flex items-center gap-1 text-blue-600 font-medium">
                          <ImageIcon className="w-3 h-3" />
                          {activity.images.length} photo{activity.images.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* Highlight Fields */}
                    {(() => {
                      // Get highlight fields from database config or fallback to hardcoded
                      const dbConfig = allHighlightConfigs?.find(c => c.projectCode === def?.code);
                      const highlightFields = dbConfig?.fields.filter(f => f.enabled).slice(0, 2) || def?.highlightFields?.slice(0, 2) || [];
                      
                      if (highlightFields.length === 0) return null;
                      
                      return (
                        <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                          {highlightFields.map((field: any) => {
                            let value: any = null;
                            if (field.source === 'computed' && field.key === 'participants') {
                              value = total;
                            } else if (field.source === 'extraFields' && activity.extraFields) {
                              try {
                                const parsed = JSON.parse(activity.extraFields);
                                value = parsed[field.key];
                              } catch (e) {}
                            } else if (field.source === 'activity') {
                              value = (activity as any)[field.key];
                            }
                            if (!value && value !== 0) return null;
                            return (
                              <span key={field.key} className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md" style={{ backgroundColor: `${def.color}10`, color: def.color }}>
                                <span className="opacity-70">{field.label}:</span>
                                <span className="font-semibold">{field.format === 'number' ? numberWithCommas(value) : value}</span>
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
