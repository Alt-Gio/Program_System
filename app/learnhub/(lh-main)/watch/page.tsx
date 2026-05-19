"use client";

/**
 * LearnHub Watch — Learning Theater.
 *
 * Implements the LearnHub.html design:
 *   • Desktop: TheaterFeed (16:9 player, max 1380px, scroll-snap, NOW
 *     PLAYING indicator, progress dots, NavArrow up/down, end-of-feed
 *     reflection card) + UpNextRail (380px, interest chips, thumbnail list).
 *   • Mobile: header w/ Interests button + chip strip, then iframe player,
 *     title/channel meta, UP NEXT thumbnail list.
 *   • InterestsModal — fullscreen blur backdrop, 560px, 2-col grid.
 *
 * Data: pulled from `api.learnhub_curated.listCuratedFeed` (only `kind ===
 * "video"` items). Each curated row maps to a `WatchItem` the components
 * read.
 *
 * The page calls `useSearchParams()` so the default export wraps the inner
 * component in a Suspense boundary — Next 14 requires this for prerender.
 */

import {
  Suspense, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// ── Design tokens (mirror LearnHub.html `Design Tokens` block) ──
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT = "#e8eaf4";
const MUTED = "rgba(185,190,230,0.6)";
const DIM = "rgba(100,110,165,0.5)";
const CARD = "#111323";
const CARD2 = "#161929";
const ORANGE = "#f97316";
const GREEN = "#22c55e";
const SKY = "#38bdf8";
const INDIGO = "#6366f1";

const WATCH_INTERESTS = [
  { id: "All",           label: "All",           emoji: "✨" },
  { id: "Cybersecurity", label: "Security",      emoji: "🔒" },
  { id: "CLOUD",         label: "Cloud",         emoji: "☁️" },
  { id: "TECH4ED",       label: "Tech4ED",       emoji: "💻" },
  { id: "SPARK",         label: "SPARK",         emoji: "⚡" },
  { id: "DWIA",          label: "DWIA",          emoji: "⚖️" },
  { id: "LEADERSHIP",    label: "Leadership",    emoji: "🧭" },
  { id: "AI",            label: "AI",            emoji: "🤖" },
  { id: "Data",          label: "Data",          emoji: "📊" },
  { id: "PROGRAMMING",   label: "Programming",   emoji: "⌨️" },
  { id: "UX",            label: "UX",            emoji: "🎨" },
  { id: "NEUROSCIENCE",  label: "Learning",      emoji: "🧠" },
] as const;

type WatchItemKind = "video" | "short" | "channel";

type WatchItem = {
  id: string;
  kind: WatchItemKind;
  // For video / short: YouTube video id.
  // For channel: empty string; use `channelTarget` for the YouTube URL.
  vid: string;
  channelTarget: string;          // Full YouTube URL for `kind === "channel"`.
  channelFocus?: "videos" | "shorts" | "both";
  title: string;
  description: string;
  duration: string;
  tags: string[];
  channelName: string;
  channelIni: string;
  channelColor: string;
  curatorName: string;
  curatorIni: string;
  curatorColor: string;
  curatorIsVerified: boolean;
  isFeatured: boolean;
};

// Pull the first two non-space characters out of a name as a fallback
// avatar initial. Matches the LearnHub.html `ini` field convention.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable hash → hue so each curator/org gets a consistent accent color.
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const palette = [ORANGE, GREEN, SKY, INDIGO, "#a855f7", "#ec4899", "#fbbf24"];
  return palette[Math.abs(h) % palette.length];
}

type CuratedDoc = Doc<"learnhub_org_curated_channels"> & {
  org: { id: Id<"learnhub_users">; name: string; isVerified: boolean } | null;
};

function mapCurated(doc: CuratedDoc): WatchItem | null {
  const orgName = doc.org?.name ?? "Curator";
  const color = colorFromName(orgName);
  const base = {
    id: doc._id as unknown as string,
    title: doc.displayName,
    description: doc.description ?? "",
    duration: doc.durationLabel ?? "",
    tags: doc.tags ?? [],
    channelName: orgName,
    channelIni: initials(orgName),
    channelColor: color,
    curatorName: orgName,
    curatorIni: initials(orgName),
    curatorColor: color,
    curatorIsVerified: !!doc.org?.isVerified,
    isFeatured: !!doc.isFeatured,
  };
  if (doc.kind === "video" && doc.youtubeVideoId) {
    const fmt = (doc.format ?? "video") === "short" ? "short" : "video";
    return {
      ...base,
      kind: fmt as WatchItemKind,
      vid: doc.youtubeVideoId,
      channelTarget: "",
    };
  }
  if (doc.kind === "channel" && doc.youtubeChannelId) {
    // Build the channel landing URL. @handles need a slash; UC ids go
    // through /channel/UC.... The watch card shows a deep-link CTA.
    const raw = doc.youtubeChannelId;
    let base2 = raw.startsWith("@") || raw.startsWith("UC")
      ? `https://www.youtube.com/${raw.startsWith("@") ? raw : "channel/" + raw}`
      : `https://www.youtube.com/${raw}`;
    const focus = doc.channelFocus ?? "videos";
    if (focus === "shorts") base2 += "/shorts";
    else if (focus === "videos") base2 += "/videos";
    return {
      ...base,
      kind: "channel" as WatchItemKind,
      vid: "",
      channelTarget: base2,
      channelFocus: focus,
    };
  }
  return null;
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", color: MUTED, fontSize: 13,
      }}>Loading…</div>
    }>
      <WatchPageInner />
    </Suspense>
  );
}

function WatchPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const initialInterest = (sp.get("interest") ?? "All").trim();
  const initialVid = (sp.get("v") ?? "").trim();

  const [interest, setInterestState] = useState<string>(
    WATCH_INTERESTS.some((i) => i.id === initialInterest) ? initialInterest : "All",
  );
  const [pickedInterests, setPickedInterests] = useState<Set<string>>(
    () => new Set(["Cybersecurity", "CLOUD", "TECH4ED"]),
  );
  const [showInterests, setShowInterests] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [jumpToken, setJumpToken] = useState<{ idx: number; ts: number }>({ idx: 0, ts: 0 });

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 980px)");
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Source data from Convex. We pull everything (videos + shorts +
  // channels) and let the UI filter; tiny orgs won't ever paginate beyond
  // this. Featured items get floated to the top server-side.
  const curated = useQuery(api.learnhub_curated.listCuratedFeed, { limit: 60 });

  const allVideos: WatchItem[] = useMemo(() => {
    if (!curated) return [];
    return (curated.items as CuratedDoc[])
      .map(mapCurated)
      .filter((v): v is WatchItem => v !== null);
  }, [curated]);

  const filtered: WatchItem[] = useMemo(() => {
    if (interest === "All") {
      if (pickedInterests.size === 0) return allVideos;
      // Float videos whose tags overlap pinned interests to the top.
      const copy = [...allVideos];
      copy.sort((a, b) => {
        const am = a.tags.some((t) => pickedInterests.has(t)) ? 0 : 1;
        const bm = b.tags.some((t) => pickedInterests.has(t)) ? 0 : 1;
        return am - bm;
      });
      return copy;
    }
    return allVideos.filter((v) => v.tags.includes(interest));
  }, [interest, pickedInterests, allVideos]);

  // Whenever the filter narrows, reset to the first matching video.
  useEffect(() => {
    setActiveIdx(0);
    setJumpToken({ idx: 0, ts: Date.now() });
  }, [interest]);

  // Deep-link: if the URL has `?v=<id>`, jump to that video once data lands.
  useEffect(() => {
    if (!initialVid || filtered.length === 0) return;
    const idx = filtered.findIndex((v) => v.vid === initialVid);
    if (idx >= 0 && idx !== activeIdx) {
      setActiveIdx(idx);
      setJumpToken({ idx, ts: Date.now() });
    }
    // We only run this once per filter-result-set arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVid, filtered.length]);

  // Reflect the active video into the URL so deep-link / share works.
  useEffect(() => {
    if (filtered.length === 0) return;
    const v = filtered[Math.min(activeIdx, filtered.length - 1)];
    if (!v) return;
    if (v.vid === initialVid) return;
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("v", v.vid);
    router.replace(`/learnhub/watch?${params.toString()}`, { scroll: false });
  }, [activeIdx, filtered, initialVid, router, sp]);

  const setInterest = useCallback((id: string) => {
    setInterestState(id);
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (id === "All") params.delete("interest");
    else params.set("interest", id);
    params.delete("v");
    const qs = params.toString();
    router.replace(qs ? `/learnhub/watch?${qs}` : "/learnhub/watch", { scroll: false });
  }, [router, sp]);

  const jumpToIdx = useCallback((i: number) => {
    setActiveIdx(i);
    setJumpToken({ idx: i, ts: Date.now() });
  }, []);

  // ─── Empty / loading ───
  if (curated === undefined) {
    return <div style={pageWrapperStyle()}>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: MUTED, fontSize: 13,
      }}>Loading curated videos…</div>
    </div>;
  }
  if (allVideos.length === 0) {
    return <div style={pageWrapperStyle()}>
      <EmptyState />
    </div>;
  }

  if (isMobile) {
    return (
      <div style={pageWrapperStyle()}>
        <MobileWatch
          videos={filtered}
          interest={interest}
          setInterest={setInterest}
          activeIdx={activeIdx}
          setActiveIdx={jumpToIdx}
          onOpenInterests={() => setShowInterests(true)}
        />
        {showInterests && (
          <InterestsModal
            picked={pickedInterests}
            setPicked={setPickedInterests}
            onClose={() => setShowInterests(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={pageWrapperStyle()}>
      <TheaterFeed
        videos={filtered}
        activeIdx={activeIdx}
        setActiveIdx={setActiveIdx}
        jumpToken={jumpToken}
        onJump={jumpToIdx}
        interest={interest}
        setInterest={setInterest}
      />
      <UpNextRail
        videos={filtered}
        activeIdx={activeIdx}
        onPick={jumpToIdx}
        interest={interest}
        setInterest={setInterest}
        pickedInterests={pickedInterests}
        onOpenInterests={() => setShowInterests(true)}
      />
      {showInterests && (
        <InterestsModal
          picked={pickedInterests}
          setPicked={setPickedInterests}
          onClose={() => setShowInterests(false)}
        />
      )}
      {/* Subtle global keyframes the design relies on. Scoped via <style>
          so they don't pollute the rest of LearnHub. */}
      <style>{`
        @keyframes lh-watch-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes lh-watch-fade  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .lh-watch-fade-in { animation: lh-watch-fade 0.32s ease both; }
        .lh-watch-noscroll::-webkit-scrollbar { display: none; }
        .lh-watch-noscroll { scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function pageWrapperStyle(): React.CSSProperties {
  return {
    flex: 1,
    display: "flex",
    height: "100%",
    minHeight: "calc(100dvh - 70px)",
    overflow: "hidden",
    background:
      "radial-gradient(120% 90% at 30% 0%, #0e1126 0%, #06070f 60%, #03040a 100%)",
    color: TEXT,
    fontFamily: "'Inter', sans-serif",
  };
}

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", padding: 40, color: MUTED, textAlign: "center", gap: 14,
    }}>
      <div style={{ fontSize: 42 }}>🎬</div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: TEXT }}>
        Nothing curated yet
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 480, color: MUTED }}>
        Org Partners surface YouTube videos here so learners stay in learning
        mode — not infinite-scroll mode.
      </p>
      <Link href="/learnhub/org/curate" style={{
        marginTop: 6, padding: "10px 22px", borderRadius: 999,
        background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
        color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none",
        boxShadow: `0 6px 18px ${ORANGE}55`,
      }}>
        Curate videos →
      </Link>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TheaterFeed — desktop, one-video-per-screen, snap-scroll
// ────────────────────────────────────────────────────────────────
function TheaterFeed({
  videos, activeIdx, setActiveIdx, jumpToken, onJump, interest, setInterest,
}: {
  videos: WatchItem[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  jumpToken: { idx: number; ts: number };
  onJump: (i: number) => void;
  interest: string;
  setInterest: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Smooth-scroll to the requested idx when jumpToken changes.
  useEffect(() => {
    if (!scrollerRef.current) return;
    const el = itemRefs.current[jumpToken.idx];
    if (el) scrollerRef.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, [jumpToken]);

  // Snap-driven activeIdx: whichever slide is most-visible becomes active.
  useEffect(() => {
    if (!scrollerRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      let best: IntersectionObserverEntry | null = null;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
      }
      if (best && best.intersectionRatio >= 0.55) {
        const idx = parseInt((best.target as HTMLElement).dataset.idx ?? "", 10);
        if (!Number.isNaN(idx)) setActiveIdx(idx);
      }
    }, { root: scrollerRef.current, threshold: [0.4, 0.6, 0.8] });
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [videos.length, setActiveIdx]);

  return (
    <div style={{ flex: 1, position: "relative", minWidth: 0, height: "100%" }}>
      {/* Top-gradient + NOW PLAYING indicator */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 64,
        background: "linear-gradient(to bottom, rgba(5,6,14,0.85), transparent)",
        pointerEvents: "none", zIndex: 5,
      }} />
      <div style={{
        position: "absolute", top: 18, left: 32, zIndex: 6,
        display: "flex", alignItems: "center", gap: 10, color: MUTED, fontSize: 12,
      }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.8, color: DIM }}>NOW PLAYING</span>
        <span style={{
          width: 5, height: 5, borderRadius: "50%", background: ORANGE,
          boxShadow: `0 0 8px ${ORANGE}`,
          animation: "lh-watch-pulse 2s ease-in-out infinite",
        }} />
        <span style={{ color: TEXT, fontWeight: 700 }}>{Math.min(activeIdx + 1, videos.length)}</span>
        <span style={{ color: DIM }}>/ {videos.length}</span>
        {interest !== "All" && (
          <>
            <span style={{ color: DIM, margin: "0 4px" }}>·</span>
            <button onClick={() => setInterest("All")} style={{
              padding: "3px 10px", borderRadius: 99, border: `1px solid ${ORANGE}55`,
              background: `${ORANGE}1c`, color: ORANGE, fontSize: 11, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
              <span>Filtered · {interestLabelFor(interest)}</span>
              <span style={{ fontSize: 13, lineHeight: 1 }}>×</span>
            </button>
          </>
        )}
      </div>

      {/* Left progress dots */}
      <div style={{
        position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", zIndex: 6,
        display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
      }}>
        {videos.slice(Math.max(0, activeIdx - 3), activeIdx + 4).map((v, j) => {
          const realIdx = Math.max(0, activeIdx - 3) + j;
          const isAct = realIdx === activeIdx;
          return (
            <button key={`${v.id}_${realIdx}`} onClick={() => onJump(realIdx)} style={{
              width: isAct ? 6 : 4, height: isAct ? 30 : 16, borderRadius: 3, border: "none",
              background: isAct ? ORANGE : "rgba(255,255,255,0.18)",
              boxShadow: isAct ? `0 0 10px ${ORANGE}88` : "none",
              cursor: "pointer", transition: "all 0.22s", padding: 0,
            }} title={v.title} aria-label={`Jump to ${v.title}`} />
          );
        })}
      </div>

      <NavArrow dir="up" onClick={() => activeIdx > 0 && onJump(activeIdx - 1)} disabled={activeIdx === 0} />
      <NavArrow dir="down" onClick={() => activeIdx < videos.length - 1 && onJump(activeIdx + 1)} disabled={activeIdx >= videos.length - 1} />

      <div ref={scrollerRef} className="lh-watch-noscroll" style={{
        height: "100%", overflowY: "auto", scrollSnapType: "y mandatory",
      }}>
        {videos.map((v, i) => (
          <section
            key={v.id}
            ref={(el) => { itemRefs.current[i] = el; }}
            data-idx={i}
            style={{
              height: "100%", minHeight: "100%",
              scrollSnapAlign: "start", scrollSnapStop: "always",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "40px 84px 36px 64px",
            }}
          >
            <TheaterPlayer v={v} isActive={i === activeIdx} />
          </section>
        ))}
        <section style={{
          height: "100%", minHeight: "100%", scrollSnapAlign: "start",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 84px",
        }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>🎓</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: TEXT, marginBottom: 10 }}>
              You&rsquo;ve reached the end
            </div>
            <div style={{ fontSize: 14, color: MUTED, marginBottom: 22, lineHeight: 1.6 }}>
              Productive learning beats endless scrolling. Take a moment to
              reflect on what you watched — or pick a new interest to dive into.
            </div>
            <button onClick={() => onJump(0)} style={{
              padding: "10px 20px", borderRadius: 99, border: `1px solid ${ORANGE}55`,
              background: `${ORANGE}1c`, color: ORANGE, fontSize: 13, fontWeight: 700,
              cursor: "pointer",
            }}>↑ Back to top</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function interestLabelFor(id: string): string {
  return WATCH_INTERESTS.find((i) => i.id === id)?.label ?? id;
}

function NavArrow({ dir, onClick, disabled }: { dir: "up" | "down"; onClick: () => void; disabled: boolean }) {
  const [hov, setHov] = useState(false);
  const isUp = dir === "up";
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      aria-label={isUp ? "Previous video" : "Next video"}
      style={{
        position: "absolute", right: 26, [isUp ? "top" : "bottom"]: 28, zIndex: 7,
        width: 48, height: 48, borderRadius: "50%", border: `1px solid ${BORDER2}`,
        background: hov && !disabled ? `${ORANGE}22` : "rgba(13,16,32,0.7)",
        backdropFilter: "blur(12px)",
        color: disabled ? DIM : (hov ? ORANGE : TEXT),
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", transition: "all 0.18s",
        boxShadow: hov && !disabled ? `0 8px 24px ${ORANGE}44` : "0 6px 18px rgba(0,0,0,0.4)",
        opacity: disabled ? 0.4 : 1, padding: 0,
      } as React.CSSProperties}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {isUp ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// TheaterPlayer — the centered 16:9 player + meta
// ────────────────────────────────────────────────────────────────
function TheaterPlayer({ v, isActive }: { v: WatchItem; isActive: boolean }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const isShort = v.kind === "short";
  const isChannel = v.kind === "channel";
  const playerAspect = isShort ? "9 / 16" : "16 / 9";
  const playerMaxWidth = isShort ? 380 : 1380;
  const thumb = `https://i.ytimg.com/vi/${v.vid}/maxresdefault.jpg`;
  const fallback = `https://i.ytimg.com/vi/${v.vid}/hqdefault.jpg`;
  const embed = `https://www.youtube.com/embed/${v.vid}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className={isActive ? "lh-watch-fade-in" : ""} style={{
      width: "100%", maxWidth: 1380,
      display: "flex", flexDirection: "column", gap: 16,
      alignItems: isShort ? "center" : "stretch",
    }}>
      {isChannel ? (
        <ChannelLanding v={v} isActive={isActive} />
      ) : (
        <div style={{
          position: "relative", width: "100%", maxWidth: playerMaxWidth,
          aspectRatio: playerAspect,
          borderRadius: 20, overflow: "hidden", background: "#000",
          boxShadow: isActive
            ? `0 36px 100px rgba(0,0,0,0.65), 0 0 0 1px ${BORDER2}, 0 0 70px ${ORANGE}22`
            : `0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px ${BORDER}`,
          transition: "box-shadow 0.4s",
        }}>
          {isActive ? (
            <iframe
              key={v.id}
              src={embed}
              title={v.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "#10121e" }}>
              <img src={thumb}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0,
                background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)" }} />
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: 84, height: 84, borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)",
                  border: "2px solid rgba(255,255,255,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, color: "white",
                }}>▶</div>
              </div>
              {v.duration && (
                <div style={{
                  position: "absolute", bottom: 14, right: 14,
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: "rgba(0,0,0,0.7)", color: "white",
                }}>{v.duration}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 22, alignItems: "start", width: "100%", maxWidth: isShort ? 760 : undefined }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {v.isFeatured && (
              <span style={{
                fontSize: 9.5, fontWeight: 900, letterSpacing: 1, padding: "3px 9px",
                borderRadius: 5, background: "#fbbf24", color: "#06070f",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>★ FEATURED</span>
            )}
            {v.tags.map((c) => (
              <span key={c} style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: 1, padding: "3px 8px",
                borderRadius: 5, background: "rgba(255,255,255,0.06)", color: MUTED,
                border: `1px solid ${BORDER}`,
              }}>{c}</span>
            ))}
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 1, padding: "3px 8px",
              borderRadius: 5,
              background: isShort ? "#fbbf241c" : isChannel ? `${SKY}1c` : `${ORANGE}1c`,
              color: isShort ? "#fbbf24" : isChannel ? SKY : ORANGE,
              border: `1px solid ${(isShort ? "#fbbf24" : isChannel ? SKY : ORANGE)}33`,
            }}>{isShort ? "⚡ SHORT" : isChannel ? "📺 CHANNEL" : `▶ YOUTUBE${v.duration ? ` · ${v.duration}` : ""}`}</span>
          </div>
          <h2 style={{
            fontSize: 26, fontWeight: 700, color: TEXT, lineHeight: 1.22, margin: "0 0 10px",
            fontFamily: "'DM Serif Display', serif", letterSpacing: -0.5,
          }}>{v.title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Av ini={v.channelIni} size={26} color={v.channelColor} />
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{v.channelName}</span>
          </div>
          {v.description && (
            <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, maxWidth: 820 }}>
              {v.description}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 99,
            background: `linear-gradient(135deg, ${v.curatorColor}22, ${v.curatorColor}10)`,
            border: `1px solid ${v.curatorColor}33`,
          }}>
            <Av ini={v.curatorIni} size={22} color={v.curatorColor} />
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 10, color: DIM, fontWeight: 600 }}>Curated by</div>
              <div style={{ fontSize: 12, color: TEXT, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {v.curatorName}
                {v.curatorIsVerified && <span title="Verified Org" style={{ color: SKY }}>✓</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <ActionBtn icon="❤" label={liked ? "Liked" : "Like"} active={liked} onClick={() => setLiked(!liked)} hue="#fb7185" />
            <ActionBtn icon="🔖" label={saved ? "Saved" : "Save"} active={saved} onClick={() => setSaved(!saved)} hue={ORANGE} />
            <ActionBtn icon="↗" label="Share" onClick={async () => {
              const url = typeof window !== "undefined" ? window.location.href : "";
              if (typeof navigator !== "undefined" && navigator.share) {
                try { await navigator.share({ title: v.title, url }); } catch { /* user dismissed */ }
              } else if (typeof navigator !== "undefined") {
                try { await navigator.clipboard.writeText(url); } catch { /* swallow */ }
              }
            }} hue={SKY} />
          </div>
          <a
            href={isChannel ? v.channelTarget : `https://www.youtube.com/watch?v=${v.vid}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 11.5, color: DIM, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 5,
            }}>
            {isChannel ? `Browse on YouTube${v.channelFocus === "shorts" ? " · Shorts" : ""}` : "Open on YouTube"}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M10 7h7v7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

function ChannelLanding({ v, isActive }: { v: WatchItem; isActive: boolean }) {
  // We can't iframe an entire YouTube channel — embeds are per-video. So
  // channel entries surface as a big deep-link card that opens YouTube's
  // /videos or /shorts page for that channel in a new tab.
  const focus = v.channelFocus ?? "videos";
  return (
    <div style={{
      width: "100%", maxWidth: 1080,
      aspectRatio: "16 / 9",
      borderRadius: 20,
      background: `radial-gradient(120% 90% at 30% 0%, ${v.channelColor}33 0%, #10121e 70%)`,
      border: `1px solid ${v.channelColor}55`,
      boxShadow: isActive
        ? `0 36px 100px rgba(0,0,0,0.65), 0 0 70px ${v.channelColor}22`
        : `0 18px 50px rgba(0,0,0,0.45)`,
      display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      padding: 40, textAlign: "center", gap: 18,
      transition: "box-shadow 0.4s",
    }}>
      <span style={{
        width: 96, height: 96, borderRadius: "50%",
        background: `linear-gradient(135deg, ${v.channelColor}, ${v.channelColor}99)`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 900, fontSize: 32, letterSpacing: 1,
        boxShadow: `0 18px 40px ${v.channelColor}55`,
      }}>{v.channelIni}</span>
      <div>
        <div style={{
          fontFamily: "'DM Serif Display', serif", fontSize: 32, color: TEXT,
          letterSpacing: -0.6,
        }}>{v.title}</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
          Curated channel · focuses on {focus}
        </div>
      </div>
      {v.description && (
        <p style={{ maxWidth: 540, fontSize: 13.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>
          {v.description}
        </p>
      )}
      <a
        href={v.channelTarget}
        target="_blank" rel="noopener noreferrer"
        style={{
          padding: "12px 22px", borderRadius: 999, marginTop: 6,
          background: `linear-gradient(135deg, ${v.channelColor}, ${v.channelColor}cc)`,
          color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none",
          boxShadow: `0 6px 20px ${v.channelColor}66`,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
        {focus === "shorts" ? "Browse Shorts on YouTube" : focus === "both" ? "Browse channel on YouTube" : "Browse videos on YouTube"} →
      </a>
    </div>
  );
}

function Av({ ini, size, color }: { ini: string; size: number; color: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${color}, ${color}99)`,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 800, fontSize: Math.max(10, Math.round(size * 0.42)),
      letterSpacing: 0.3, flexShrink: 0,
    }}>{ini}</span>
  );
}

function ActionBtn({
  icon, label, active, onClick, hue,
}: {
  icon: string; label: string; active?: boolean; onClick: () => void; hue: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 99,
        border: `1px solid ${active ? hue + "66" : BORDER2}`,
        background: active ? `${hue}1f` : (hov ? "rgba(255,255,255,0.05)" : "transparent"),
        color: active ? hue : (hov ? TEXT : MUTED),
        fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.18s",
      }}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// UpNextRail — right-hand 380px column with interest chips + cards
// ────────────────────────────────────────────────────────────────
function UpNextRail({
  videos, activeIdx, onPick, interest, setInterest, pickedInterests, onOpenInterests,
}: {
  videos: WatchItem[];
  activeIdx: number;
  onPick: (i: number) => void;
  interest: string;
  setInterest: (id: string) => void;
  pickedInterests: Set<string>;
  onOpenInterests: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = itemRefs.current[activeIdx];
    if (el && scrollerRef.current) {
      const r = el.offsetTop - 110;
      scrollerRef.current.scrollTo({ top: Math.max(0, r), behavior: "smooth" });
    }
  }, [activeIdx]);

  return (
    <aside style={{
      width: 380, flexShrink: 0, height: "100%",
      borderLeft: `1px solid ${BORDER}`,
      background: "linear-gradient(180deg, rgba(13,16,32,0.92), rgba(8,10,20,0.96))",
      backdropFilter: "blur(14px)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "18px 18px 12px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.6, color: ORANGE }}>UP NEXT</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>
              {videos.length} curated · {interest === "All" ? "all interests" : interestLabelFor(interest)}
            </div>
          </div>
          <button onClick={onOpenInterests} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", borderRadius: 10,
            background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
            border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
            boxShadow: `0 6px 16px ${ORANGE}44`,
          }} title="Customize interests">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M6 12h12M10 18h4" />
            </svg>
            <span>Interests</span>
          </button>
        </div>
        <div className="lh-watch-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {WATCH_INTERESTS.map((it) => {
            const active = interest === it.id;
            const pinned = pickedInterests.has(it.id);
            return (
              <button key={it.id} onClick={() => setInterest(it.id)} style={{
                flexShrink: 0, padding: "6px 10px", borderRadius: 99,
                border: `1px solid ${active ? ORANGE + "66" : (pinned ? BORDER2 : BORDER)}`,
                background: active ? `${ORANGE}1c` : (pinned ? "rgba(255,255,255,0.05)" : "transparent"),
                color: active ? ORANGE : (pinned ? TEXT : MUTED),
                fontSize: 11.5, fontWeight: active ? 700 : 600,
                cursor: "pointer", transition: "all 0.18s",
                display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
              }}>
                <span style={{ fontSize: 11 }}>{it.emoji}</span>
                <span>{it.label}</span>
                {pinned && !active && <span style={{ width: 4, height: 4, borderRadius: "50%", background: ORANGE }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollerRef} className="lh-watch-noscroll" style={{
        flex: 1, overflowY: "auto", padding: "12px 12px 24px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {videos.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: DIM, fontSize: 13 }}>
            No videos match this interest.<br />
            <button onClick={() => setInterest("All")} style={{
              marginTop: 14, padding: "8px 16px", borderRadius: 99, border: `1px solid ${BORDER2}`,
              background: "transparent", color: ORANGE, fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>See all</button>
          </div>
        ) : videos.map((v, i) => (
          <div key={v.id} ref={(el) => { itemRefs.current[i] = el; }}>
            <UpNextCard v={v} active={i === activeIdx} onClick={() => onPick(i)} order={i + 1} />
          </div>
        ))}
      </div>
    </aside>
  );
}

function UpNextCard({
  v, active, onClick, order,
}: {
  v: WatchItem; active: boolean; onClick: () => void; order: number;
}) {
  const [hov, setHov] = useState(false);
  const isChannel = v.kind === "channel";
  const isShort = v.kind === "short";
  const thumb = v.vid
    ? `https://i.ytimg.com/vi/${v.vid}/mqdefault.jpg`
    : "";
  const fallback = v.vid
    ? `https://i.ytimg.com/vi/${v.vid}/hqdefault.jpg`
    : "";
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: 8, borderRadius: 12,
        border: `1px solid ${active ? ORANGE + "55" : (hov ? BORDER2 : "transparent")}`,
        background: active
          ? `linear-gradient(135deg, ${ORANGE}1a, ${ORANGE}08)`
          : (hov ? "rgba(255,255,255,0.04)" : "transparent"),
        cursor: "pointer", transition: "all 0.18s",
        display: "grid", gridTemplateColumns: "150px 1fr", gap: 11,
        textAlign: "left", alignItems: "start",
      }}>
      <div style={{
        position: "relative", width: "100%", aspectRatio: "16 / 9",
        borderRadius: 8, overflow: "hidden", background: "#10121e", flexShrink: 0,
        boxShadow: active ? `0 6px 18px ${ORANGE}33` : "none",
      }}>
        {isChannel ? (
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(135deg, ${v.channelColor}55, ${v.channelColor}18)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 28, fontWeight: 900, letterSpacing: 1,
          }}>{v.channelIni}</div>
        ) : (
          <img src={thumb}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {v.duration && !isChannel && (
          <span style={{
            position: "absolute", bottom: 4, right: 4,
            padding: "1px 5px", borderRadius: 3, fontSize: 9.5, fontWeight: 700,
            background: "rgba(0,0,0,0.85)", color: "white",
          }}>{v.duration}</span>
        )}
        {(isShort || isChannel || v.isFeatured) && (
          <span style={{
            position: "absolute", top: 4, left: 4,
            padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
            background: v.isFeatured ? "#fbbf24" : isShort ? "#fbbf24cc" : `${SKY}cc`,
            color: "#06070f",
          }}>{v.isFeatured ? "★ FEATURED" : isShort ? "⚡ SHORT" : "📺 CHANNEL"}</span>
        )}
        {active && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 9px", borderRadius: 99,
              background: ORANGE, color: "white",
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%", background: "white",
                animation: "lh-watch-pulse 1.4s ease-in-out infinite",
              }} />
              PLAYING
            </div>
          </div>
        )}
        {!active && hov && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)",
              border: "1.5px solid rgba(255,255,255,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "white",
            }}>▶</div>
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, paddingTop: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: DIM, letterSpacing: 0.8 }}>
            #{String(order).padStart(2, "0")}
          </span>
          {v.tags[0] && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 0.8, padding: "1px 6px",
              borderRadius: 4, background: "rgba(255,255,255,0.06)", color: MUTED,
            }}>{v.tags[0]}</span>
          )}
        </div>
        <div style={{
          fontSize: 12.5, fontWeight: 700, lineHeight: 1.32,
          color: active ? TEXT : (hov ? TEXT : "#cdd2e6"),
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", marginBottom: 5,
        }}>{v.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <Av ini={v.channelIni} size={15} color={v.channelColor} />
          <span style={{
            fontSize: 11, color: MUTED, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{v.channelName}</span>
        </div>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// InterestsModal — fullscreen blur backdrop with a 2-col grid
// ────────────────────────────────────────────────────────────────
function InterestsModal({
  picked, setPicked, onClose,
}: {
  picked: Set<string>;
  setPicked: (s: Set<string>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(new Set(picked));
  const toggle = (id: string) => {
    const next = new Set(draft);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDraft(next);
  };
  const save = () => { setPicked(draft); onClose(); };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, background: "rgba(3,4,10,0.78)",
      backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: "40px 20px",
      animation: "lh-watch-fade 0.22s ease both",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="lh-watch-fade-in" style={{
        width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto",
        background: `linear-gradient(180deg, ${CARD2}, ${CARD})`,
        borderRadius: 20, border: `1px solid ${BORDER2}`,
        boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
        padding: "24px 26px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: TEXT, marginBottom: 4 }}>
              What do you want to learn?
            </div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, maxWidth: 420 }}>
              Pick a few interests. We&rsquo;ll surface videos curated by your
              mentors in those areas — no doom-scrolling, no shorts.
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", border: `1px solid ${BORDER2}`,
            background: "transparent", color: MUTED, cursor: "pointer",
            fontSize: 16, lineHeight: 1, flexShrink: 0,
          }}>×</button>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {WATCH_INTERESTS.filter((i) => i.id !== "All").map((it) => {
            const on = draft.has(it.id);
            return (
              <button key={it.id} onClick={() => toggle(it.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 12,
                border: `1px solid ${on ? ORANGE + "55" : BORDER}`,
                background: on ? `${ORANGE}14` : "rgba(255,255,255,0.025)",
                color: on ? TEXT : MUTED,
                cursor: "pointer", transition: "all 0.16s",
                fontSize: 13, fontWeight: on ? 700 : 600, textAlign: "left",
              }}>
                <span style={{ fontSize: 18 }}>{it.emoji}</span>
                <span style={{ flex: 1 }}>{it.label}</span>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: `1.5px solid ${on ? ORANGE : BORDER2}`,
                  background: on ? ORANGE : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 11, fontWeight: 900,
                }}>{on ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>

        <div style={{
          marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ fontSize: 12, color: DIM }}>{draft.size} selected</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              padding: "10px 18px", borderRadius: 99, border: `1px solid ${BORDER2}`,
              background: "transparent", color: MUTED,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={save} style={{
              padding: "10px 22px", borderRadius: 99, border: "none",
              background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
              color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 6px 18px ${ORANGE}55`,
            }}>Save interests</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// MobileWatch — single iframe + UP NEXT list, no theater chrome
// ────────────────────────────────────────────────────────────────
function MobileWatch({
  videos, interest, setInterest, activeIdx, setActiveIdx, onOpenInterests,
}: {
  videos: WatchItem[];
  interest: string;
  setInterest: (id: string) => void;
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  onOpenInterests: () => void;
}) {
  const v = videos[Math.min(activeIdx, videos.length - 1)] || videos[0];
  if (!v) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, padding: 30 }}>
        No videos match this interest.
      </div>
    );
  }
  const embed = `https://www.youtube.com/embed/${v.vid}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden", background: "#06070f",
    }}>
      <div style={{
        padding: "12px 14px 10px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button onClick={onOpenInterests} style={{
          padding: "7px 12px", borderRadius: 99,
          background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
          border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          boxShadow: `0 4px 14px ${ORANGE}44`,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
          Interests
        </button>
        <div className="lh-watch-noscroll" style={{ display: "flex", gap: 5, overflowX: "auto", flex: 1 }}>
          {WATCH_INTERESTS.slice(0, 6).map((it) => {
            const active = interest === it.id;
            return (
              <button key={it.id} onClick={() => { setInterest(it.id); setActiveIdx(0); }} style={{
                flexShrink: 0, padding: "5px 10px", borderRadius: 99,
                border: `1px solid ${active ? ORANGE + "66" : BORDER}`,
                background: active ? `${ORANGE}1c` : "transparent",
                color: active ? ORANGE : MUTED,
                fontSize: 11, fontWeight: active ? 700 : 600, cursor: "pointer", whiteSpace: "nowrap",
              }}>{it.emoji} {it.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: "14px 14px 6px", background: "#06070f" }}>
        <div style={{
          position: "relative", width: "100%", aspectRatio: "16 / 9",
          borderRadius: 14, overflow: "hidden", background: "#000",
          boxShadow: `0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px ${BORDER2}`,
        }}>
          <iframe key={v.id} src={embed} title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
        </div>
        <div style={{ padding: "12px 2px 6px" }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: TEXT, lineHeight: 1.3, marginBottom: 6,
            fontFamily: "'DM Serif Display', serif",
          }}>{v.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: MUTED }}>
            <Av ini={v.channelIni} size={18} color={v.channelColor} />
            <span style={{ fontWeight: 600 }}>{v.channelName}</span>
          </div>
        </div>
      </div>

      <div className="lh-watch-noscroll" style={{ flex: 1, overflowY: "auto", padding: "10px 12px 24px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, color: ORANGE, padding: "6px 4px 10px" }}>UP NEXT</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {videos.map((vv, i) => (
            <UpNextCard key={vv.id} v={vv} active={i === activeIdx}
              onClick={() => setActiveIdx(i)} order={i + 1} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes lh-watch-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes lh-watch-fade  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .lh-watch-fade-in { animation: lh-watch-fade 0.32s ease both; }
        .lh-watch-noscroll::-webkit-scrollbar { display: none; }
        .lh-watch-noscroll { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
