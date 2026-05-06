"use client";

import { usePathname, useRouter } from "next/navigation";
import { Search, Filter, LogOut, User, Menu } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CURRENT_YEAR, DICT_PROJECTS } from "@/lib/types";
import { useDashboardFilters } from "./DashboardFilterContext";
import { useSidebar } from "./SidebarContext";
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
  const { setMobileOpen } = useSidebar();
  
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
    router.push("/login");
  }
  
  const provinces = useQuery(api.provinces.list);
  
  // Use context for dashboard filters
  const filters = isDashboard ? useDashboardFilters() : null;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      {/* Main row */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-900 leading-tight">{title}</h1>
            <p className="text-[11px] text-gray-500 hidden sm:block">DICT Region V – Bicol Region</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isDashboard && (
            <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 min-w-[200px]">
              <Search className="w-4 h-4 shrink-0" />
              <span>Search activities…</span>
            </div>
          )}

          <NotificationBell />

          {/* User menu */}
          {user && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user.fullName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{user.fullName}</p>
                  <p className="text-[10px] text-gray-400 leading-tight capitalize">{user.role}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}
                className="h-8 px-2 text-gray-500 hover:text-red-600 hover:bg-red-50" title="Logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard filters — horizontal scroll on mobile */}
      {isDashboard && provinces && filters && (
        <div className="flex items-center gap-2 px-4 md:px-6 pb-3 overflow-x-auto scrollbar-none">
          <Select value={filters.selectedProvince} onValueChange={(v) => filters.setSelectedProvince(v as any)}>
            <SelectTrigger className="w-[140px] md:w-[160px] h-8 text-xs shrink-0">
              <Filter className="w-3 h-3 mr-1.5" />
              <SelectValue placeholder="Province" />
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
            <SelectTrigger className="w-[90px] h-8 text-xs shrink-0">
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
            <SelectTrigger className="w-[110px] h-8 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.selectedProgram} onValueChange={filters.setSelectedProgram}>
            <SelectTrigger className="w-[130px] md:w-[150px] h-8 text-xs shrink-0">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {DICT_PROJECTS.map((p) => (
                <SelectItem key={p.code} value={p.code}>{p.shortName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </header>
  );
}
