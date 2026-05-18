"use client";

/**
 * LearnHub Watch — Facebook-Watch-style video feed.
 *
 * Pulls every post whose type is `video` or `youtube` from the live feed and
 * renders them as a single-column vertical stack. Video-type posts use a
 * native <video> element that auto-plays muted when ≥60% in view and pauses
 * when it leaves the viewport (same pattern as Facebook / Instagram Reels —
 * no autoplay-with-audio surprise). YouTube posts swap to a real iframe on
 * first tap so the user controls when to start them.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Play, Volume2, VolumeX, MessageCircle, Heart, Share2 } from "lucide-react";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

type PostDoc = Doc<"learnhub_posts">;
type AuthorDoc = Doc<"learnhub_users"> | null;
type FeedPostWithAuthor = PostDoc & { author: AuthorDoc };

function isVideoPost(p: PostDoc): boolean {
  return p.type === "video" || p.type === "youtube";
}

export default function WatchPage() {
  const { userId } = useLearnhubSession();
  const [muted, setMuted] = useState(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Tracks whether we're in the mobile reels layout (≤768px). The page
  // works in both modes — the CSS does the heavy visual lifting — but
  // the IntersectionObserver inside each card needs to know which
  // scroll container to observe (the snap rail on mobile, the viewport
  // on desktop).
  const [isReelsMode, setIsReelsMode] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsReelsMode(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const feed = useQuery(
    api.learnhub_posts.listFeedWithAuthors,
    userId
      ? { limit: 60, userId: userId as Id<"learnhub_users"> }
      : { limit: 60 },
  );

  const videoPosts = useMemo<FeedPostWithAuthor[]>(() => {
    if (!feed) return [];
    return (feed as FeedPostWithAuthor[]).filter(isVideoPost);
  }, [feed]);

  return (
    <div className={`lh-watch${isReelsMode ? " lh-watch--reels" : ""}`}>
      <header className="lh-watch-header">
        <div>
          <h1 className="lh-watch-title">Watch</h1>
          <p className="lh-watch-sub">Videos and recorded sessions from the cohort.</p>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="lh-watch-sound"
          aria-pressed={!muted}
          aria-label={muted ? "Unmute videos" : "Mute videos"}
          title={muted ? "Unmute videos" : "Mute videos"}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <span>{muted ? "Muted" : "Sound on"}</span>
        </button>
      </header>

      {feed === undefined && (
        <div className="lh-watch-skeleton" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="lh-watch-card">
              <div className="lh-skeleton" style={{ height: 18, width: "55%", marginBottom: 10 }} />
              <div className="lh-skeleton" style={{ aspectRatio: "16/9", borderRadius: 12 }} />
            </div>
          ))}
        </div>
      )}

      {feed !== undefined && videoPosts.length === 0 && (
        <div className="lh-watch-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎬</div>
          <p style={{ margin: 0, fontWeight: 700 }}>No videos yet</p>
          <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--lh-text-3)" }}>
            Mentors and students will fill this up. Want to be first?
          </p>
          <Link href="/learnhub/feed#compose" className="lh-watch-cta">
            Post a video →
          </Link>
        </div>
      )}

      {feed !== undefined && videoPosts.length > 0 && (
        <div className="lh-watch-feed" ref={scrollerRef}>
          {videoPosts.map((post) => (
            <WatchCard
              key={post._id}
              post={post}
              muted={muted}
              scrollRoot={isReelsMode ? scrollerRef.current : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WatchCard({
  post,
  muted,
  scrollRoot,
}: {
  post: FeedPostWithAuthor;
  muted: boolean;
  scrollRoot: Element | null;
}) {
  const author = post.author;
  const authorName = author?.name ?? "Unknown";
  const avatar =
    author?.avatarUrl ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}&backgroundColor=5B6CFF&textColor=ffffff`;

  return (
    <article className="lh-watch-card">
      <header className="lh-watch-author">
        <img src={avatar} alt="" className="lh-watch-author-avatar" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="lh-watch-author-name">{authorName}</p>
          <p className="lh-watch-author-meta">
            {formatDistanceToNow(post.createdAt, { addSuffix: true })}
            {author?.role ? ` · ${author.role.replace("_", " ")}` : ""}
          </p>
        </div>
      </header>

      {post.content && <p className="lh-watch-caption">{post.content}</p>}

      {post.type === "video" ? (
        <UploadedVideoPlayer post={post} muted={muted} scrollRoot={scrollRoot} />
      ) : (
        <YouTubePreview post={post} />
      )}

      <footer className="lh-watch-actions">
        <button type="button" className="lh-watch-action">
          <Heart size={16} />
          <span>{post.likeCount ?? 0}</span>
        </button>
        <button type="button" className="lh-watch-action">
          <MessageCircle size={16} />
          <span>{post.commentCount ?? 0}</span>
        </button>
        <button
          type="button"
          className="lh-watch-action"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator
                .share({
                  title: post.content?.slice(0, 80) || "LearnHub video",
                  url: typeof window !== "undefined" ? window.location.origin + "/learnhub/feed" : "",
                })
                .catch(() => {});
            }
          }}
        >
          <Share2 size={16} />
          <span>Share</span>
        </button>
      </footer>
    </article>
  );
}

function UploadedVideoPlayer({
  post,
  muted,
  scrollRoot,
}: {
  post: FeedPostWithAuthor;
  muted: boolean;
  scrollRoot: Element | null;
}) {
  const m = (post.metadata ?? {}) as { storageId?: string; posterUrl?: string };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [visible, setVisible] = useState(false);

  const storageUrl = useQuery(
    api.learnhub_posts.getStorageUrl,
    m.storageId ? { storageId: m.storageId as Id<"_storage"> } : "skip",
  );
  const src = storageUrl ?? null;

  // Autoplay (muted) when the card is sufficiently in view; pause when
  // it leaves. In reels mode (scrollRoot set) we observe relative to the
  // scrolling snap container and use a higher threshold so only the
  // *snapped* card plays — the next card down the rail stays paused.
  // On desktop (scrollRoot=null) we keep the original 0.6 threshold
  // tracked against the viewport.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const isReels = Boolean(scrollRoot);
    const threshold = isReels ? 0.75 : 0.6;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            setVisible(true);
            el.play().then(() => setHasPlayed(true)).catch(() => {});
          } else {
            setVisible(false);
            if (!el.paused) el.pause();
          }
        }
      },
      { root: scrollRoot, threshold: [0, threshold, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src, scrollRoot]);

  // Reflect the global mute toggle on every player without re-attaching it.
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  if (!src) {
    return <div className="lh-skeleton" style={{ aspectRatio: "16/9", borderRadius: 12 }} />;
  }

  return (
    <div className="lh-watch-player" style={{ position: "relative" }}>
      <video
        ref={videoRef}
        src={src}
        poster={m.posterUrl}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        controls={hasPlayed && visible}
        onClick={(e) => {
          const el = e.currentTarget;
          if (el.paused) el.play().catch(() => {});
          else el.pause();
        }}
      />
      {!hasPlayed && (
        <span aria-hidden className="lh-watch-play-badge">
          <Play size={22} fill="white" stroke="white" />
        </span>
      )}
    </div>
  );
}

function YouTubePreview({ post }: { post: FeedPostWithAuthor }) {
  const m = (post.metadata ?? {}) as { videoId?: string; thumbnail?: string };
  const [embedded, setEmbedded] = useState(false);
  if (!m.videoId) return null;
  const thumb = m.thumbnail ?? `https://img.youtube.com/vi/${m.videoId}/maxresdefault.jpg`;

  if (embedded) {
    return (
      <div className="lh-watch-player">
        <iframe
          src={`https://www.youtube.com/embed/${m.videoId}?autoplay=1&playsinline=1`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ width: "100%", aspectRatio: "16/9", border: 0, display: "block", borderRadius: 12 }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEmbedded(true)}
      className="lh-watch-player"
      style={{
        position: "relative",
        padding: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
      }}
      aria-label="Play YouTube video"
    >
      <img
        src={thumb}
        alt=""
        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block", borderRadius: 12 }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${m.videoId}/hqdefault.jpg`;
        }}
      />
      <span aria-hidden className="lh-watch-play-badge">
        <Play size={22} fill="white" stroke="white" />
      </span>
    </button>
  );
}
