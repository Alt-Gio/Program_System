"use client";

/**
 * Org Partner / Coordinator — curate content for /learnhub/watch.
 *
 * Three add modes:
 *   • VIDEO   — paste a long-form YouTube video URL. Renders 16:9.
 *   • SHORT   — paste a YouTube Shorts URL. Renders 9:16.
 *   • CHANNEL — bookmark a channel. Watch surfaces a deep-link card to
 *     YouTube's channel page (videos or shorts), since auto-pulling a
 *     channel's content needs a YouTube API key we don't have yet.
 *
 * Each row has a HIGHLIGHT toggle that floats the item to the top of
 * /learnhub/watch with a "FEATURED" badge.
 *
 * Important: every React hook in this component is declared before any
 * conditional `return`. The previous version had a `useMemo` after an
 * auth/loading early-return, which violated rules of hooks and threw
 * React #310 the moment Convex data arrived.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft, CheckCircle2, Eye, EyeOff, Info, Link as LinkIcon,
  PlusCircle, RefreshCw, Star, Trash2, Video as VideoIcon, Zap, Youtube,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import {
  extractYouTubeId, extractYouTubeChannelId,
} from "@/components/learnhub/video-flow/utils";

const ORANGE = "#f97316";
const GREEN = "#22c55e";
const RED = "#ef4444";
const INDIGO = "#6366f1";
const SKY = "#38bdf8";
const AMBER = "#fbbf24";

const WATCH_INTEREST_TAGS = [
  { id: "Cybersecurity", label: "Security",    emoji: "🔒" },
  { id: "CLOUD",         label: "Cloud",       emoji: "☁️" },
  { id: "TECH4ED",       label: "Tech4ED",     emoji: "💻" },
  { id: "SPARK",         label: "SPARK",       emoji: "⚡" },
  { id: "DWIA",          label: "DWIA",        emoji: "⚖️" },
  { id: "LEADERSHIP",    label: "Leadership",  emoji: "🧭" },
  { id: "AI",            label: "AI",          emoji: "🤖" },
  { id: "Data",          label: "Data",        emoji: "📊" },
  { id: "PROGRAMMING",   label: "Programming", emoji: "⌨️" },
  { id: "UX",            label: "UX",          emoji: "🎨" },
  { id: "NEUROSCIENCE",  label: "Learning",    emoji: "🧠" },
] as const;

type AddMode = "video" | "short" | "channel";
type ChannelFocus = "videos" | "shorts" | "both";

export default function OrgCuratePage() {
  // ── Hooks (ALL at the top, before any conditional return) ──
  const { userId, role, loading } = useLearnhubSession();
  const items = useQuery(
    api.learnhub_curated.orgListCurated,
    userId ? { actorId: userId as Id<"learnhub_users"> } : "skip",
  );
  const addVideo = useMutation(api.learnhub_curated.orgAddVideo);
  const addChannel = useMutation(api.learnhub_curated.orgAddChannel);
  const removeItem = useMutation(api.learnhub_curated.orgRemoveCurated);
  const setActive = useMutation(api.learnhub_curated.orgSetActive);
  const setFeatured = useMutation(api.learnhub_curated.orgSetFeatured);
  const convertChannel = useMutation(api.learnhub_curated.orgConvertChannelToVideo);

  const [mode, setMode] = useState<AddMode>("video");
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [channelFocus, setChannelFocus] = useState<ChannelFocus>("videos");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const trimmedUrl = url.trim();
  const videoId = useMemo(
    () => (mode !== "channel" && trimmedUrl ? extractYouTubeId(trimmedUrl) : null),
    [trimmedUrl, mode],
  );
  const channelParsed = useMemo(
    () => (mode === "channel" && trimmedUrl ? extractYouTubeChannelId(trimmedUrl) : null),
    [trimmedUrl, mode],
  );

  // Auto-suggest a display name once a URL parses, unless the user has
  // already typed one. Re-runs when the parsed identity changes.
  useEffect(() => {
    if (mode === "channel") {
      if (channelParsed && !displayName.trim()) {
        setDisplayName(channelParsed.value.replace(/^@/, ""));
      }
    } else if (videoId && !displayName.trim()) {
      setDisplayName(mode === "short" ? `Short ${videoId}` : `Video ${videoId}`);
    }
  }, [videoId, channelParsed, mode, displayName]);

  // Pre-compute sortedItems regardless of items being defined — the hook
  // must always run so React's hook-count is stable across renders.
  const safeItems = items ?? [];
  const sortedItems = useMemo(() => {
    const arr = [...safeItems];
    arr.sort((a, b) => {
      // Featured first, then videos before channels, then newest first.
      const af = a.isFeatured ? 1 : 0;
      const bf = b.isFeatured ? 1 : 0;
      if (af !== bf) return bf - af;
      if (a.kind !== b.kind) return a.kind === "video" ? -1 : 1;
      return b.addedAt - a.addedAt;
    });
    return arr;
  }, [safeItems]);

  const counts = useMemo(() => {
    let videos = 0, shorts = 0, channels = 0, featured = 0;
    for (const i of safeItems) {
      if (i.kind === "channel") channels++;
      else if ((i.format ?? "video") === "short") shorts++;
      else videos++;
      if (i.isFeatured) featured++;
    }
    return { videos, shorts, channels, featured };
  }, [safeItems]);

  // ── Conditional renders happen ONLY after all hooks above ──
  if (loading || items === undefined) {
    return (
      <div style={{ padding: 24, color: "#fff", background: "#06070f", minHeight: "100%" }}>
        Loading curation queue…
      </div>
    );
  }
  if (!userId || (role !== "org_partner" && role !== "coordinator" && role !== "admin")) {
    return (
      <div style={{ padding: 24, color: "#fff", background: "#06070f", minHeight: "100%" }}>
        Watch Curation is restricted to Org Partners, Coordinators, and Admins.{" "}
        <Link href="/learnhub/feed" style={{ color: INDIGO }}>← Back</Link>
      </div>
    );
  }

  const toggleTag = (id: string) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setUrl(""); setDisplayName(""); setDescription(""); setDuration("");
    setTags(new Set()); setChannelFocus("videos");
  };

  const submit = async () => {
    setError(null);
    const trimmedName = displayName.trim();

    if (mode === "channel") {
      if (!channelParsed) {
        setError("Paste a YouTube channel URL — e.g. https://youtube.com/@ChannelName.");
        return;
      }
      if (!trimmedName) {
        setError("Give the channel a display name learners will recognize.");
        return;
      }
      setBusy(true);
      try {
        await addChannel({
          actorId: userId as Id<"learnhub_users">,
          youtubeChannelId: channelParsed.value,
          displayName: trimmedName,
          description: description.trim() || undefined,
          tags: tags.size > 0 ? Array.from(tags) : undefined,
          channelFocus,
        });
        resetForm();
        setToast(`Saved — ${trimmedName} now appears on /learnhub/watch.`);
        setTimeout(() => setToast(null), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Video or Short
    if (!videoId) {
      setError(
        mode === "short"
          ? "Paste a YouTube Shorts URL — e.g. https://youtube.com/shorts/abc123."
          : "Paste a YouTube video URL — e.g. https://youtu.be/abc123 or https://youtube.com/watch?v=abc123.",
      );
      return;
    }
    if (!trimmedName) {
      setError("Give it a display name so learners know what they're about to watch.");
      return;
    }
    setBusy(true);
    try {
      await addVideo({
        actorId: userId as Id<"learnhub_users">,
        youtubeVideoId: videoId,
        displayName: trimmedName,
        description: description.trim() || undefined,
        durationLabel: duration.trim() || undefined,
        tags: tags.size > 0 ? Array.from(tags) : undefined,
        format: mode === "short" ? "short" : "video",
      });
      resetForm();
      setToast(`Saved — “${trimmedName}” is live on /learnhub/watch.`);
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      color: "#fff", background: "#06070f", minHeight: "100%",
      padding: "24px 20px", fontFamily: "'Inter', sans-serif",
    }}>
      <Link href="/learnhub/org" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: "rgba(255,255,255,0.6)", letterSpacing: 1.2, textTransform: "uppercase",
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
        textDecoration: "none",
      }}>
        <ArrowLeft size={14} /> Back to Org Console
      </Link>

      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>
        Watch Curation
      </h1>
      <p style={{ margin: "4px 0 14px", color: "rgba(255,255,255,0.55)", fontSize: 13, maxWidth: 720 }}>
        Surface YouTube content for learners on{" "}
        <Link href="/learnhub/watch" style={{ color: ORANGE }}>/learnhub/watch</Link>.
        Pick interest tags so the right learners see it; star an item to
        feature it at the top of the feed.
      </p>

      {/* Add form */}
      <div style={{
        padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.02)",
        border: `1px solid ${ORANGE}30`, marginBottom: 22, maxWidth: 760,
      }}>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <ModeButton active={mode === "video"} onClick={() => setMode("video")}
            icon={<VideoIcon size={13} />} label="Add video" hint="Long-form, 16:9" hue={ORANGE} />
          <ModeButton active={mode === "short"} onClick={() => setMode("short")}
            icon={<Zap size={13} />} label="Add Short" hint="Vertical, 9:16" hue={AMBER} highlight />
          <ModeButton active={mode === "channel"} onClick={() => setMode("channel")}
            icon={<Youtube size={13} />} label="Add channel" hint="Browse on YouTube" hue={SKY} />
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
            {mode === "channel" ? "YouTube channel URL" : mode === "short" ? "YouTube Shorts URL" : "YouTube video URL"}
          </span>
          <div style={{ position: "relative" }}>
            <LinkIcon size={14} style={{ position: "absolute", left: 12, top: 12, color: "rgba(255,255,255,0.4)" }} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                mode === "channel" ? "https://youtube.com/@SomeChannel"
                : mode === "short" ? "https://youtube.com/shorts/abc123"
                : "https://youtu.be/dQw4w9WgXcQ"
              }
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
                color: "#fff", fontSize: 13, outline: "none",
              }}
            />
          </div>
          {mode !== "channel" && videoId && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}33`,
              display: "inline-flex", gap: 8, alignItems: "center",
            }}>
              <CheckCircle2 size={12} /> {mode === "short" ? "Short" : "Video"} ID &ldquo;{videoId}&rdquo; detected
              <img
                src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                alt="" width={40} height={30}
                style={{ marginLeft: 4, borderRadius: 4, objectFit: "cover" }}
              />
            </div>
          )}
          {mode === "channel" && channelParsed && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}33`,
              display: "inline-flex", gap: 6, alignItems: "center",
            }}>
              <CheckCircle2 size={12} /> Channel &ldquo;{channelParsed.value}&rdquo; detected ({channelParsed.kind})
            </div>
          )}
          {url && !videoId && !channelParsed && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              color: RED, background: `${RED}12`, border: `1px solid ${RED}33`,
            }}>
              Couldn&rsquo;t recognize that URL.
              {mode === "channel"
                ? " Paste a /@handle, /channel/UC..., /c/..., or /user/... URL."
                : " Paste a full youtu.be/<id> or youtube.com/watch?v=<id>."}
            </div>
          )}
        </label>

        <div style={{
          display: "grid",
          gridTemplateColumns: mode === "video" ? "1fr 130px" : "1fr",
          gap: 10, marginBottom: 12,
        }}>
          <label>
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={
                mode === "channel" ? "DICT Region V"
                : mode === "short" ? "Phishing red flags in 30s"
                : "Intro to FastAPI in 12 minutes"
              }
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
                color: "#fff", fontSize: 13, outline: "none",
              }}
            />
          </label>
          {mode === "video" && (
            <label>
              <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
                Duration <span style={{ color: "rgba(255,255,255,0.35)" }}>(opt.)</span>
              </span>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="14:32"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
                  color: "#fff", fontSize: 13, outline: "none",
                }}
              />
            </label>
          )}
        </div>

        {mode === "channel" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
              Channel focuses on
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["videos", "shorts", "both"] as const).map((f) => {
                const on = channelFocus === f;
                return (
                  <button key={f} type="button" onClick={() => setChannelFocus(f)} style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: on ? `${SKY}1c` : "rgba(255,255,255,0.04)",
                    color: on ? SKY : "rgba(255,255,255,0.7)",
                    border: on ? `1px solid ${SKY}55` : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer", textTransform: "capitalize",
                  }}>{f}</button>
                );
              })}
            </div>
          </div>
        )}

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
            Description <span style={{ color: "rgba(255,255,255,0.35)" }}>(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What will learners get out of this?"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
              color: "#fff", fontSize: 13, outline: "none", resize: "vertical",
            }}
          />
        </label>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
            Interest tags <span style={{ color: "rgba(255,255,255,0.35)" }}>· pick what this helps learners with</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {WATCH_INTEREST_TAGS.map((t) => {
              const on = tags.has(t.id);
              return (
                <button key={t.id} type="button" onClick={() => toggleTag(t.id)} style={{
                  padding: "6px 10px", borderRadius: 999, fontSize: 11.5,
                  background: on ? `${ORANGE}1c` : "rgba(255,255,255,0.04)",
                  color: on ? ORANGE : "rgba(255,255,255,0.7)",
                  border: on ? `1px solid ${ORANGE}55` : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center",
                  fontWeight: on ? 700 : 600,
                }}>
                  <span>{t.emoji}</span><span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 12,
            color: RED, background: `${RED}10`, border: `1px solid ${RED}30`,
          }}>{error}</div>
        )}
        <button type="button" onClick={submit} disabled={busy} style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
          color: "white", border: 0, cursor: busy ? "wait" : "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
          boxShadow: `0 6px 18px ${ORANGE}44`,
        }}>
          <PlusCircle size={14} />
          {busy ? "Saving…"
            : mode === "channel" ? "Post channel"
            : mode === "short" ? "Post Short to Watch"
            : "Post video to Watch"}
        </button>
        {toast && (
          <span style={{
            marginLeft: 10, padding: "8px 12px", borderRadius: 8, fontSize: 11,
            color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}33`,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <CheckCircle2 size={12} /> {toast}
          </span>
        )}
      </div>

      {/* Counts strip */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Your curated picks</h2>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          {counts.videos} video{counts.videos === 1 ? "" : "s"} · {counts.shorts} short{counts.shorts === 1 ? "" : "s"}
          {" · "}{counts.channels} channel{counts.channels === 1 ? "" : "s"}
          {counts.featured > 0 ? ` · ${counts.featured} featured` : ""}
        </span>
      </div>

      {sortedItems.length === 0 ? (
        <div style={{
          padding: 36, textAlign: "center", borderRadius: 14,
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.5)", maxWidth: 760,
        }}>
          Nothing yet — add a video, short, or channel above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
          {sortedItems.map((item) => (
            <CuratedRow
              key={item._id as unknown as string}
              item={item as CuratedItem}
              userId={userId as Id<"learnhub_users">}
              onToggleActive={() => setActive({
                actorId: userId as Id<"learnhub_users">,
                itemId: item._id,
                isActive: !item.isActive,
              })}
              onToggleFeatured={() => setFeatured({
                actorId: userId as Id<"learnhub_users">,
                itemId: item._id,
                isFeatured: !item.isFeatured,
              })}
              onRemove={() => {
                if (!confirm(`Remove "${item.displayName}"?`)) return;
                return removeItem({ actorId: userId as Id<"learnhub_users">, itemId: item._id });
              }}
              onConvert={convertChannel}
            />
          ))}
        </div>
      )}

      <p style={{
        marginTop: 22, maxWidth: 720, fontSize: 11.5, color: "rgba(255,255,255,0.45)",
        display: "inline-flex", alignItems: "flex-start", gap: 6,
      }}>
        <Info size={12} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          Channels can&rsquo;t be embedded directly — learners see a card linking to the
          channel&rsquo;s YouTube videos/shorts page. To put playable content on Watch,
          add individual videos or shorts.
        </span>
      </p>
    </div>
  );
}

function ModeButton({
  active, onClick, icon, label, hint, hue, highlight,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode;
  label: string; hint: string; hue: string; highlight?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 10, cursor: "pointer",
      background: active ? `${hue}1c` : "rgba(255,255,255,0.04)",
      color: active ? hue : "rgba(255,255,255,0.75)",
      border: active ? `1px solid ${hue}66` : "1px solid rgba(255,255,255,0.08)",
      display: "inline-flex", alignItems: "center", gap: 8,
      position: "relative",
      boxShadow: highlight && !active ? `0 0 0 1px ${hue}44, 0 6px 18px ${hue}22` : undefined,
    }}>
      {icon}
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{hint}</span>
      {highlight && !active && (
        <span style={{
          position: "absolute", top: -7, right: -7, padding: "2px 6px",
          borderRadius: 999, background: hue, color: "#06070f",
          fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
        }}>NEW</span>
      )}
    </button>
  );
}

type CuratedItem = {
  _id: Id<"learnhub_org_curated_channels">;
  kind: "video" | "channel";
  youtubeVideoId?: string;
  youtubeChannelId?: string;
  displayName: string;
  description?: string;
  thumbnailUrl?: string;
  isActive: boolean;
  tags?: string[];
  durationLabel?: string;
  format?: "video" | "short";
  channelFocus?: "videos" | "shorts" | "both";
  isFeatured?: boolean;
};

function CuratedRow({
  item, userId, onToggleActive, onToggleFeatured, onRemove, onConvert,
}: {
  item: CuratedItem;
  userId: Id<"learnhub_users">;
  onToggleActive: () => Promise<unknown> | void;
  onToggleFeatured: () => Promise<unknown> | void;
  onRemove: () => Promise<unknown> | void;
  onConvert: ReturnType<typeof useMutation<typeof api.learnhub_curated.orgConvertChannelToVideo>>;
}) {
  const isChannel = item.kind === "channel";
  const isShort = item.kind === "video" && (item.format ?? "video") === "short";
  const isFeatured = !!item.isFeatured;

  // Hooks always run unconditionally.
  const [showConvert, setShowConvert] = useState(false);
  const [convertUrl, setConvertUrl] = useState("");
  const [converting, setConverting] = useState(false);
  const convertId = useMemo(
    () => (convertUrl.trim() ? extractYouTubeId(convertUrl) : null),
    [convertUrl],
  );

  const borderColor =
    isFeatured ? `${AMBER}55`
    : isChannel ? "rgba(56,189,248,0.18)"
    : isShort ? `${AMBER}33`
    : "rgba(255,255,255,0.08)";
  const bgColor =
    isFeatured ? `${AMBER}10`
    : isChannel ? "rgba(56,189,248,0.04)"
    : "rgba(255,255,255,0.02)";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "82px 1fr auto",
      alignItems: "center", gap: 14, padding: 12, borderRadius: 12,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      opacity: item.isActive ? 1 : 0.55,
      position: "relative",
    }}>
      {isFeatured && (
        <span style={{
          position: "absolute", top: -8, left: 14, padding: "2px 8px",
          borderRadius: 999, background: AMBER, color: "#06070f",
          fontSize: 9, fontWeight: 900, letterSpacing: 0.8, display: "inline-flex",
          alignItems: "center", gap: 4,
        }}>
          <Star size={9} fill="currentColor" /> FEATURED
        </span>
      )}

      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" style={{
          width: 82, height: isShort ? 110 : 56, borderRadius: 6, objectFit: "cover",
          background: "rgba(255,255,255,0.04)",
        }} />
      ) : (
        <div style={{
          width: 82, height: isShort ? 110 : 56, borderRadius: 6,
          background: isChannel ? `${SKY}18` : isShort ? `${AMBER}18` : `${ORANGE}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: isChannel ? SKY : isShort ? AMBER : ORANGE, fontSize: 22,
        }}>
          {isChannel ? "📺" : isShort ? "⚡" : "▶"}
        </div>
      )}

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320,
          }}>{item.displayName}</span>
          {isChannel && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
              padding: "2px 7px", borderRadius: 4,
              background: "rgba(56,189,248,0.14)", color: SKY,
              border: "1px solid rgba(56,189,248,0.3)",
            }}>
              {item.channelFocus === "shorts" ? "CHANNEL · SHORTS" : item.channelFocus === "both" ? "CHANNEL · BOTH" : "CHANNEL"}
            </span>
          )}
          {isShort && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
              padding: "2px 7px", borderRadius: 4,
              background: `${AMBER}1c`, color: AMBER,
              border: `1px solid ${AMBER}55`, display: "inline-flex", gap: 3, alignItems: "center",
            }}>
              <Zap size={9} /> SHORT
            </span>
          )}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
          color: "rgba(255,255,255,0.5)", marginTop: 3,
        }}>
          {item.kind === "video"
            ? `${isShort ? "⚡" : "▶"} ${item.youtubeVideoId ?? "—"}${item.durationLabel ? ` · ${item.durationLabel}` : ""}`
            : `📺 ${item.youtubeChannelId ?? "—"}`}
        </div>
        {item.description && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}
        {item.tags && item.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {item.tags.map((t) => (
              <span key={t} style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                padding: "2px 7px", borderRadius: 999,
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>{t}</span>
            ))}
          </div>
        )}

        {isChannel && showConvert && (
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 10,
            background: "rgba(0,0,0,0.35)", border: `1px solid ${SKY}33`,
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>
              Paste a video URL from this channel to surface it on /learnhub/watch:
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={convertUrl}
                onChange={(e) => setConvertUrl(e.target.value)}
                placeholder="https://youtu.be/…"
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.45)",
                  color: "#fff", fontSize: 12, outline: "none",
                }}
              />
              <button type="button" disabled={!convertId || converting} onClick={async () => {
                if (!convertId) return;
                setConverting(true);
                try {
                  await onConvert({
                    actorId: userId,
                    itemId: item._id,
                    youtubeVideoId: convertId,
                  });
                  setShowConvert(false); setConvertUrl("");
                } finally {
                  setConverting(false);
                }
              }} style={{
                padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: convertId ? SKY : "rgba(255,255,255,0.06)",
                color: convertId ? "#06070f" : "rgba(255,255,255,0.4)",
                border: 0, cursor: convertId && !converting ? "pointer" : "not-allowed",
              }}>
                {converting ? "Saving…" : "Convert"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button"
          title={isFeatured ? "Remove highlight" : "Highlight on Watch"}
          onClick={onToggleFeatured}
          style={{
            padding: 8, borderRadius: 8,
            background: isFeatured ? `${AMBER}1c` : "rgba(255,255,255,0.04)",
            border: `1px solid ${isFeatured ? `${AMBER}66` : "rgba(255,255,255,0.08)"}`,
            color: isFeatured ? AMBER : "#fff", cursor: "pointer",
          }}>
          <Star size={14} fill={isFeatured ? AMBER : "none"} />
        </button>
        {isChannel && !showConvert && (
          <button type="button" title="Convert to a playable video"
            onClick={() => setShowConvert(true)}
            style={{
              padding: "6px 10px", borderRadius: 8,
              background: `${SKY}18`, border: `1px solid ${SKY}38`, color: SKY,
              cursor: "pointer", fontSize: 11, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
            <RefreshCw size={12} /> Convert
          </button>
        )}
        <button type="button" title={item.isActive ? "Pause from feed" : "Reactivate"}
          onClick={onToggleActive}
          style={{
            padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer",
          }}>
          {item.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button type="button" title="Remove"
          onClick={onRemove}
          style={{
            padding: 8, borderRadius: 8, background: `${RED}14`,
            border: `1px solid ${RED}33`, color: RED, cursor: "pointer",
          }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
