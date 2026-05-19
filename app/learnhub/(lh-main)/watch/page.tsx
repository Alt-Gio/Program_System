"use client";

/**
 * LearnHub Watch — curated, scroll-snap, one-video-per-viewport.
 *
 * Sourcing:
 *   • Org Partners curate YouTube channels/videos via /learnhub/org/curate.
 *   • This page reads the active feed from `learnhub_curated.listCuratedFeed`,
 *     ordered newest-first with optional org filter and cursor pagination.
 *
 * Layout:
 *   • Desktop (≥769px) → `.lh-watch--theater`. Every "slide" is 100dvh and
 *     contains a centered 16:9 YouTube embed (max ~760px). Scrolling moves
 *     to the next curated video; one video fills the viewport at a time.
 *   • Mobile (≤768px)  → `.lh-watch--reels`. Same scroll-snap mental model,
 *     vertical (9:16-ish) YouTube embed, taller card. Identical key bindings.
 *
 * URL state:
 *   • `?v=<youtubeId>` — restores the currently-snapped video on deep-link.
 *   • `?org=<orgId>`   — narrows the feed to a single curating org.
 *
 * Keyboard: ↓ / PageDown → next, ↑ / PageUp → previous. Both layouts.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

type CuratedItem = Doc<"learnhub_org_curated_channels"> & {
  org: { id: Id<"learnhub_users">; name: string; isVerified: boolean } | null;
};

// `useSearchParams()` opts the page into client-side rendering, which
// Next 14 only permits inside a Suspense boundary during prerender. The
// inner component holds the watch surface; the outer default-export
// wraps it. Without the wrap, `next build` fails with the
// missing-suspense-with-csr-bailout error.
export default function WatchPage() {
  return (
    <Suspense fallback={<div className="lh-watch lh-watch--theater" aria-busy="true" />}>
      <WatchPageInner />
    </Suspense>
  );
}

function WatchPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const activeOrg = (sp.get("org") ?? "").trim() || null;
  const activeVideoParam = (sp.get("v") ?? "").trim() || null;

  // Layout detection — desktop theater vs. mobile reels. Same scroll-snap
  // mechanics in both; only the inner aspect ratio differs.
  const [isReels, setIsReels] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsReels(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const orgs = useQuery(api.learnhub_curated.listCuratingOrgs, {});

  // Pull the first 50 items. Pagination kicks in only when we approach the
  // bottom; most viewers won't exceed a single page.
  const curated = useQuery(api.learnhub_curated.listCuratedFeed, {
    limit: 50,
    orgId: activeOrg ? (activeOrg as Id<"learnhub_users">) : undefined,
  });

  // Surface only the videos. Channels don't yield watchable items until we
  // wire a real YouTube API integration (deferred); we still show channel
  // entries in the management page so the curator's intent isn't lost.
  const videos = useMemo<CuratedItem[]>(() => {
    if (!curated) return [];
    return (curated.items as CuratedItem[]).filter(
      (i) => i.kind === "video" && !!i.youtubeVideoId,
    );
  }, [curated]);

  // Scroll-snap container + per-card refs. The container is the scroll root
  // for the IntersectionObserver that watches which card is in view; that
  // observer updates `currentVideoId`, which keeps `?v=` in sync.
  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  // Sync `currentVideoId` from whichever card is snapped (≥60% in view).
  useEffect(() => {
    const root = railRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the largest intersectionRatio that's snapped.
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (!best) return;
        const id = (best.target as HTMLElement).dataset.videoId ?? null;
        if (id) setCurrentVideoId(id);
      },
      { root, threshold: [0.6, 0.9] },
    );
    for (const el of Array.from(cardRefs.current.values())) io.observe(el);
    return () => io.disconnect();
  }, [videos]);

  // When `currentVideoId` changes, reflect it into `?v=`. We avoid pushing
  // a fresh history entry per scroll — replace keeps the back button useful.
  useEffect(() => {
    if (!currentVideoId) return;
    if (currentVideoId === activeVideoParam) return;
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("v", currentVideoId);
    router.replace(`/learnhub/watch?${params.toString()}`, { scroll: false });
  }, [currentVideoId, activeVideoParam, router, sp]);

  // Deep-link restore: when the page first loads with `?v=<id>`, scroll the
  // matching card into view. We only do this once per param change.
  useEffect(() => {
    if (!activeVideoParam || videos.length === 0) return;
    const el = cardRefs.current.get(activeVideoParam);
    if (el) el.scrollIntoView({ block: "start", behavior: "auto" });
  }, [activeVideoParam, videos]);

  const advance = useCallback((direction: 1 | -1) => {
    const ids = videos.map((v) => v.youtubeVideoId!).filter(Boolean);
    if (ids.length === 0) return;
    const idx = currentVideoId ? ids.indexOf(currentVideoId) : 0;
    const next = Math.max(0, Math.min(ids.length - 1, idx + direction));
    const target = cardRefs.current.get(ids[next]);
    if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [videos, currentVideoId]);

  // Keyboard navigation. We only intercept when the watch surface has focus
  // (or no editable element does) so typing in a search field elsewhere on
  // the page isn't hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        advance(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        advance(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  const setOrgFilter = useCallback((orgId: string | null) => {
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (orgId) params.set("org", orgId);
    else params.delete("org");
    params.delete("v"); // changing filter invalidates the v= anchor
    const qs = params.toString();
    router.push(qs ? `/learnhub/watch?${qs}` : "/learnhub/watch");
  }, [router, sp]);

  return (
    <div className={`lh-watch ${isReels ? "lh-watch--reels" : "lh-watch--theater"}`}>
      {/* Top chip strip — curating orgs as filter pills */}
      {orgs && orgs.length > 0 && (
        <div className="lh-watch-filterbar" role="toolbar" aria-label="Filter videos by curating organization">
          <button
            type="button"
            className={`lh-watch-chip${!activeOrg ? " is-active" : ""}`}
            onClick={() => setOrgFilter(null)}
          >
            All curators
          </button>
          {orgs.map((o) => (
            <button
              key={o.id as string}
              type="button"
              className={`lh-watch-chip${activeOrg === (o.id as string) ? " is-active" : ""}`}
              onClick={() => setOrgFilter(o.id as string)}
              title={`${o.count} video${o.count === 1 ? "" : "s"}`}
            >
              <span>{o.name}</span>
              {o.isVerified && <CheckCircle2 size={12} className="lh-watch-verified" />}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {curated === undefined && (
        <div className="lh-watch-rail" aria-busy="true">
          <div className="lh-watch-slide">
            <div className="lh-watch-slide-inner">
              <div className="lh-skeleton" style={{ aspectRatio: isReels ? "9/16" : "16/9", width: "100%", maxWidth: 760, borderRadius: 14 }} />
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {curated !== undefined && videos.length === 0 && (
        <div className="lh-watch-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎬</div>
          <p style={{ margin: 0, fontWeight: 700 }}>Nothing curated yet</p>
          <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--lh-text-3)" }}>
            Org Partners surface YouTube content here so learners stay in
            learning mode — not infinite scroll mode.
          </p>
          <Link href="/learnhub/org/curate" className="lh-watch-cta">
            Curate videos →
          </Link>
        </div>
      )}

      {/* The snap rail — both desktop and mobile share this scaffolding */}
      {videos.length > 0 && (
        <div ref={railRef} className="lh-watch-rail">
          {videos.map((item, idx) => (
            <TheaterSlide
              key={item._id as string}
              item={item}
              isReels={isReels}
              setRef={setCardRef(item.youtubeVideoId!)}
              isFirst={idx === 0}
              isLast={idx === videos.length - 1}
              onAdvance={advance}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TheaterSlide({
  item,
  isReels,
  setRef,
  isFirst,
  isLast,
  onAdvance,
}: {
  item: CuratedItem;
  isReels: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  isFirst: boolean;
  isLast: boolean;
  onAdvance: (direction: 1 | -1) => void;
}) {
  const videoId = item.youtubeVideoId!;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <section
      ref={setRef}
      data-video-id={videoId}
      className="lh-watch-slide"
    >
      <div className="lh-watch-slide-inner">
        <div className={`lh-watch-player${isReels ? " is-reels" : ""}`}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
            title={item.displayName}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div className="lh-watch-meta">
          <h2 className="lh-watch-meta-title">{item.displayName}</h2>
          {item.org && (
            <p className="lh-watch-meta-org">
              <span>Curated by {item.org.name}</span>
              {item.org.isVerified && <CheckCircle2 size={13} className="lh-watch-verified" />}
            </p>
          )}
          {item.description && (
            <p className="lh-watch-meta-desc">{item.description}</p>
          )}

          <div className="lh-watch-meta-actions">
            <a
              href={watchUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="lh-watch-meta-link"
            >
              Open on YouTube <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Inline nav affordances — visible at all times so the scroll-snap
            behavior is discoverable. Disabled at the ends. */}
        <div className="lh-watch-nav">
          <button
            type="button"
            onClick={() => onAdvance(-1)}
            disabled={isFirst}
            className="lh-watch-nav-btn"
            aria-label="Previous video"
            title="Previous (↑)"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => onAdvance(1)}
            disabled={isLast}
            className="lh-watch-nav-btn"
            aria-label="Next video"
            title="Next (↓)"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
