"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { LayoutDashboard, Flame, BookOpen, QrCode, LogOut, MessageSquare, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

const PUBLIC_PATHS = ["/intern/login", "/intern/register"];

const NAV = [
  { href: "/intern/dashboard",  icon: LayoutDashboard, label: "Home"     },
  { href: "/intern/tasks",      icon: ListTodo,        label: "Tasks"    },
  { href: "/intern/habits",     icon: Flame,           label: "Habits"   },
  { href: "/intern/journal",    icon: BookOpen,        label: "Journal"  },
  { href: "/intern/messages",   icon: MessageSquare,   label: "Messages" },
  { href: "/intern/qr",         icon: QrCode,          label: "QR"       },
];

export default function InternLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const [ready, setReady] = useState(false);
  const [internToken, setInternToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isPublic) setInternToken(localStorage.getItem("intern_token"));
  }, [isPublic]);

  const allMessages = useQuery(
    api.supervisorTools.getInternMessages,
    internToken && !isPublic ? { internToken } : "skip"
  );
  const unreadCount = allMessages?.filter((m: any) => m.senderType === "supervisor" && !m.readAt).length ?? 0;

  useEffect(() => {
    if (isPublic) { setReady(true); return; }
    const token = localStorage.getItem("intern_token");
    if (!token) { router.replace("/intern/login"); return; }
    setReady(true);
  }, [isPublic, router]);

  function handleLogout() {
    localStorage.removeItem("intern_token");
    localStorage.removeItem("intern_data");
    router.push("/intern/login");
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isPublic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex">
      {/* ── Desktop sidebar nav ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/[0.07] bg-[#0c1120]">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <p className="text-white text-xs font-extrabold tracking-widest leading-none">DTC R5</p>
            <p className="text-white/30 text-[9px] tracking-widest leading-none mt-0.5">INTERN PORTAL</p>
          </div>
        </div>
        {/* Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            const isMessages = href === "/intern/messages";
            return (
              <Link key={href} href={href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold",
                  active
                    ? "bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {isMessages && unreadCount > 0 && (
                  <span className="ml-auto w-5 h-5 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div>
              <p className="text-white text-[11px] font-extrabold tracking-widest leading-none">DTC R5</p>
              <p className="text-white/30 text-[9px] tracking-widest leading-none">INTERN</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs">
            <LogOut className="w-3.5 h-3.5" /><span>Sign out</span>
          </button>
        </header>

        {/* Desktop page header (breadcrumb) */}
        <header className="hidden md:flex h-14 items-center px-6 border-b border-white/[0.07] shrink-0">
          <p className="text-white/50 text-sm font-medium">
            {NAV.find(n => pathname.startsWith(n.href))?.label ?? "Dashboard"}
          </p>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden flex flex-col pb-20 md:pb-0">
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur border-t border-white/[0.08] flex justify-around py-2 z-50">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            const isMessages = href === "/intern/messages";
            return (
              <Link key={href} href={href}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all",
                  active ? "text-indigo-400" : "text-white/30 hover:text-white/60"
                )}>
                <Icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
                {isMessages && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                <span className={cn("text-[9px] font-semibold", active ? "text-indigo-400" : "text-white/30")}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
