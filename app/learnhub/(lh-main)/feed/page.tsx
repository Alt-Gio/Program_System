"use client";

/**
 * LearnHub Feed (DTC-HUB redesign).
 *
 * The center column of the (lh-main) layout. Replaces the old static
 * masonry grid with a real, Convex-backed social feed:
 *
 *   1. Greeting + streak pill (DTC-HUB header)
 *   2. PostComposer    — wired to api.learnhub_posts.createPost
 *   3. Live feed list  — useQuery(api.learnhub_posts.listFeedWithAuthors)
 *      Each item is mapped into the MockPost shape that FeedPost expects
 *      so likes, comments, and media renderers (YouTube / Meet / Drive /
 *      Form / Opportunity / Certificate) all work out of the box.
 *
 * No layout changes here — TopNav / LeftPanel / RightPanel come from
 * the parent layout. CSS lives in app/learnhub/learnhub.css.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Flame } from "lucide-react";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { PostComposer } from "@/components/learnhub/feed/PostComposer";
import { FeedPost, type MockPost } from "@/components/learnhub/feed/FeedPost";

// ────────────────────────────────────────────────────────────────────
// Convex doc → MockPost mapper
// ────────────────────────────────────────────────────────────────────

type AuthorDoc = Doc<"learnhub_users"> | null;
type PostWithAuthor = Doc<"learnhub_posts"> & { author: AuthorDoc };

function isMockPostType(t: string): t is MockPost["type"] {
  return ["text", "youtube", "meet", "drive", "form", "opportunity", "certificate"].includes(t);
}

function isMockRole(r: string | undefined): r is MockPost["author"]["role"] {
  return r === "student" || r === "mentor" || r === "org_partner";
}

function mapConvexPost(p: PostWithAuthor): MockPost {
  const author = p.author;
  const authorName = author?.name ?? "Unknown";
  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}&backgroundColor=5B6CFF&textColor=ffffff`;
  const role: MockPost["author"]["role"] = isMockRole(author?.role) ? author!.role : "student";

  return {
    id: p._id as string,
    convexPostId: p._id as string,
    type: isMockPostType(p.type) ? p.type : "text",
    author: {
      id: (author?._id as string) ?? "unknown",
      name: authorName,
      avatarUrl: author?.avatarUrl ?? fallbackAvatar,
      role,
    },
    content: p.content,
    metadata: (p.metadata ?? {}) as Record<string, unknown>,
    likeCount: p.likeCount ?? 0,
    commentCount: p.commentCount ?? 0,
    isPinned: p.isPinned ?? false,
    createdAt: p.createdAt,
  };
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { session, userId, role } = useLearnhubSession();

  const me = useQuery(
    api.learnhub_users.getUser,
    userId ? { id: userId as Id<"learnhub_users"> } : "skip"
  );

  // Live, real-time feed query. Returns posts with their author docs joined.
  const feed = useQuery(api.learnhub_posts.listFeedWithAuthors, { limit: 30 });

  // Optimistic local posts — used by PostComposer when the user isn't signed
  // in yet (anonymous draft) and for instant feedback before the live query
  // re-snapshots. Once the live feed length grows past what we have locally
  // we clear the local array (the server is now the source of truth).
  const [localPosts, setLocalPosts] = useState<MockPost[]>([]);
  useEffect(() => {
    if (!feed) return;
    if (localPosts.length === 0) return;
    // Drop any local optimistic post that now exists on the server.
    const liveIds = new Set(feed.map((p) => p._id as string));
    setLocalPosts((prev) => prev.filter((p) => !liveIds.has(p.id) && !liveIds.has(p.convexPostId ?? "")));
  }, [feed, localPosts.length]);

  const handleOptimisticPost = (post: MockPost) => {
    setLocalPosts((prev) => [post, ...prev]);
  };

  // Greeting time-of-day
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  const firstName = (session?.name ?? "there").split(" ")[0];
  const streak = (me as { currentStreak?: number } | null | undefined)?.currentStreak ?? 0;

  // Final feed = optimistic prepended → live posts (mapped to MockPost).
  const posts: MockPost[] = useMemo(() => {
    const live = (feed ?? []).map(mapConvexPost);
    return [...localPosts, ...live];
  }, [feed, localPosts]);

  const composerRole: "student" | "mentor" | "org_partner" =
    role === "mentor" ? "mentor" : role === "org_partner" ? "org_partner" : "student";

  return (
    <div className="lh-feed-col" style={{ display: "flex", flexDirection: "column" }}>
      {/* Greeting header */}
      <header className="lh-feed-greeting">
        <div>
          <h1 className="lh-feed-greeting-title">
            {greeting}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="lh-feed-greeting-sub">
            What are your peers learning today?
          </p>
        </div>
        {streak > 0 && (
          <span className="lh-streak-pill" title="Daily learning streak">
            <Flame size={14} /> {streak} day streak
          </span>
        )}
      </header>

      {/* Composer */}
      <PostComposer
        onPost={handleOptimisticPost}
        userId={userId}
        userName={session?.name}
        userAvatar={session?.avatarUrl}
        userRole={composerRole}
      />

      {/* Loading skeletons */}
      {feed === undefined && (
        <div className="lh-feed-masonry">
          <div className="lh-feed-col">
            {[0, 2].map((i) => (
              <div key={i} className="lh-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className="lh-skeleton" style={{ width: 42, height: 42, borderRadius: "50%" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="lh-skeleton" style={{ height: 12, width: "40%" }} />
                    <div className="lh-skeleton" style={{ height: 10, width: "25%" }} />
                  </div>
                </div>
                <div className="lh-skeleton" style={{ height: 14, width: "92%" }} />
                <div className="lh-skeleton" style={{ height: 14, width: "78%" }} />
                <div className="lh-skeleton" style={{ height: 160, width: "100%", borderRadius: 12 }} />
              </div>
            ))}
          </div>
          <div className="lh-feed-col">
            {[1].map((i) => (
              <div key={i} className="lh-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className="lh-skeleton" style={{ width: 42, height: 42, borderRadius: "50%" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="lh-skeleton" style={{ height: 12, width: "40%" }} />
                    <div className="lh-skeleton" style={{ height: 10, width: "25%" }} />
                  </div>
                </div>
                <div className="lh-skeleton" style={{ height: 14, width: "92%" }} />
                <div className="lh-skeleton" style={{ height: 14, width: "78%" }} />
                <div className="lh-skeleton" style={{ height: 200, width: "100%", borderRadius: 12 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {feed !== undefined && posts.length === 0 && (
        <div className="lh-feed-empty">
          <div className="lh-feed-empty-emoji">📭</div>
          <p className="lh-feed-empty-title">No posts yet</p>
          <p style={{ margin: 0, fontSize: 12 }}>
            Be the first to share something with the cohort.
          </p>
        </div>
      )}

      {/* Live feed — 2-column masonry */}
      {feed !== undefined && posts.length > 0 && (
        <div className="lh-feed-masonry">
          <div className="lh-feed-col">
            {posts.filter((_, i) => i % 2 === 0).map((post) => (
              <FeedPost key={post.id} post={post} userId={userId} />
            ))}
          </div>
          <div className="lh-feed-col">
            {posts.filter((_, i) => i % 2 === 1).map((post) => (
              <FeedPost key={post.id} post={post} userId={userId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
