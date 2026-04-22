"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/learnhub/ThemeToggle";
import { NotificationBell } from "@/components/learnhub/notifications/NotificationBell";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const TABS = [
  { href: "/learnhub/feed",         label: "Feed",         icon: "🏠" },
  { href: "/learnhub/work",         label: "Opportunities", icon: "💼" },
  { href: "/learnhub/messages",     label: "Messages",      icon: "💬" },
  { href: "/learnhub/leaderboard",  label: "Leaderboard",   icon: "🏆" },
  { href: "/learnhub/mentor",       label: "Mentor",        icon: "🧑‍🏫" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useLearnhubSession();

  const signOut = async () => {
    await fetch("/api/learnhub/auth/session", { method: "DELETE" });
    router.push("/learnhub/login");
  };

  const avatarSrc = session
    ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(session.name ?? "U")}`
    : undefined;

  return (
    <nav className="lh-topnav">
      {/* Logo */}
      <Link href="/learnhub/feed" className="lh-topnav-logo">
        <div className="lh-logo-icon">📡</div>
        <span className="lh-logo-text">LearnHub</span>
        <span className="lh-logo-sub">ILCDB</span>
      </Link>

      {/* Center tabs */}
      <div className="lh-topnav-tabs">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`lh-nav-tab${active ? " active" : ""}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Right actions */}
      <div className="lh-topnav-actions">
        <NotificationBell />
        <ThemeToggle />
        {session ? (
          <button
            onClick={signOut}
            className="lh-icon-btn"
            title={`Sign out (${session.name})`}
            style={{ overflow: "hidden" }}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={session.name}
                width={38}
                height={38}
                style={{ borderRadius: "50%", objectFit: "cover" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span style={{ fontSize: 16 }}>👤</span>
            )}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
