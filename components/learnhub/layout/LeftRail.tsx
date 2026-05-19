"use client";

/**
 * LearnHub Left Rail (DTC-HUB mockup redesign).
 *
 * Two visual states driven by the `expanded` prop:
 *   collapsed (72 px) — icon-only, tooltip on hover, active bar on left edge
 *   expanded  (240 px) — mini profile card at top + labeled nav items
 *
 * The parent (lh-main layout) owns the expanded state and passes it down.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, LayoutGrid, Plus, Zap, Briefcase,
  Trophy, Settings, Youtube, Calendar, PlaySquare, Users,
  ShieldCheck, BarChart3,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { initialsAvatar } from "@/lib/learnhub/avatar";

interface RailItem {
  id: string;
  href: string;
  icon: React.ReactNode;
  label: string;
}

type Role = "student" | "mentor" | "org_partner" | "coordinator" | "admin";
interface RoleGatedItem extends RailItem {
  // If set, the rail link only renders for these roles. Server-side queries
  // still enforce access; this just keeps students from seeing a tantalising
  // link they can't open.
  roles?: Role[];
}

const ITEMS: RoleGatedItem[] = [
  { id: "feed",        href: "/learnhub/feed",          icon: <Home size={20} />,        label: "Home" },
  { id: "watch",       href: "/learnhub/watch",         icon: <PlaySquare size={20} />,  label: "Watch" },
  { id: "learning",    href: "/learnhub/learning-path", icon: <LayoutGrid size={20} />,  label: "My Learning" },
  { id: "video-flow",  href: "/learnhub/video-flow",    icon: <Youtube size={20} />,     label: "Video Flow" },
  { id: "calendar",    href: "/learnhub/calendar",      icon: <Calendar size={20} />,    label: "Calendar" },
  { id: "flow",        href: "/learnhub/journal",       icon: <Zap size={20} />,         label: "Flow State" },
  { id: "work",        href: "/learnhub/work",          icon: <Briefcase size={20} />,   label: "Opportunities" },
  { id: "mentors",     href: "/learnhub/mentors",       icon: <Users size={20} />,       label: "Mentors" },
  { id: "leaderboard", href: "/learnhub/leaderboard",   icon: <Trophy size={20} />,      label: "Leaderboard" },
  { id: "progress", href: "/learnhub/progress", icon: <BarChart3 size={20} />,  label: "Progress · Restricted", roles: ["mentor", "coordinator", "admin"] },
  { id: "org",      href: "/learnhub/org",      icon: <ShieldCheck size={20} />, label: "Org Console",            roles: ["org_partner", "coordinator", "admin"] },
  { id: "curate",   href: "/learnhub/org/curate", icon: <PlaySquare size={20} />, label: "Watch Curation",         roles: ["org_partner", "coordinator", "admin"] },
];

function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

interface LeftRailProps {
  expanded?: boolean;
}

export function LeftRail({ expanded = false }: LeftRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, userId } = useLearnhubSession();

  const user = useQuery(
    api.learnhub_users.getUser,
    userId && expanded ? { id: userId as Id<"learnhub_users"> } : "skip"
  );

  const onCreatePost = () => {
    if (!pathname.startsWith("/learnhub/feed")) {
      router.push("/learnhub/feed#compose");
    } else if (typeof window !== "undefined") {
      window.location.hash = "compose";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const avatarSrc = session?.avatarUrl ?? initialsAvatar(session?.name);

  const xp = user?.xpPoints ?? 0;
  const level = calculateLevel(xp);
  const levelStart = xpForLevel(level);
  const levelEnd = xpForLevel(level + 1);
  const xpPercent = Math.min(100, Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100));

  return (
    <nav
      className={`lh-rail${expanded ? " lh-rail--expanded" : ""}`}
      aria-label="Primary"
    >
      {/* ── Mini profile card (expanded only) ── */}
      {expanded && (
        <div className="lh-rail-profile-card">
          <div className="lh-rail-profile-cover" />
          <div className="lh-rail-profile-body">
            <div className="lh-rail-profile-av-wrap">
              <img
                src={avatarSrc}
                alt={session?.name ?? ""}
                className="lh-rail-profile-av"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = initialsAvatar(session?.name);
                }}
              />
              <span className="lh-rail-profile-online-dot" aria-hidden />
            </div>
            <div className="lh-rail-profile-name">{session?.name ?? "Loading…"}</div>
            <div className="lh-rail-profile-role">{session?.role ?? "Student"}</div>
            <div className="lh-rail-profile-xp-wrap">
              <div className="lh-rail-profile-xp-label">
                <span>⚡ {xp >= 1000 ? (xp / 1000).toFixed(1) + "k" : xp} XP</span>
                <span>Lv {level}</span>
              </div>
              <div className="lh-rail-profile-xp-bar">
                <div className="lh-rail-profile-xp-fill" style={{ width: `${xpPercent}%` }} />
              </div>
            </div>
            {(user?.currentStreak ?? 0) > 0 && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  fontSize: 11,
                  color: "rgba(220,225,240,0.85)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  🔥 <strong style={{ color: "#f97316" }}>{user?.currentStreak}</strong>{" "}
                  day{(user?.currentStreak ?? 0) === 1 ? "" : "s"}
                </span>
                {(user?.streakFreezesAvailable ?? 0) > 0 && (
                  <span
                    title={`${user?.streakFreezesAvailable} streak freeze${(user?.streakFreezesAvailable ?? 0) === 1 ? "" : "s"} stashed`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#38bdf8" }}
                  >
                    🧊 {user?.streakFreezesAvailable}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Nav items ── */}
      <div className="lh-rail-items">
        {(() => {
          const currentRole = (session?.role ?? null) as Role | null;
          const visible = ITEMS.filter((it) => {
            if (!it.roles) return true;
            return currentRole !== null && it.roles.includes(currentRole);
          });
          return (
            <>
              {visible.slice(0, 2).map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return <RailLink key={it.id} item={it} active={active} expanded={expanded} />;
              })}

              {/* Create-post FAB */}
              <button
                type="button"
                onClick={onCreatePost}
                className={`lh-rail-btn lh-rail-fab${expanded ? " lh-rail-btn--labeled" : ""}`}
                title="Create Post"
                aria-label="Create Post"
              >
                <span className="lh-rail-btn-icon"><Plus size={20} /></span>
                {expanded
                  ? <span className="lh-rail-btn-label">Create Post</span>
                  : <span className="lh-rail-tip">Create Post</span>}
              </button>

              {visible.slice(2).map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return <RailLink key={it.id} item={it} active={active} expanded={expanded} />;
              })}
            </>
          );
        })()}
      </div>

      {/* ── Footer: Settings + (collapsed) Avatar ── */}
      <div className="lh-rail-footer">
        <Link
          href="/learnhub/settings"
          className={`lh-rail-btn${pathname.startsWith("/learnhub/settings") ? " is-active" : ""}${expanded ? " lh-rail-btn--labeled" : ""}`}
          title="Settings"
          aria-label="Settings"
        >
          <span className="lh-rail-btn-icon"><Settings size={20} /></span>
          {expanded
            ? <span className="lh-rail-btn-label">Settings</span>
            : <span className="lh-rail-tip">Settings</span>}
          {pathname.startsWith("/learnhub/settings") && !expanded && (
            <span className="lh-rail-active-bar" aria-hidden />
          )}
        </Link>

        {!expanded && (
          <Link
            href="/learnhub/profile"
            className={`lh-rail-avatar${pathname.startsWith("/learnhub/profile") ? " is-active" : ""}`}
            title={session?.name ?? "Profile"}
            aria-label="My Profile"
          >
            <img
              src={avatarSrc}
              alt=""
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = initialsAvatar(session?.name);
              }}
            />
            <span className="lh-rail-tip">{session?.name ?? "My Profile"}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function RailLink({
  item, active, expanded,
}: {
  item: RailItem;
  active: boolean;
  expanded: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`lh-rail-btn${active ? " is-active" : ""}${expanded ? " lh-rail-btn--labeled" : ""}`}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      <span className="lh-rail-btn-icon">{item.icon}</span>
      {expanded ? (
        <>
          <span className="lh-rail-btn-label">{item.label}</span>
          {active && <span className="lh-rail-active-dot" aria-hidden />}
        </>
      ) : (
        <>
          <span className="lh-rail-tip">{item.label}</span>
          {active && <span className="lh-rail-active-bar" aria-hidden />}
        </>
      )}
    </Link>
  );
}
