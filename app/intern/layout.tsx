"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { LayoutDashboard, Flame, BookOpen, QrCode, LogOut, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const PUBLIC_PATHS = ["/intern/login", "/intern/register"];

const NAV = [
  { href: "/intern/dashboard",  icon: LayoutDashboard, label: "Home"     },
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
    <div className="min-h-screen bg-[#0f172a] flex flex-col max-w-md mx-auto relative">
      {/* Top bar */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/[0.07] shrink-0">
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
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0f172a]/95 backdrop-blur border-t border-white/[0.08] flex justify-around py-2 z-50">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          const isMessages = href === "/intern/messages";
          return (
            <Link key={href} href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all",
                active ? "text-indigo-400" : "text-white/30 hover:text-white/60"
              )}>
              <Icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
              {isMessages && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className={cn("text-[10px] font-semibold", active ? "text-indigo-400" : "text-white/30")}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
