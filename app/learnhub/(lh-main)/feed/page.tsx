"use client";

/**
 * LearnHub Feed (DTC-HUB redesign).
 *
 * The center column of the (lh-main) layout. Center column hosts:
 *
 *   1. Greeting + streak pill (DTC-HUB header)
 *   2. PostComposer    — wired to api.learnhub_posts.createPost
 *   3. For you / Saved tab strip
 *   4. Live feed list  — useQuery(api.learnhub_posts.listFeedWithAuthors)
 *      Rendered as a Pinterest-style multi-column masonry (CSS columns).
 *      Each item is mapped into the MockPost shape that FeedPost expects
 *      so likes, comments, bookmarks, and media renderers (YouTube /
 *      Video / Meet / Drive / Form / Opportunity / Certificate) all work.
 *   5. Saved tab — bookmarked posts grouped by learning status.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Flame, Search } from "lucide-react";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { PostComposer } from "@/components/learnhub/feed/PostComposer";
import { FeedPost, type MockPost } from "@/components/learnhub/feed/FeedPost";

// ────────────────────────────────────────────────────────────────────
// Convex doc → MockPost mapper
// ────────────────────────────────────────────────────────────────────

type AuthorDoc = Doc<"learnhub_users"> | null;
type PostWithAuthor = Doc<"learnhub_posts"> & { author: AuthorDoc };

function isMockPostType(t: string): t is MockPost["type"] {
  return ["text", "youtube", "video", "meet", "drive", "form", "opportunity", "certificate"].includes(t);
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

function mapStandalonePost(p: Doc<"learnhub_posts">): MockPost {
  return mapConvexPost({ ...p, author: null });
}

type FeedTab = "for_you" | "saved";
type FeedCategory = "All" | "YouTube" | "Meet" | "Drive" | "Forms" | "Opportunities" | "Certificates";

const FEED_CATEGORIES: FeedCategory[] = ["All", "YouTube", "Meet", "Drive", "Forms", "Opportunities", "Certificates"];

const SAVED_GROUPS: { key: "in_progress" | "want_to_learn" | "done"; label: string; emoji: string }[] = [
  { key: "in_progress", label: "Continue learning", emoji: "▶️" },
  { key: "want_to_learn", label: "Want to learn", emoji: "📌" },
  { key: "done", label: "Done", emoji: "✅" },
];

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { session, userId, role } = useLearnhubSession();
  const sp = useSearchParams();
  const [tab, setTab] = useState<FeedTab>("for_you");
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [category, setCategory] = useState<FeedCategory>("All");

  const me = useQuery(
    api.learnhub_users.getUser,
    userId ? { id: userId as Id<"learnhub_users"> } : "skip"
  );

  // Live, real-time feed query. Returns posts with their author docs joined.
  const feed = useQuery(api.learnhub_posts.listFeedWithAuthors, { limit: 30 });

  // Bookmarks for the signed-in user (only loaded when the Saved tab is open
  // — but we also use it to decorate "For you" with bookmark state via the
  // per-post getBookmark query inside FeedPost itself).
  const bookmarks = useQuery(
    api.learnhub_bookmarks.listBookmarks,
    userId && tab === "saved" ? { userId: userId as Id<"learnhub_users"> } : "skip"
  );

  // Optimistic local posts — used by PostComposer when the user isn't signed
  // in yet (anonymous draft) and for instant feedback before the live query
  // re-snapshots. Once the live feed length grows past what we have locally
  // we clear the local array (the server is now the source of truth).
  const [localPosts, setLocalPosts] = useState<MockPost[]>([]);
  useEffect(() => {
    if (!feed) return;
    if (localPosts.length === 0) return;
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

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesQuery = !q
        || post.content.toLowerCase().includes(q)
        || post.author.name.toLowerCase().includes(q)
        || String(post.metadata.title ?? post.metadata.courseTitle ?? "").toLowerCase().includes(q);
      const matchesCategory =
        category === "All"
        || (category === "YouTube" && post.type === "youtube")
        || (category === "Meet" && post.type === "meet")
        || (category === "Drive" && post.type === "drive")
        || (category === "Forms" && post.type === "form")
        || (category === "Opportunities" && post.type === "opportunity")
        || (category === "Certificates" && post.type === "certificate");
      return matchesQuery && matchesCategory;
    });
  }, [posts, query, category]);

  const composerRole: "student" | "mentor" | "org_partner" =
    role === "mentor" ? "mentor" : role === "org_partner" ? "org_partner" : "student";

  // Group bookmarks by status for the Saved tab.
  const savedGroups = useMemo(() => {
    if (!bookmarks) return null;
    const groups: Record<"in_progress" | "want_to_learn" | "done", MockPost[]> = {
      in_progress: [],
      want_to_learn: [],
      done: [],
    };
    for (const b of bookmarks) {
      if (!b.post) continue;
      const mp = mapStandalonePost(b.post as Doc<"learnhub_posts">);
      groups[b.status].push(mp);
    }
    return groups;
  }, [bookmarks]);

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

      <div className="lh-feed-control-card">
        <div className="lh-feed-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, articles, topics..."
          />
        </div>
        <div className="lh-feed-category-row" aria-label="Feed categories">
          {FEED_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`lh-feed-category${category === item ? " is-active" : ""}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Composer — only visible on the For you tab */}
      {tab === "for_you" && (
        <PostComposer
          onPost={handleOptimisticPost}
          userId={userId}
          userName={session?.name}
          userAvatar={session?.avatarUrl}
          userRole={composerRole}
        />
      )}

      {/* Tabs */}
      <div className="lh-feed-tabs" role="tablist" aria-label="Feed sections">
        <button
          role="tab"
          aria-selected={tab === "for_you"}
          className={`lh-feed-tab${tab === "for_you" ? " is-active" : ""}`}
          onClick={() => setTab("for_you")}
        >
          For you
        </button>
        <button
          role="tab"
          aria-selected={tab === "saved"}
          className={`lh-feed-tab${tab === "saved" ? " is-active" : ""}`}
          onClick={() => setTab("saved")}
          disabled={!userId}
          title={userId ? undefined : "Sign in to see saved posts"}
        >
          🔖 Saved
        </button>
      </div>

      {/* ── For you tab ────────────────────────────────────────── */}
      {tab === "for_you" && (
        <>
          {feed === undefined && (
            <div className="lh-feed-masonry">
              {[0, 1, 2].map((i) => (
                <div key={i} className="lh-post" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="lh-skeleton" style={{ width: 42, height: 42, borderRadius: "50%" }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="lh-skeleton" style={{ height: 12, width: "40%" }} />
                      <div className="lh-skeleton" style={{ height: 10, width: "25%" }} />
                    </div>
                  </div>
                  <div className="lh-skeleton" style={{ height: 14, width: "92%" }} />
                  <div className="lh-skeleton" style={{ height: 14, width: "78%" }} />
                  <div className="lh-skeleton" style={{ height: 160 + i * 40, width: "100%", borderRadius: 12 }} />
                </div>
              ))}
            </div>
          )}

          {feed !== undefined && filteredPosts.length === 0 && (
            <div className="lh-feed-empty">
              <div className="lh-feed-empty-emoji">📭</div>
              <p className="lh-feed-empty-title">{posts.length === 0 ? "No posts yet" : "No matching posts"}</p>
              <p style={{ margin: 0, fontSize: 12 }}>
                {posts.length === 0 ? "Be the first to share something with the cohort." : "Try another search or category."}
              </p>
            </div>
          )}

          {feed !== undefined && filteredPosts.length > 0 && (
            <div className="lh-feed-masonry">
              {filteredPosts.map((post) => (
                <FeedPost key={post.id} post={post} userId={userId} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Saved tab ──────────────────────────────────────────── */}
      {tab === "saved" && (
        <>
          {!userId && (
            <div className="lh-feed-empty">
              <p className="lh-feed-empty-title">Sign in to save posts</p>
            </div>
          )}
          {userId && savedGroups === null && (
            <div className="lh-feed-masonry">
              <div className="lh-skeleton" style={{ height: 160, borderRadius: 12 }} />
              <div className="lh-skeleton" style={{ height: 220, borderRadius: 12 }} />
              <div className="lh-skeleton" style={{ height: 180, borderRadius: 12 }} />
            </div>
          )}
          {userId && savedGroups !== null && (
            <>
              {SAVED_GROUPS.every((g) => savedGroups[g.key].length === 0) && (
                <div className="lh-feed-empty">
                  <div className="lh-feed-empty-emoji">🔖</div>
                  <p className="lh-feed-empty-title">Nothing saved yet</p>
                  <p style={{ margin: 0, fontSize: 12 }}>
                    Tap the bookmark on any post to add it here.
                  </p>
                </div>
              )}
              {SAVED_GROUPS.map((g) => {
                const items = savedGroups[g.key];
                if (items.length === 0) return null;
                return (
                  <section key={g.key}>
                    <h2 className="lh-saved-group-title">
                      {g.emoji} {g.label} · {items.length}
                    </h2>
                    <div className="lh-feed-masonry">
                      {items.map((post) => (
                        <FeedPost key={post.id} post={post} userId={userId} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
