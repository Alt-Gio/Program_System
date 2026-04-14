"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Filter, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CURRENT_YEAR, DICT_PROJECTS } from "@/lib/types";
import { useDashboardFilters } from "./DashboardFilterContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
  const router = useRouter();
  const title = getPageTitle(pathname);
  const isDashboard = pathname === "/dashboard";
  
  const [user, setUser] = useState<any>(null);
  const logout = useMutation(api.auth.logout);
  
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);
  
  async function handleLogout() {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        await logout({ token });
      } catch (e) {
        console.error("Logout error:", e);
      }
    }
    
    // Clear local storage and cookies
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    document.cookie = "auth_token=; path=/; max-age=0";
    
    toast.success("Logged out successfully");
    router.push("/signin");
  }
  
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
        
        {/* User Menu */}
        {user && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                {user.fullName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{user.fullName}</p>
                <p className="text-[10px] text-gray-400 leading-tight capitalize">{user.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 px-2 text-gray-500 hover:text-red-600 hover:bg-red-50"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
