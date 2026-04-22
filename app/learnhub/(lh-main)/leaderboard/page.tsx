"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const BADGES: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const RANK_COLORS: Record<number, string> = {
  1: "linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)",
  2: "linear-gradient(135deg, #c0c0c0 0%, #808080 100%)",
  3: "linear-gradient(135deg, #cd7f32 0%, #8b4513 100%)",
};

// XP level thresholds
function getLevel(xp: number) {
  if (xp < 500) return { level: 1, label: "Seedling", color: "#9ba3cc" };
  if (xp < 1500) return { level: 2, label: "Explorer", color: "#22d3a0" };
  if (xp < 3000) return { level: 3, label: "Achiever", color: "#5b6cff" };
  if (xp < 6000) return { level: 4, label: "Champion", color: "#ff8c42" };
  return { level: 5, label: "Legend", color: "#ffd700" };
}

export default function LeaderboardPage() {
  const users = useQuery(api.learnhub_bookmarks.getLeaderboard, { limit: 20 });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Leaderboard</h1>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>Top learners by XP this month</p>
      </div>

      {/* Top 3 podium */}
      {users && users.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-8">
          {[users[1], users[0], users[2]].map((u, i) => {
            const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const level = getLevel(u.xpPoints);
            const height = actualRank === 1 ? 120 : actualRank === 2 ? 96 : 80;
            return (
              <div key={u._id} className="flex flex-col items-center gap-2" style={{ width: 96 }}>
                <img src={u.avatarUrl} alt={u.name} width={actualRank === 1 ? 56 : 44} height={actualRank === 1 ? 56 : 44} className="rounded-full object-cover" style={{ border: `3px solid ${actualRank === 1 ? "#ffd700" : actualRank === 2 ? "#c0c0c0" : "#cd7f32"}` }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`; }} />
                <p className="text-xs font-semibold text-center truncate w-full" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{u.name.split(" ")[0]}</p>
                <div className="w-full rounded-t-xl flex flex-col items-center justify-center gap-1 py-3" style={{ height, background: RANK_COLORS[actualRank] ?? "rgba(91,108,255,0.2)" }}>
                  <span className="text-2xl">{BADGES[actualRank]}</span>
                  <span className="text-xs font-bold" style={{ color: "#fff" }}>{u.xpPoints.toLocaleString()} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="flex flex-col gap-2">
        {users === undefined && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "#131626" }} />
          ))
        )}
        {users?.map((u) => {
          const level = getLevel(u.xpPoints);
          const isTop3 = u.rank <= 3;
          return (
            <div key={u._id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: isTop3 ? "rgba(91,108,255,0.06)" : "#131626", border: isTop3 ? "1px solid rgba(91,108,255,0.15)" : "1px solid rgba(255,255,255,0.05)" }}>
              <span className="w-7 text-center text-sm font-bold shrink-0" style={{ color: isTop3 ? "#ffd700" : "#5c6490", fontFamily: "var(--font-sora)" }}>
                {BADGES[u.rank] ?? `#${u.rank}`}
              </span>
              <img src={u.avatarUrl} alt={u.name} width={36} height={36} className="rounded-full object-cover shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`; }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{u.name}</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: level.color + "20", color: level.color }}>{level.label}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>🔥 {u.currentStreak}-day streak · {u.badges.length} badge{u.badges.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold" style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}>{u.xpPoints.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: "#5c6490" }}>XP</p>
              </div>
            </div>
          );
        })}
        {users?.length === 0 && (
          <p className="text-center text-sm py-12" style={{ color: "#5c6490" }}>No participants yet. Be the first on the board!</p>
        )}
      </div>
    </div>
  );
}
