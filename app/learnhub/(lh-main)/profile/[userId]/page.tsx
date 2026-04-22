"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

type ConvexUserId = Parameters<typeof api.learnhub_users.getUser>[1]["id"];

function getLevel(xp: number) {
  if (xp < 500) return { label: "Seedling", color: "#9ba3cc", icon: "🌱" };
  if (xp < 1500) return { label: "Explorer", color: "#22d3a0", icon: "🧭" };
  if (xp < 3000) return { label: "Achiever", color: "#5b6cff", icon: "⭐" };
  if (xp < 6000) return { label: "Champion", color: "#ff8c42", icon: "🏆" };
  return { label: "Legend", color: "#ffd700", icon: "👑" };
}

const ROLE_LABEL: Record<string, string> = { student: "Student", mentor: "Mentor", org_partner: "Org Partner" };
const ROLE_COLOR: Record<string, string> = { student: "#22d3a0", mentor: "#5b6cff", org_partner: "#ff8c42" };

interface Props { params: { userId: string } }

export default function ProfilePage({ params }: Props) {
  const user = useQuery(api.learnhub_users.getUser, { id: params.userId as ConvexUserId });
  const posts = useQuery(api.learnhub_posts.getPostsByAuthor, user ? { authorId: user._id, limit: 6 } : "skip");

  if (user === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="h-32 rounded-2xl animate-pulse mb-4" style={{ background: "#131626" }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: "#131626" }} />
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-3">👤</p>
        <p className="text-lg font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>User not found</p>
        <Link href="/learnhub/feed" className="text-sm mt-4 inline-block" style={{ color: "#5b6cff" }}>← Back to Feed</Link>
      </div>
    );
  }

  const level = getLevel(user.xpPoints);
  const xpToNext = user.xpPoints < 500 ? 500 : user.xpPoints < 1500 ? 1500 : user.xpPoints < 3000 ? 3000 : user.xpPoints < 6000 ? 6000 : null;
  const xpProgress = xpToNext ? (user.xpPoints / xpToNext) * 100 : 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
      {/* Profile header card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Cover gradient */}
        <div className="h-20" style={{ background: `linear-gradient(135deg, ${level.color}30 0%, rgba(91,108,255,0.1) 100%)` }} />

        <div className="px-5 pb-5">
          {/* Avatar */}
          <div className="relative -mt-10 mb-3 flex items-end justify-between">
            <img src={user.avatarUrl} alt={user.name} width={72} height={72} className="rounded-2xl object-cover" style={{ border: "3px solid #131626", background: "#1a1d30" }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`; }} />
            <div className="flex gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: ROLE_COLOR[user.role] + "20", color: ROLE_COLOR[user.role] }}>{ROLE_LABEL[user.role]}</span>
            </div>
          </div>

          {/* Name + level */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{user.name}</h1>
            <span className="text-sm">{level.icon}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: level.color + "20", color: level.color }}>{level.label}</span>
          </div>

          {user.bio && <p className="text-sm mb-3" style={{ color: "#9ba3cc" }}>{user.bio}</p>}
          {(user.school || user.organization) && (
            <p className="text-xs mb-3" style={{ color: "#5c6490" }}>
              🏫 {user.school ?? user.organization}
            </p>
          )}

          {/* XP bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: "#9ba3cc" }}>{user.xpPoints.toLocaleString()} XP</span>
              {xpToNext && <span style={{ color: "#5c6490" }}>{xpToNext.toLocaleString()} XP to next level</span>}
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(xpProgress, 100)}%`, background: `linear-gradient(90deg, ${level.color}, ${level.color}80)` }} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "XP Points", value: user.xpPoints.toLocaleString(), icon: "⚡" },
              { label: "Day Streak", value: `${user.currentStreak}🔥`, icon: "" },
              { label: "Followers", value: user.followerCount.toString(), icon: "👥" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-base font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{stat.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#9ba3cc" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Badges */}
      {user.badges.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Badges</p>
          <div className="flex flex-wrap gap-2">
            {user.badges.map((badge, i) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(91,108,255,0.1)", color: "#7c8bff", border: "1px solid rgba(91,108,255,0.2)" }}>{badge}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent posts */}
      <div className="rounded-2xl p-5" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Recent Posts</p>
        {posts === undefined && <div className="h-24 rounded-xl animate-pulse" style={{ background: "#1a1d30" }} />}
        {posts?.length === 0 && <p className="text-sm" style={{ color: "#5c6490" }}>No posts yet.</p>}
        <div className="flex flex-col gap-2">
          {posts?.map((post) => (
            <div key={post._id} className="rounded-xl px-4 py-3 flex items-start justify-between gap-3" style={{ background: "#1a1d30" }}>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded mr-2" style={{ background: "rgba(91,108,255,0.1)", color: "#7c8bff" }}>{post.type}</span>
                <p className="text-sm mt-1.5 line-clamp-2" style={{ color: "#c8caf0" }}>{post.content}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px]" style={{ color: "#5c6490" }}>{formatDistanceToNow(post.createdAt, { addSuffix: true })}</p>
                <p className="text-xs mt-1" style={{ color: "#9ba3cc" }}>❤ {post.likeCount}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
