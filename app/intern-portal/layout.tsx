"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarCheck, CheckSquare,
  FolderOpen, BarChart2, ArrowLeft, GraduationCap, ShieldCheck, KeyRound, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/intern-portal",             icon: LayoutDashboard, label: "Overview",     exact: true, section: null },
  { href: "/intern-portal/list",        icon: Users,           label: "All Interns",  exact: false, section: "INTERNS" },
  { href: "/intern-portal/attendance",  icon: CalendarCheck,   label: "Attendance",   exact: false, section: null },
  { href: "/intern-portal/tasks",       icon: CheckSquare,     label: "Tasks",        exact: false, section: null },
  { href: "/intern-portal/documents",   icon: FolderOpen,      label: "Documents",    exact: false, section: null },
  { href: "/intern-portal/reports",     icon: BarChart2,       label: "Reports",      exact: false, section: null },
  { href: "/intern-portal/supervisors", icon: ShieldCheck,     label: "Supervisors",  exact: false, section: "MANAGE" },
  { href: "/intern-portal/intern-accounts",  icon: KeyRound,    label: "Intern Accts", exact: false, section: null },
  { href: "/intern-portal/intern-overview",  icon: TrendingUp,  label: "Engagement",   exact: false, section: null },
];

export default function InternPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Sidebar ── */}
      <aside className="w-[58px] md:w-52 bg-[#0d1b2a] flex flex-col shrink-0 z-40">
        <div className="h-16 flex items-center gap-3 px-3 md:px-4 border-b border-white/[0.07] shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="hidden md:block min-w-0">
            <p className="text-white text-[11px] font-extrabold tracking-widest leading-tight">DTC REGION V</p>
            <p className="text-white/40 text-[9px] tracking-widest leading-tight">INTERNSHIP PORTAL</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label, exact, section }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <div key={href}>
                {section && (
                  <p className="hidden md:block text-[9px] font-bold text-white/20 uppercase tracking-widest px-2 pt-3 pb-1.5">
                    {section}
                  </p>
                )}
                <Link href={href} title={label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl h-10 md:h-9 transition-all",
                    "justify-center md:justify-start px-0 md:px-3 text-xs font-medium",
                    active
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                      : "text-white/45 hover:text-white hover:bg-white/[0.07]"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:block">{label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-white/[0.07] shrink-0">
          <Link href="/dashboard" title="Admin Dashboard"
            className="flex items-center justify-center md:justify-start gap-3 h-9 px-0 md:px-3 rounded-xl text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden md:block">Admin Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* ── Right side ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-16 bg-[#0d1b2a] flex items-center justify-between px-4 md:px-6 shrink-0 border-b border-white/[0.07]">
          <div>
            <p className="text-white text-sm font-bold leading-tight">DTC Region V · Intern Management</p>
            <p className="text-white/40 text-[11px] leading-tight">Digital Transformation Center — Internship Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard"
              className="hidden md:flex items-center gap-1.5 text-[11px] font-medium text-white/50 hover:text-white bg-white/[0.06] hover:bg-white/[0.10] px-3 py-1.5 rounded-lg transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />Admin Dashboard
            </Link>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow">A</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
