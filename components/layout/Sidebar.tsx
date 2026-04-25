"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Map,
  FileText,
  ChevronDown,
  ChevronRight,
  Settings,
  Users,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useSidebar } from "./SidebarContext";

const projectLogos: Record<string, string> = {
  EGOVPH: "/logo/egov_ph_logo.png",
  ELGU: "/logo/elgu_logo.png",
  FREEWIFI: "/logo/freewifi_logo.png",
  GOVNET: "/logo/govnet_logo.png",
  CYBER: "/logo/cybersecurity_logo.png",
  ILCDB: "/logo/iidb_logo.png",
  IIDB: "/logo/iidb_logo.png",
  PNPKI: "/logo/pnpki_logo.png",
  DRRM: "/logo/drrm_logo.png",
  NBP: "/logo/nbp_logo.png",
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activities", label: "Activities", icon: ListChecks },
  { href: "/map", label: "Map View", icon: Map },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/import-log", label: "Import & Log", icon: Download },
];

const projects = [
  { code: "EGOVPH", name: "eGovPH", color: "bg-blue-50 border-blue-200", route: "egov" },
  { code: "ELGU", name: "eLGU", color: "bg-cyan-50 border-cyan-200", route: "elgu" },
  { code: "FREEWIFI", name: "Free WiFi", color: "bg-green-50 border-green-200", route: "wifi" },
  { code: "GOVNET", name: "GovNet", color: "bg-violet-50 border-violet-200", route: "govnet" },
  { code: "CYBER", name: "Cybersecurity", color: "bg-red-50 border-red-200", route: "cyber" },
  { code: "ILCDB", name: "iLCDB", color: "bg-amber-50 border-amber-200", route: "ilcdb" },
  { code: "IIDB", name: "IIDB", color: "bg-teal-50 border-teal-200", route: "iidb" },
  { code: "PNPKI", name: "PNPKI", color: "bg-purple-50 border-purple-200", route: "pnpki" },
  { code: "DRRM", name: "DRRM", color: "bg-orange-50 border-orange-200", route: "drrm" },
  { code: "NBP", name: "NBP", color: "bg-sky-50 border-sky-200", route: "nbp" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  // Prefetch project routes on hover — 10 programs is too many to
  // prefetch upfront, but warming the cache when the user hovers is free.
  const prefetchProject = (route: string) =>
    router.prefetch(`/projects/${route}`);

  function closeMobile() { setMobileOpen(false); }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
        />
      )}

    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen flex-col bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 flex overflow-hidden transition-all duration-300",
      // Desktop: collapsed vs full
      "md:translate-x-0",
      collapsed ? "md:w-20" : "md:w-64",
      // Mobile: drawer width matches desktop expanded width (256px)
      "w-64",
      mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      {/* Header */}
      <div className="dict-gradient p-5 shrink-0 relative">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <Image src="/logo/egov_ph_logo.png" alt="DICT" width={40} height={40} className="object-contain" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              D5
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Image src="/logo/egov_ph_logo.png" alt="DICT" width={40} height={40} className="object-contain" />
              </div>
              <div>
                <p className="text-white font-bold text-base leading-tight">DICT Region V</p>
                <p className="text-blue-100 text-xs">Bicol</p>
              </div>
            </div>
            <p className="text-blue-200 text-xs font-medium">Program Management System</p>
          </>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5 text-gray-600" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5 text-gray-600" />
          )}
        </button>
        {/* Mobile close button */}
        <button
          onClick={closeMobile}
          className="md:hidden absolute right-3 top-3 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-5 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={cn(
                "flex items-center rounded-xl text-sm font-medium transition-all",
                collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3",
                active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}

        {/* Projects Section */}
        {collapsed ? (
          <div className="pt-6 border-t border-gray-200 mt-6">
            <div className="space-y-2 px-2">
              {projects.map((project) => {
                const logoSrc = projectLogos[project.code];
                const href = `/projects/${project.route}`;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={project.code}
                    href={href}
                    onMouseEnter={() => prefetchProject(project.route)}
                    onFocus={() => prefetchProject(project.route)}
                    onClick={closeMobile}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-lg transition-all border",
                      active
                        ? "bg-white shadow-md border-blue-200"
                        : "border-transparent hover:bg-white hover:shadow-sm hover:border-gray-200"
                    )}
                    title={project.name}
                  >
                    <Image
                      src={logoSrc}
                      alt={project.name}
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="pt-6">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span>Programs</span>
              {projectsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

          {projectsExpanded && (
            <div className="mt-2 space-y-1">
              {projects.map((project) => {
                const logoSrc = projectLogos[project.code];
                const href = `/projects/${project.route}`;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={project.code}
                    href={href}
                    onMouseEnter={() => prefetchProject(project.route)}
                    onFocus={() => prefetchProject(project.route)}
                    onClick={closeMobile}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border",
                      active
                        ? "bg-white shadow-md border-blue-200 text-blue-700 font-semibold"
                        : "text-gray-700 hover:bg-white hover:shadow-sm border-transparent hover:border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                      active ? project.color : "bg-gray-50 border-gray-200"
                    )}>
                      <Image
                        src={logoSrc}
                        alt={project.name}
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    </div>
                    <span className="truncate">{project.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Admin */}
        <div className="pt-6 border-t border-gray-200 mt-6 space-y-1">
          <Link
            href="/personnel"
            onClick={closeMobile}
            className={cn(
              "flex items-center rounded-xl text-sm font-medium transition-all",
              collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3",
              pathname.startsWith("/personnel")
                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                : "text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900"
            )}
            title={collapsed ? "Personnel" : undefined}
          >
            <Users className="w-4 h-4 shrink-0" />
            {!collapsed && "Personnel"}
          </Link>
          <Link
            href="/intern-portal"
            onClick={closeMobile}
            className={cn(
              "flex items-center rounded-xl text-sm font-medium transition-all",
              collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3",
              pathname.startsWith("/intern-portal")
                ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                : "text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900"
            )}
            title={collapsed ? "Interns" : undefined}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            {!collapsed && "Interns"}
          </Link>
          <Link
            href="/settings"
            onClick={closeMobile}
            className={cn(
              "flex items-center rounded-xl text-sm font-medium transition-all",
              collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3",
              pathname.startsWith("/settings")
                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                : "text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900"
            )}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && "Settings"}
          </Link>
          <Link
            href="/shortcuts"
            onClick={closeMobile}
            className={cn(
              "flex items-center rounded-xl text-sm font-medium transition-all",
              collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3",
              pathname.startsWith("/shortcuts")
                ? "bg-gray-800 text-white shadow-md"
                : "text-gray-500 hover:bg-white hover:shadow-sm hover:text-gray-900"
            )}
            title={collapsed ? "Keyboard Shortcuts" : undefined}
          >
            <Keyboard className="w-4 h-4 shrink-0" />
            {!collapsed && "Shortcuts"}
          </Link>
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 shrink-0 bg-white">
          <div className="flex items-center gap-3 px-3 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
              D5
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">DICT Region V</p>
              <p className="text-xs text-gray-600 truncate">Legazpi City, Bicol</p>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
