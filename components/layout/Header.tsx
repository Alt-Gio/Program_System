"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CURRENT_YEAR, DICT_PROJECTS } from "@/lib/types";
import { useDashboardFilters } from "./DashboardFilterContext";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/activities": "Activities",
  "/map": "Map View",
  "/reports": "Reports",
  "/personnel": "Personnel",
  "/settings": "Settings",
};

const MONTHS = [
  { value: 0, label: "All Months" },
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/projects/")) {
    const code = pathname.split("/")[2]?.toUpperCase();
    const labels: Record<string, string> = {
      EGOVPH: "eGovPH", ELGU: "eLGU", FREEWIFI: "Free WiFi",
      GOVNET: "GovNet", CYBER: "Cybersecurity", ILCDB: "iLCDB",
      IIDB: "IIDB", PNPKI: "PNPKI", DRRM: "DRRM", NBP: "NBP",
    };
    return labels[code] ?? "Project";
  }
  if (pathname.startsWith("/activities/new")) return "New Activity";
  if (pathname.startsWith("/activities/")) return "Activity Details";
  return routeLabels[pathname] ?? "DICT Region V";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const isDashboard = pathname === "/dashboard";
  
  const provinces = useQuery(api.provinces.list);
  
  // Use context for dashboard filters
  const filters = isDashboard ? useDashboardFilters() : null;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500">DICT Region V – Bicol Region</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isDashboard && provinces && filters && (
          <>
            <Select value={filters.selectedProvince} onValueChange={(v) => filters.setSelectedProvince(v as any)}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <Filter className="w-3.5 h-3.5 mr-2" />
                <SelectValue placeholder="All Provinces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Provinces</SelectItem>
                {provinces.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={filters.selectedYear.toString()} 
              onValueChange={(v) => filters.setSelectedYear(v === "all" ? "all" : parseInt(v))}
            >
              <SelectTrigger className="w-[110px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.selectedMonth.toString()} onValueChange={(v) => filters.setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.selectedProgram} onValueChange={filters.setSelectedProgram}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {DICT_PROJECTS.map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.shortName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        
        {!isDashboard && (
          <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 min-w-[220px]">
            <Search className="w-4 h-4 shrink-0" />
            <span>Search activities…</span>
          </div>
        )}

        <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
