"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const QUICK_LINKS = [
  { href: "/learnhub/journal",       icon: "📝", label: "My Journal" },
  { href: "/learnhub/certificates",  icon: "🏅", label: "Certificates" },
  { href: "/learnhub/learning-path", icon: "🗂️", label: "Learning Path" },
  { href: "/learnhub/settings",      icon: "⚙️", label: "Settings" },
];

const SECONDARY_LINKS = [
  { href: "/learnhub/mentor/report", icon: "📊", label: "Reports" },
  { href: "/learnhub/admin/mentors", icon: "🛡️", label: "Admin · Mentors" },
];

export function LeftPanel() {
  const { userId, session, isMentor, isAdmin } = useLearnhubSession();
  const user = useQuery(
    api.learnhub_users.getUser,
    userId ? { id: userId as Id<"learnhub_users"> } : "skip"
  );

  const xp = user?.xpPoints ?? 0;
  const level = calculateLevel(xp);
  const levelStart = xpForLevel(level);
  const levelEnd = xpForLevel(level + 1);
  const xpPercent = Math.min(100, Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100));

  const avatarSrc = session
    ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(session.name ?? "U")}&backgroundColor=5B6CFF&textColor=ffffff`
    : undefined;

  return (
    <div>
      {/* Profile Card */}
      <div className="lh-profile-card">
        <div className="lh-profile-cover" />
        <div className="lh-profile-avatar-wrap">
          <img
            src={avatarSrc ?? ""}
            alt={session?.name ?? "User"}
            className="lh-profile-avatar"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://api.dicebear.com/7.x/shapes/svg?seed=user"; }}
          />
          <div className="lh-online-dot" />
        </div>

        <div className="lh-profile-info">
          <div className="lh-profile-name">
            {session?.name ?? "Loading…"}
            {isMentor && (
              <span className="lh-verify-badge" title="Verified Mentor">✓</span>
            )}
          </div>
          {user?.municipality && (
            <div className="lh-profile-sub">📍 {user.municipality}{user.province ? `, ${user.province}` : ""}</div>
          )}
          <div className="lh-profile-program">
            {user?.programBatch ?? ""}{user?.programType ? ` · ${user.programType}` : ""}
            {!user?.programBatch && !user?.programType && (session?.role ? `Role: ${session.role}` : "")}
          </div>
        </div>

        <div className="lh-profile-stats">
          <div className="lh-stat">
            <span className="lh-stat-num">{user?.postCount ?? 0}</span>
            <span className="lh-stat-label">Posts</span>
          </div>
          <div className="lh-stat-divider" />
          <div className="lh-stat">
            <span className="lh-stat-num">{formatCount(user?.followerCount ?? 0)}</span>
            <span className="lh-stat-label">Followers</span>
          </div>
          <div className="lh-stat-divider" />
          <div className="lh-stat">
            <span className="lh-stat-num">{user?.followingIds?.length ?? 0}</span>
            <span className="lh-stat-label">Following</span>
          </div>
        </div>

        <Link href="/learnhub/settings" className="lh-btn-primary">
          Edit Profile
        </Link>
      </div>

      {/* XP Bar */}
      <div className="lh-card lh-xp-card">
        <div className="lh-xp-label">
          <span>⚡ {formatCount(xp)} XP</span>
          <span>Level {level}</span>
        </div>
        <div className="lh-xp-bar">
          <div className="lh-xp-fill" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Quick Links */}
      <div className="lh-card" style={{ padding: "8px 16px" }}>
        <div className="lh-card-header" style={{ marginBottom: 4 }}>
          <span className="lh-card-title">Navigate</span>
        </div>
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="lh-quick-link">
            <span style={{ width: 20, textAlign: "center" }}>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
        {(isMentor || isAdmin) && SECONDARY_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="lh-quick-link">
            <span style={{ width: 20, textAlign: "center" }}>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
