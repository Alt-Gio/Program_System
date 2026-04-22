"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/learnhub/feed",        icon: "🏠", label: "Home" },
  { href: "/learnhub/work",        icon: "💼", label: "Work" },
  { href: "/learnhub/messages",    icon: "💬", label: "Msgs" },
  { href: "/learnhub/leaderboard", icon: "🏆", label: "Rank" },
  { href: "/learnhub/mentor",      icon: "🧑‍🏫", label: "Mentor" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lh-bottom-nav">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`lh-bottom-nav-item${active ? " active" : ""}`}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
