"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogIn, LogOut, User, ShieldCheck, ChevronDown } from "lucide-react";

type Role = "intern" | "supervisor" | "manager" | "admin";

type Me = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

const ROLE_COLORS: Record<Role, string> = {
  intern: "bg-sky-100 text-sky-800 border-sky-200",
  supervisor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  manager: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-violet-100 text-violet-800 border-violet-200",
};

const HIDDEN_PATHS = new Set(["/signin", "/signup", "/accept-invite", "/meeting-hall"]);

export default function UserBadge() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setMe(null);
        } else {
          const data = await res.json();
          if (!cancelled) setMe(data.user);
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function signOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ignore
    }
    setMe(null);
    router.push("/");
    router.refresh();
  }

  if (HIDDEN_PATHS.has(pathname)) return null;
  if (loading) {
    return (
      <div className="fixed top-3 right-3 z-50 h-9 w-28 rounded-full bg-white/60 backdrop-blur border border-gray-200 animate-pulse" />
    );
  }

  if (!me) {
    return (
      <Link
        href={`/signin${pathname && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : ""}`}
        className="fixed top-3 right-3 z-50 inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-white hover:shadow transition"
      >
        <LogIn className="w-4 h-4" />
        Sign in
      </Link>
    );
  }

  const roleClass = ROLE_COLORS[me.role] ?? "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <div className="fixed top-3 right-3 z-50">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur border border-gray-200 pl-2 pr-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:shadow transition"
        >
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">
            {me.fullName?.[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="max-w-[140px] truncate">{me.fullName}</span>
          <span
            className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${roleClass}`}
          >
            {me.role}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs text-gray-500">Signed in as</div>
              <div className="text-sm font-semibold text-gray-900 truncate">{me.email}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
                <ShieldCheck className="w-3 h-3" />
                {me.role}
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
