"use client";

/**
 * LearnHub TopNav (DTC-HUB redesign).
 *
 * Brand on the left (gradient "D" tile + "LearnHub · ILCDB" wordmark),
 * centered global search, and a right-cluster of icon buttons:
 *
 *   • Calendar  — opens CalendarPopover (live + upcoming Meet posts)
 *   • Messages  — opens MessagesPopover (recent chats)
 *   • Bell      — existing NotificationBell
 *   • ThemeToggle (kept)
 *   • Avatar    — links to /learnhub/profile
 *
 * The Pinterest-style center tab strip is gone; the new LeftRail
 * handles primary navigation. Sign-out moved into the avatar
 * dropdown (kept simple here — click avatar = open profile).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Calendar, MessageSquare, Search } from "lucide-react";
import { ThemeToggle } from "@/components/learnhub/ThemeToggle";
import { NotificationBell } from "@/components/learnhub/notifications/NotificationBell";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { CalendarPopover } from "./popovers/CalendarPopover";
import { MessagesPopover } from "./popovers/MessagesPopover";
import { AvatarMenu } from "./AvatarMenu";

type Panel = "cal" | "msg" | null;

export function TopNav() {
  const { userId } = useLearnhubSession();
  const router = useRouter();
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [brandExpanded, setBrandExpanded] = useState(false);

  // Live unread totals for icon badges.
  const convs = useQuery(
    api.learnhub_conversations.listMyConversations,
    userId ? { userId } : "skip"
  );
  const unreadMsgs = useMemo(
    () => (convs ?? []).reduce((n, c) => n + (c.unreadCount ?? 0), 0),
    [convs]
  );

  // Upcoming-events badge — pulled from feed posts where type === meet.
  const feed = useQuery(api.learnhub_posts.listFeedWithAuthors, { limit: 50 });
  const upcomingEvents = useMemo(() => {
    if (!feed) return 0;
    return feed.filter((p) => {
      if (p.type !== "meet") return false;
      const m = (p.metadata ?? {}) as Record<string, unknown>;
      const ts = (m.scheduledAt as number) ?? p.createdAt;
      const isLive = Boolean(m.isLive);
      return isLive || ts > Date.now();
    }).length;
  }, [feed]);

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  // Keyboard shortcuts: "/" or Ctrl/Cmd+K focuses search.
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && panel) {
        setPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/learnhub/feed?q=${encodeURIComponent(search.trim())}`);
  };

  const tabs = [
    { href: "/learnhub/feed", label: "Feed" },
    { href: "/learnhub/watch", label: "Watch" },
    { href: "/learnhub/learning-path", label: "My Trainings" },
    { href: "/learnhub/calendar", label: "Calendar" },
    { href: "/learnhub/work", label: "Opportunities" },
    { href: "/learnhub/leaderboard", label: "Leaderboard" },
    { href: "/learnhub/journal", label: "My Journal" },
    { href: "/learnhub/certificates", label: "My Certificates" },
  ];

  return (
    <nav className="lh-topnav">
      {/* Brand */}
      <Link
        href="/learnhub/feed"
        className={`lh-topnav-logo${brandExpanded ? " is-expanded" : ""}`}
        onMouseEnter={() => setBrandExpanded(true)}
        onMouseLeave={() => setBrandExpanded(false)}
      >
        <div className="lh-brand-tile" aria-hidden>D</div>
        <span className="lh-logo-copy">
          <span className="lh-logo-text">{brandExpanded ? "Digital Transformation" : "DTC-HUB"}</span>
          <span className="lh-logo-sub">{brandExpanded ? "CENTER HUB · ILCDB" : "ILCDB"}</span>
        </span>
      </Link>

      <div className="lh-dtc-pill" title="DTC Region V hub">
        <span className="lh-dtc-dot" aria-hidden />
        <span>DTC · Naga City</span>
      </div>

      {/* Primary tabs */}
      <div className="lh-topnav-tabs" aria-label="LearnHub sections">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link key={tab.href} href={tab.href} className={`lh-nav-tab${active ? " active" : ""}`}>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form onSubmit={onSearchSubmit} className="lh-topnav-search-wrap" role="search">
        <div className={`lh-topnav-search${searchFocused ? " is-focused" : ""}`}>
          <Search size={14} style={{ color: "var(--lh-text-3)" }} />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search courses, posts, mentors, events…"
            aria-label="Search LearnHub"
          />
          {!searchFocused && !search && (
            <kbd
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                color: "var(--lh-text-3)",
                border: "1px solid rgba(255,255,255,0.08)",
                marginLeft: "auto",
              }}
              aria-hidden
            >
              /
            </kbd>
          )}
        </div>
      </form>

      {/* Right cluster. Messages + Calendar popovers live in the bottom nav
          on mobile, so we hide them from the topnav below 768px to keep the
          chrome focused on Search / Notifications / Avatar — same trio
          Facebook shows in its mobile header. */}
      <div className="lh-topnav-actions">
        <span className="lh-topnav-mobile-hide">
          <IconBtn
            label="Calendar"
            icon={<Calendar size={18} />}
            badge={upcomingEvents}
            active={panel === "cal"}
            onClick={() => togglePanel("cal")}
          />
        </span>
        <span className="lh-topnav-mobile-hide">
          <IconBtn
            label="Messages"
            icon={<MessageSquare size={18} />}
            badge={unreadMsgs}
            active={panel === "msg"}
            onClick={() => togglePanel("msg")}
          />
        </span>
        <NotificationBell />
        <span className="lh-topnav-mobile-hide"><ThemeToggle /></span>
        <span className="lh-topnav-divider" aria-hidden />
        <AvatarMenu />
      </div>

      {/* Popovers — anchored to the topnav, controlled by `panel` */}
      <CalendarPopover open={panel === "cal"} onClose={() => setPanel(null)} />
      <MessagesPopover open={panel === "msg"} onClose={() => setPanel(null)} />
    </nav>
  );
}

function IconBtn({
  label, icon, badge, active, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  badge?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lh-topnav-icon${active ? " is-active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {icon}
      {badge && badge > 0 ? (
        <span className="lh-topnav-icon-badge">{badge > 9 ? "9+" : badge}</span>
      ) : null}
    </button>
  );
}
