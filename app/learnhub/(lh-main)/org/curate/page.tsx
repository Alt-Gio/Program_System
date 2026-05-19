"use client";

/**
 * Org Partner / Coordinator — curate YouTube content for /learnhub/watch.
 *
 * Paste a YouTube channel or video URL, give it a display name, save.
 * Items show up in the Watch feed (mobile reels + desktop theater) until
 * the org marks them inactive.
 *
 * No YouTube Data API integration in this pass — display names are
 * authored manually, channel adds become an identity banner only. Future
 * follow-up: sync channel videos on a cron with a YOUTUBE_API_KEY.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft, CheckCircle2, Eye, EyeOff, Link as LinkIcon,
  PlusCircle, Trash2, Video, Youtube,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { extractYouTubeId, extractYouTubeChannelId } from "@/components/learnhub/video-flow/utils";

const ORANGE = "#f97316";
const CYAN = "#0ea5e9";
const GREEN = "#10b981";
const RED = "#ef4444";

type AddMode = "video" | "channel";

export default function OrgCuratePage() {
  const { userId, role, loading } = useLearnhubSession();
  const items = useQuery(
    api.learnhub_curated.orgListCurated,
    userId ? { actorId: userId as Id<"learnhub_users"> } : "skip",
  );
  const addVideo = useMutation(api.learnhub_curated.orgAddVideo);
  const addChannel = useMutation(api.learnhub_curated.orgAddChannel);
  const removeItem = useMutation(api.learnhub_curated.orgRemoveCurated);
  const setActive = useMutation(api.learnhub_curated.orgSetActive);

  const [mode, setMode] = useState<AddMode>("video");
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (!url.trim()) return null;
    if (mode === "video") {
      const id = extractYouTubeId(url);
      return id ? { type: "video" as const, id } : null;
    }
    const ch = extractYouTubeChannelId(url);
    if (!ch) return null;
    return { type: "channel" as const, channelKind: ch.kind, value: ch.value };
  }, [url, mode]);

  if (loading || items === undefined) {
    return <div style={{ padding: 24, color: "#fff" }}>Loading curation queue…</div>;
  }
  if (!userId || (role !== "org_partner" && role !== "coordinator" && role !== "admin")) {
    return (
      <div style={{ padding: 24, color: "#fff" }}>
        Watch Curation is restricted to Org Partners, Coordinators, and Admins.{" "}
        <Link href="/learnhub/feed" style={{ color: "#5b6cff" }}>← Back</Link>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    if (!parsed) {
      setError("Paste a YouTube video or channel URL above.");
      return;
    }
    if (!displayName.trim()) {
      setError("Display name is required so learners know what they're about to watch.");
      return;
    }
    setBusy(true);
    try {
      if (parsed.type === "video") {
        await addVideo({
          actorId: userId as Id<"learnhub_users">,
          youtubeVideoId: parsed.id,
          displayName: displayName.trim(),
          description: description.trim() || undefined,
        });
      } else {
        // Channel adds: we don't have a UC id from a handle without the
        // YouTube API, so we store whatever we got. The watch page treats
        // `channel` items as identity-only (link to the channel page)
        // when no UC id is present.
        await addChannel({
          actorId: userId as Id<"learnhub_users">,
          youtubeChannelId: parsed.value,
          displayName: displayName.trim(),
          description: description.trim() || undefined,
        });
      }
      setUrl("");
      setDisplayName("");
      setDescription("");
      setToast("Saved to your curated list.");
      setTimeout(() => setToast(null), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ color: "#fff", background: "#06060f", minHeight: "100%", padding: "24px 20px", fontFamily: "'Inter', sans-serif" }}>
      <Link href="/learnhub/org" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.6)",
        letterSpacing: 1.2, textTransform: "uppercase",
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
      }}><ArrowLeft size={14} /> Back to Org Console</Link>

      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Watch Curation</h1>
      <p style={{ margin: "4px 0 22px", color: "rgba(255,255,255,0.55)", fontSize: 13, maxWidth: 720 }}>
        Paste YouTube videos or channels you want to surface on{" "}
        <Link href="/learnhub/watch" style={{ color: ORANGE }}>/learnhub/watch</Link>.
        Learners only see what an Org Partner has surfaced — keep it learning-focused.
      </p>

      {/* Add form */}
      <div style={{
        padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.02)",
        border: `1px solid ${ORANGE}30`, marginBottom: 22, maxWidth: 760,
      }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["video", "channel"] as const).map((m) => {
            const active = mode === m;
            return (
              <button key={m} type="button" onClick={() => setMode(m)} style={{
                padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: active ? `${ORANGE}1c` : "rgba(255,255,255,0.04)",
                color: active ? ORANGE : "rgba(255,255,255,0.7)",
                border: active ? `1px solid ${ORANGE}55` : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {m === "video" ? <Video size={13} /> : <Youtube size={13} />}
                {m === "video" ? "Single video" : "Whole channel"}
              </button>
            );
          })}
        </div>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
            YouTube URL
          </span>
          <div style={{ position: "relative" }}>
            <LinkIcon size={14} style={{ position: "absolute", left: 12, top: 12, color: "rgba(255,255,255,0.4)" }} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={mode === "video" ? "https://youtu.be/dQw4w9WgXcQ" : "https://youtube.com/@channel"}
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
                color: "#fff", fontSize: 13, outline: "none",
              }}
            />
          </div>
          {parsed && (
            <div style={{
              marginTop: 6, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}33`,
              display: "inline-flex", gap: 6, alignItems: "center",
            }}>
              <CheckCircle2 size={12} /> Detected{" "}
              {parsed.type === "video"
                ? `video ID “${parsed.id}”`
                : `${parsed.channelKind} “${parsed.value}”`}
            </div>
          )}
          {url && !parsed && (
            <div style={{
              marginTop: 6, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              color: RED, background: `${RED}12`, border: `1px solid ${RED}33`,
            }}>
              Couldn&rsquo;t recognize that URL. Use a full youtu.be / youtube.com link.
            </div>
          )}
        </label>

        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.4 }}>
            Display name {mode === "video" ? "(video title)" : "(channel name)"}
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={mode === "video" ? "Intro to FastAPI in 12 min" : "Fireship"}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
              color: "#fff", fontSize: 13, outline: "none",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 14 }}>
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

        {error && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 12,
            color: RED, background: `${RED}10`, border: `1px solid ${RED}30`,
          }}>{error}</div>
        )}
        <button type="button" onClick={submit} disabled={busy} style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: `linear-gradient(135deg, ${ORANGE}, #f59e0b)`,
          color: "#06060f", border: 0, cursor: busy ? "wait" : "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <PlusCircle size={14} /> {busy ? "Saving…" : "Add to Watch feed"}
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

      {/* Current curated list */}
      <h2 style={{ margin: "20px 0 10px", fontSize: 18, fontWeight: 800 }}>Your curated picks ({items.length})</h2>
      {items.length === 0 ? (
        <div style={{ padding: 36, textAlign: "center", borderRadius: 14,
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.5)", maxWidth: 760 }}>
          No items yet — paste your first YouTube link above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
          {items.map((item) => (
            <div key={item._id as unknown as string} style={{
              display: "grid", gridTemplateColumns: "70px 1fr auto",
              alignItems: "center", gap: 14, padding: 12, borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${item.isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`,
              opacity: item.isActive ? 1 : 0.55,
            }}>
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" style={{
                  width: 70, height: 50, borderRadius: 6, objectFit: "cover",
                  background: "rgba(255,255,255,0.04)",
                }} />
              ) : (
                <div style={{
                  width: 70, height: 50, borderRadius: 6,
                  background: item.kind === "video" ? `${CYAN}18` : `${ORANGE}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: item.kind === "video" ? CYAN : ORANGE,
                }}>
                  {item.kind === "video" ? <Video size={20} /> : <Youtube size={20} />}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.displayName}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
                  {item.kind === "video" ? "VIDEO" : "CHANNEL"} ·{" "}
                  {item.kind === "video" ? item.youtubeVideoId : item.youtubeChannelId || "—"}
                </div>
                {item.description && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.4 }}>
                    {item.description}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" title={item.isActive ? "Pause from feed" : "Reactivate"} onClick={async () => {
                  await setActive({ actorId: userId as Id<"learnhub_users">, itemId: item._id, isActive: !item.isActive });
                }} style={{
                  padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer",
                }}>
                  {item.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button type="button" title="Remove" onClick={async () => {
                  if (!confirm(`Remove "${item.displayName}" from your curated list?`)) return;
                  await removeItem({ actorId: userId as Id<"learnhub_users">, itemId: item._id });
                }} style={{
                  padding: 8, borderRadius: 8, background: `${RED}14`,
                  border: `1px solid ${RED}33`, color: RED, cursor: "pointer",
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
