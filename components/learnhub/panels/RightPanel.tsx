"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

export function RightPanel() {
  const { userId } = useLearnhubSession();
  const allUsers = useQuery(api.learnhub_users.listUsers);
  const leaderboard = useQuery(api.learnhub_bookmarks.getLeaderboard, { limit: 5 });

  const suggestions = (allUsers ?? [])
    .filter((u) => u._id !== userId)
    .slice(0, 5);

  return (
    <div>
      {/* Suggested people */}
      <div className="lh-card">
        <div className="lh-card-header">
          <span className="lh-card-title">Suggested for you</span>
          <Link href="/learnhub/leaderboard" className="lh-see-all">See All</Link>
        </div>

        {allUsers === undefined && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="lh-suggest-item">
                <div className="lh-skeleton" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div className="lh-skeleton" style={{ height: 12, width: "70%" }} />
                  <div className="lh-skeleton" style={{ height: 10, width: "50%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {suggestions.map((u) => {
          const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name ?? "U")}&backgroundColor=5B6CFF&textColor=ffffff`;
          return (
            <div key={u._id} className="lh-suggest-item">
              <div className="lh-suggest-avatar-wrap">
                <img
                  src={u.avatarUrl ?? avatar}
                  alt={u.name}
                  className="lh-suggest-avatar"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatar; }}
                />
              </div>
              <div className="lh-suggest-info">
                <div className="lh-suggest-name">
                  {u.name}
                  {u.role === "mentor" && (
                    <span className="lh-verify-badge-sm" title="Mentor">✓</span>
                  )}
                </div>
                <div className="lh-suggest-meta">
                  {u.programBatch ?? u.role ?? "Participant"}
                </div>
              </div>
              <button className="lh-btn-outline-sm">Follow</button>
            </div>
          );
        })}
      </div>

      {/* Top XP this week */}
      {leaderboard && leaderboard.length > 0 && (
        <div className="lh-card">
          <div className="lh-card-header">
            <span className="lh-card-title">🏆 Top XP</span>
            <Link href="/learnhub/leaderboard" className="lh-see-all">View All</Link>
          </div>
          {leaderboard.map((entry, i) => {
            const u = entry.user as Record<string, unknown> | null;
            const name = (u?.name as string) ?? "User";
            const xp = entry.xpPoints as number ?? 0;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
            return (
              <div key={entry._id} className="lh-suggest-item">
                <span style={{ width: 24, textAlign: "center", fontSize: 14 }}>{medal}</span>
                <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=5B6CFF&textColor=ffffff`}
                  alt={name}
                  className="lh-suggest-avatar"
                />
                <div className="lh-suggest-info">
                  <div className="lh-suggest-name">{name}</div>
                  <div className="lh-suggest-meta">⚡ {xp} XP</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Explore links */}
      <div className="lh-card" style={{ padding: "12px 16px" }}>
        <div className="lh-card-title" style={{ marginBottom: 10 }}>Explore</div>
        {[
          { href: "/learnhub/work",   label: "💼 Work Board",       sub: "Find opportunities" },
          { href: "/learnhub/journal", label: "📝 Daily Journal",    sub: "Reflect on progress" },
          { href: "/learnhub/certificates", label: "🏅 Certificates", sub: "Your achievements" },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ display: "block", textDecoration: "none", padding: "8px 0", borderBottom: "1px solid var(--lh-surface-3)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lh-text)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "var(--lh-text-3)", marginTop: 1 }}>{item.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
