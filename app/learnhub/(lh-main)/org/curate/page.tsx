"use client";

/**
 * Org Partner / Coordinator — curate YouTube content for /learnhub/watch.
 *
 * Only individual YouTube video URLs become playable on the watch page.
 * Pasting a channel URL (legacy state) bookmarks the channel as an
 * identity entry but does not surface on the watch feed — surfacing a
 * whole channel needs a YouTube Data API integration which is deferred.
 * Legacy channel entries get a "Convert to video" affordance so the org
 * can swap them out without losing context.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft, CheckCircle2, Eye, EyeOff, Info, Link as LinkIcon,
  PlusCircle, RefreshCw, Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { extractYouTubeId } from "@/components/learnhub/video-flow/utils";

const ORANGE = "#f97316";
const GREEN = "#22c55e";
const RED = "#ef4444";
const INDIGO = "#6366f1";
const SKY = "#38bdf8";
const PURPLE = "#a855f7";
const AMBER = "#fbbf24";

// Same interest taxonomy as /learnhub/watch so adds and filters line up.
const WATCH_INTEREST_TAGS = [
  { id: "Cybersecurity", label: "Security",   emoji: "🔒" },
  { id: "CLOUD",         label: "Cloud",      emoji: "☁️" },
  { id: "TECH4ED",       label: "Tech4ED",    emoji: "💻" },
  { id: "SPARK",         label: "SPARK",      emoji: "⚡" },
  { id: "DWIA",          label: "DWIA",       emoji: "⚖️" },
  { id: "LEADERSHIP",    label: "Leadership", emoji: "🧭" },
  { id: "AI",            label: "AI",         emoji: "🤖" },
  { id: "Data",          label: "Data",       emoji: "📊" },
  { id: "PROGRAMMING",   label: "Programming",emoji: "⌨️" },
  { id: "UX",            label: "UX",         emoji: "🎨" },
  { id: "NEUROSCIENCE",  label: "Learning",   emoji: "🧠" },
] as const;

export default function OrgCuratePage() {
  const { userId, role, loading } = useLearnhubSession();
  const items = useQuery(
    api.learnhub_curated.orgListCurated,
    userId ? { actorId: userId as Id<"learnhub_users"> } : "skip",
  );
  const addVideo = useMutation(api.learnhub_curated.orgAddVideo);
  const removeItem = useMutation(api.learnhub_curated.orgRemoveCurated);
  const setActive = useMutation(api.learnhub_curated.orgSetActive);
  const convertChannel = useMutation(api.learnhub_curated.orgConvertChannelToVideo);

  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const videoId = useMemo(() => (url.trim() ? extractYouTubeId(url) : null), [url]);

  // Auto-suggest a display name from the YouTube ID once the URL parses,
  // unless the org has already typed one.
  useEffect(() => {
    if (videoId && !displayName.trim()) {
      setDisplayName(`Video ${videoId}`);
    }
  }, [videoId, displayName]);

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

  const submit = async () => {
    setError(null);
    if (!videoId) {
      setError("Paste a YouTube video URL — e.g. https://youtu.be/abc123 or https://youtube.com/watch?v=abc123.");
      return;
    }
    if (!displayName.trim()) {
      setError("Give the video a display name so learners know what they're about to watch.");
      return;
    }
    setBusy(true);
    try {
      await addVideo({
        actorId: userId as Id<"learnhub_users">,
        youtubeVideoId: videoId,
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        durationLabel: duration.trim() || undefined,
        tags: tags.size > 0 ? Array.from(tags) : undefined,
      });
      setUrl(""); setDisplayName(""); setDescription(""); setDuration("");
      setTags(new Set());
      setToast(`Saved — “${displayName.trim()}” is live on /learnhub/watch.`);
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "channel" ? -1 : 1));
    return arr;
  }, [items]);

  const videoCount = items.filter((i) => i.kind === "video").length;
  const channelCount = items.filter((i) => i.kind === "channel").length;

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
      <p style={{ margin: "4px 0 6px", color: "rgba(255,255,255,0.55)", fontSize: 13, maxWidth: 720 }}>
        Surface YouTube videos for learners on{" "}
        <Link href="/learnhub/watch" style={{ color: ORANGE }}>/learnhub/watch</Link>.
        Pick interest tags so the right learners see them.
      </p>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 11px", borderRadius: 999, marginBottom: 22,
        background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.30)",
        color: SKY, fontSize: 11.5,
      }}>
        <Info size={12} /> Whole-channel curation needs YouTube API — coming soon. Add videos one at a time for now.
      </div>

      {/* Add form */}
      <div style={{
        padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.02)",
        border: `1px solid ${ORANGE}30`, marginBottom: 22, maxWidth: 760,
      }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
            YouTube video URL
          </span>
          <div style={{ position: "relative" }}>
            <LinkIcon size={14} style={{ position: "absolute", left: 12, top: 12, color: "rgba(255,255,255,0.4)" }} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtu.be/dQw4w9WgXcQ"
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
                color: "#fff", fontSize: 13, outline: "none",
              }}
            />
          </div>
          {videoId && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}33`,
              display: "inline-flex", gap: 6, alignItems: "center",
            }}>
              <CheckCircle2 size={12} /> Video ID &ldquo;{videoId}&rdquo; detected
              <img
                src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                alt="" width={40} height={30}
                style={{ marginLeft: 8, borderRadius: 4, objectFit: "cover" }}
              />
            </div>
          )}
          {url && !videoId && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              color: RED, background: `${RED}12`, border: `1px solid ${RED}33`,
            }}>
              Couldn&rsquo;t recognize that URL. Paste a full <code>youtu.be/&lt;id&gt;</code> or{" "}
              <code>youtube.com/watch?v=&lt;id&gt;</code>.
            </div>
          )}
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 10, marginBottom: 12 }}>
          <label>
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Intro to FastAPI in 12 minutes"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
                color: "#fff", fontSize: 13, outline: "none",
              }}
            />
          </label>
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
        </div>

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
            Interest tags <span style={{ color: "rgba(255,255,255,0.35)" }}>· pick what this video helps learners with</span>
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
          <PlusCircle size={14} /> {busy ? "Saving…" : "Post to Watch feed"}
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

      {/* Curated list */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Your curated picks</h2>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          {videoCount} live · {channelCount} channel{channelCount === 1 ? "" : "s"} not surfaced
        </span>
      </div>

      {sortedItems.length === 0 ? (
        <div style={{
          padding: 36, textAlign: "center", borderRadius: 14,
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.5)", maxWidth: 760,
        }}>
          No items yet — paste your first YouTube video URL above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
          {sortedItems.map((item) => (
            <CuratedRow
              key={item._id as unknown as string}
              item={item}
              userId={userId as Id<"learnhub_users">}
              onToggleActive={() => setActive({
                actorId: userId as Id<"learnhub_users">,
                itemId: item._id,
                isActive: !item.isActive,
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
    </div>
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
};

function CuratedRow({
  item,
  userId,
  onToggleActive,
  onRemove,
  onConvert,
}: {
  item: CuratedItem;
  userId: Id<"learnhub_users">;
  onToggleActive: () => Promise<unknown> | void;
  onRemove: () => Promise<unknown> | void;
  onConvert: ReturnType<typeof useMutation<typeof api.learnhub_curated.orgConvertChannelToVideo>>;
}) {
  const isChannel = item.kind === "channel";
  const [showConvert, setShowConvert] = useState(false);
  const [convertUrl, setConvertUrl] = useState("");
  const [converting, setConverting] = useState(false);
  const convertId = useMemo(
    () => (convertUrl.trim() ? extractYouTubeId(convertUrl) : null),
    [convertUrl],
  );

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "82px 1fr auto",
      alignItems: "center", gap: 14, padding: 12, borderRadius: 12,
      background: isChannel ? "rgba(56,189,248,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isChannel ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.08)"}`,
      opacity: item.isActive ? 1 : 0.55,
    }}>
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" style={{
          width: 82, height: 56, borderRadius: 6, objectFit: "cover",
          background: "rgba(255,255,255,0.04)",
        }} />
      ) : (
        <div style={{
          width: 82, height: 56, borderRadius: 6,
          background: isChannel ? `${SKY}18` : `${ORANGE}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: isChannel ? SKY : ORANGE, fontSize: 22,
        }}>
          {isChannel ? "📺" : "▶"}
        </div>
      )}

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
            {item.displayName}
          </span>
          {isChannel && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
              padding: "2px 7px", borderRadius: 4,
              background: "rgba(56,189,248,0.14)", color: SKY,
              border: "1px solid rgba(56,189,248,0.3)",
            }}>
              CHANNEL · NOT IN WATCH
            </span>
          )}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
          color: "rgba(255,255,255,0.5)", marginTop: 3,
        }}>
          {item.kind === "video"
            ? `▶ ${item.youtubeVideoId ?? "—"}${item.durationLabel ? ` · ${item.durationLabel}` : ""}`
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

        {/* Convert-channel-to-video inline form */}
        {isChannel && showConvert && (
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 10,
            background: "rgba(0,0,0,0.35)", border: `1px solid ${SKY}33`,
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>
              Paste one of this channel&rsquo;s video URLs to surface it on /learnhub/watch:
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={convertUrl}
                onChange={(e) => setConvertUrl(e.target.value)}
                placeholder="https://youtu.be/..."
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

// Reference these so unused-import lint stays quiet across themes.
void PURPLE; void AMBER;
