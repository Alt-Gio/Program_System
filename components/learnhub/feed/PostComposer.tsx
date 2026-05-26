"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MockPost } from "./FeedPost";
import { DTC_OFFICES } from "@/lib/learnhub/dtc-offices";

type PostTypeValue = "text" | "youtube" | "video" | "meet" | "drive" | "form";
interface PostTypeDef {
  value: PostTypeValue;
  label: string;
  emoji: string;
  mentorOnly?: boolean;
}
const ALL_POST_TYPES: readonly PostTypeDef[] = [
  { value: "text", label: "Text", emoji: "✍️" },
  { value: "youtube", label: "YouTube", emoji: "▶️" },
  { value: "video", label: "Video", emoji: "🎬" },
  { value: "meet", label: "Meet", emoji: "📹", mentorOnly: true },
  { value: "drive", label: "Drive", emoji: "📄" },
  { value: "form", label: "Form", emoji: "📋" },
];

// Cap on uploaded course videos. ~95 MB — Cloudflare free plan limit is 100MB
// while still allowing a 5–10 minute lesson at reasonable quality.
const MAX_VIDEO_BYTES = 95 * 1024 * 1024;

// Hashtag suggestions are sourced from the shared interest taxonomy. The
// composer no longer ships its own copy — `lib/learnhub/interests.ts` is
// the single source of truth used by onboarding, feed scoring, and here.
import {
  INTEREST_TAXONOMY,
  extractHashtags,
  normalizeHashtag,
} from "@/lib/learnhub/interests";

// Pre-normalize the suggestion list once.
const HASHTAG_SUGGESTIONS = INTEREST_TAXONOMY.map((i) => normalizeHashtag(i));

interface PostComposerProps {
  onPost: (post: MockPost) => void;
  userId?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  userRole?: "student" | "mentor" | "org_partner";
}

function canCreateMeet(role?: string) {
  return role === "mentor" || role === "org_partner";
}

/**
 * Compress an image dataURL to JPEG using a canvas.
 * Tries progressively lower quality until the result is under maxBytes.
 * Returns a compressed JPEG dataURL.
 */
async function compressImage(
  dataUrl: string,
  maxWidth = 960,
  maxBytes = 512_000
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);

      // Try decreasing quality until under budget
      for (const q of [0.8, 0.65, 0.5, 0.35]) {
        const out = canvas.toDataURL("image/jpeg", q);
        if (out.length <= maxBytes) { resolve(out); return; }
      }
      // Last resort: halve dimensions and try again at 0.5
      const c2 = document.createElement("canvas");
      c2.width = Math.round(w / 2);
      c2.height = Math.round(h / 2);
      const ctx2 = c2.getContext("2d");
      if (!ctx2) { resolve(canvas.toDataURL("image/jpeg", 0.35)); return; }
      ctx2.drawImage(img, 0, 0, c2.width, c2.height);
      resolve(c2.toDataURL("image/jpeg", 0.5));
    };
    img.src = dataUrl;
  });
}

async function writeMeetNotification(
  authorId: string,
  content: string,
  metadata: Record<string, unknown>
) {
  try {
    await fetch("/api/learnhub/notifications/meet-alarm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetTitle: content.slice(0, 80) || "New session scheduled",
        scheduledAt: (metadata.scheduledAt as number | undefined) ?? null,
        authorId,
      }),
    });
  } catch (err) {
    // best-effort — don't block the post on a failed notification fan-out
    console.warn("[meet-alarm] failed:", err);
  }
}

export function PostComposer({ onPost, userId, userName, userAvatar, userRole }: PostComposerProps) {
  const POST_TYPES = useMemo(
    () => ALL_POST_TYPES.filter((t) => !t.mentorOnly || canCreateMeet(userRole)),
    [userRole]
  );

  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");

  // PWA Web Share Target hand-off. /learnhub/share writes the shared text
  // here before redirecting into the feed; consume once on mount so it
  // pre-populates the composer and doesn't keep re-applying on rerender.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const shared = sessionStorage.getItem("learnhub:shared-draft");
      if (shared) {
        sessionStorage.removeItem("learnhub:shared-draft");
        setContent(shared);
        setExpanded(true);
      }
    } catch {
      // Private mode / disabled storage — share target silently drops.
    }
  }, []);
  const [type, setType] = useState<PostTypeValue>("text");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [meetOfficeId, setMeetOfficeId] = useState<string>("");
  const [meetDate, setMeetDate] = useState<string>("");
  const [driveUrl, setDriveUrl] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [videoStorageId, setVideoStorageId] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [videoSizeBytes, setVideoSizeBytes] = useState<number | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoCourseTitle, setVideoCourseTitle] = useState("");
  // Live preview of hashtags parsed from `content`. The viewer of the
  // composer sees these as pills so they know what'll be saved; the
  // server still re-normalizes on submit (createPost is authoritative).
  const detectedHashtags = useMemo(() => extractHashtags(content), [content]);
  const [hashtagQuery, setHashtagQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [meetMode, setMeetMode] = useState<"generate" | "paste">("generate");
  const [meetGenerating, setMeetGenerating] = useState(false);
  const [meetGenerateError, setMeetGenerateError] = useState<string | null>(null);
  const [meetCalendarEventId, setMeetCalendarEventId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoFileRef = useRef<HTMLInputElement | null>(null);

  // Detect an in-progress `#token` at the caret so we can show suggestions.
  // We only show the popover while the caret is touching a partial token
  // (no trailing whitespace) — otherwise the user has moved on.
  const onContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    const caret = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)#([a-zA-Z0-9_]*)$/);
    setHashtagQuery(m ? m[1].toLowerCase() : null);
  };

  const insertHashtag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? content.length;
    const before = content.slice(0, caret);
    const after = content.slice(caret);
    // Replace the partial `#token` (everything from the last `#` before the
    // caret) with the chosen tag + a trailing space.
    const replaced = before.replace(/#([a-zA-Z0-9_]*)$/, `#${tag} `);
    const next = replaced + after;
    setContent(next);
    setHashtagQuery(null);
    // Restore caret to just past the inserted tag.
    requestAnimationFrame(() => {
      const pos = replaced.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const hashtagSuggestions = useMemo(() => {
    if (hashtagQuery === null) return [];
    const q = hashtagQuery;
    // Sort: prefix matches first, then substring matches; exclude ones the
    // composer has already used.
    const already = new Set(detectedHashtags);
    return HASHTAG_SUGGESTIONS
      .filter((s) => !already.has(s))
      .map((s) => ({ s, score: s.startsWith(q) ? 2 : s.includes(q) ? 1 : 0 }))
      .filter((x) => q.length === 0 || x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.s);
  }, [hashtagQuery, detectedHashtags]);

  // Generate a real Meet link via the user's Google Calendar.
  // The composer treats the result as the Meet link going forward;
  // the post metadata stores both the URL and the calendar event id.
  const generateMeetLink = async () => {
    setMeetGenerateError(null);
    if (!content.trim()) {
      setMeetGenerateError("Add a title in the post content first.");
      return;
    }
    if (!meetDate) {
      setMeetGenerateError("Pick a date and time first.");
      return;
    }
    const startMs = new Date(meetDate).getTime();
    if (Number.isNaN(startMs) || startMs < Date.now()) {
      setMeetGenerateError("Date must be in the future.");
      return;
    }
    setMeetGenerating(true);
    try {
      const res = await fetch("/api/learnhub/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: content.trim(),
          start: new Date(startMs).toISOString(),
          end: new Date(startMs + 60 * 60_000).toISOString(),
          withMeet: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data?.error === "not_connected" || data?.error === "reconnect_required") {
          setMeetGenerateError("Connect Google Calendar in Settings to auto-generate Meet links.");
        } else {
          setMeetGenerateError(data?.error ?? "Failed to generate Meet link.");
        }
        return;
      }
      const hangoutLink: string | undefined = data.event?.hangoutLink;
      const eventId: string | undefined = data.event?.id;
      if (!hangoutLink) {
        setMeetGenerateError("Google did not return a Meet link — try again.");
        return;
      }
      setMeetLink(hangoutLink);
      setMeetCalendarEventId(eventId ?? null);
    } catch (err) {
      setMeetGenerateError(err instanceof Error ? err.message : "Failed to generate Meet link.");
    } finally {
      setMeetGenerating(false);
    }
  };

  const createPost = useMutation(api.learnhub_posts.createPost);
  const generateVideoUploadUrl = useMutation(api.learnhub_posts.generateVideoUploadUrl);

  // Collapse the composer whenever a panel toggle fires so the expanded
  // form doesn't squeeze during the CSS grid column transition.
  useEffect(() => {
    const onCollapse = () => setExpanded(false);
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: PostTypeValue }>).detail;
      if (detail?.type) setType(detail.type);
      setExpanded(true);
    };
    window.addEventListener("lh-composer-collapse", onCollapse);
    window.addEventListener("lh-composer-open", onOpen as EventListener);
    return () => {
      window.removeEventListener("lh-composer-collapse", onCollapse);
      window.removeEventListener("lh-composer-open", onOpen as EventListener);
    };
  }, []);

  // When expanded on mobile we render as a full-screen sheet. Lock body
  // scroll so the page underneath doesn't move while the user is typing,
  // and re-enable it the moment the composer closes.
  useEffect(() => {
    if (!expanded) return;
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  // Auto-open when the page is navigated to with #compose (the LeftRail and
  // MobileBottomNav both deep-link this way when "Create" is tapped from
  // another route).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#compose") {
      setExpanded(true);
      // Clear the hash so a back-nav doesn't re-trigger.
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // Esc closes the composer on every breakpoint.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);

    const extractYouTubeId = (url: string): string | null => {
      const match = url.match(
        /(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&\s]+)/
      );
      return match?.[1] ?? null;
    };

    const extractDriveId = (url: string): string | null => {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      return match?.[1] ?? null;
    };

    let metadata: Record<string, unknown> = {};
    if (type === "youtube" && youtubeUrl) {
      const videoId = extractYouTubeId(youtubeUrl) ?? youtubeUrl;
      metadata = {
        videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      };
    } else if (type === "meet" && meetLink) {
      const scheduledAt = meetDate
        ? new Date(meetDate).getTime()
        : Date.now() + 60 * 60 * 1000;
      metadata = {
        meetLink,
        isLive: false,
        scheduledAt,
        durationMinutes: 60,
        ...(meetOfficeId ? { dtcOffice: meetOfficeId } : {}),
        ...(meetCalendarEventId ? { calendarEventId: meetCalendarEventId } : {}),
      };
    } else if (type === "drive" && driveUrl) {
      const driveFileId = extractDriveId(driveUrl);
      metadata = {
        driveFileId,
        fileName: "Google Drive File",
        previewUrl: driveFileId
          ? `https://drive.google.com/file/d/${driveFileId}/preview`
          : undefined,
      };
    } else if (type === "form" && formUrl) {
      metadata = { formUrl, formTitle: "Google Form" };
    } else if (type === "video" && videoStorageId) {
      metadata = {
        storageId: videoStorageId,
        title: videoFileName ?? undefined,
        durationSec: videoDurationSec ?? undefined,
        sizeBytes: videoSizeBytes ?? undefined,
        courseTitle: videoCourseTitle.trim() || undefined,
      };
    }
    if (thumbnail) {
      metadata.thumbnailUrl = thumbnail;
    }

    const nowMs = Date.now();
    const optimisticPost: MockPost = {
      id: `post-${nowMs}`,
      type,
      author: {
        id: userId ?? "local",
        name: userName ?? "You",
        avatarUrl: userAvatar ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName ?? "You")}`,
        role: userRole ?? "student",
      },
      content,
      metadata,
      likeCount: 0,
      commentCount: 0,
      isPinned: false,
      createdAt: nowMs,
    };

    try {
      if (userId) {
        await createPost({
          authorId: userId as Id<"learnhub_users">,
          type,
          content,
          metadata,
          ...(detectedHashtags.length > 0 ? { hashtags: detectedHashtags } : {}),
        });
        // Alarm students: write a Firestore notification for meet posts
        if (type === "meet" && meetLink) {
          await writeMeetNotification(userId, content, metadata);
        }
      } else {
        onPost(optimisticPost);
      }
    } finally {
      setPosting(false);
    }
    setContent("");
    setYoutubeUrl("");
    setMeetLink("");
    setMeetOfficeId("");
    setMeetDate("");
    setDriveUrl("");
    setFormUrl("");
    setThumbnail(null);
    setVideoStorageId(null);
    setVideoFileName(null);
    setVideoDurationSec(null);
    setVideoSizeBytes(null);
    setVideoCourseTitle("");
    setVideoError(null);
    setVideoProgress(0);
    setHashtagQuery(null);
    setMeetGenerateError(null);
    setMeetCalendarEventId(null);
    setMeetMode("generate");
    setExpanded(false);
    setType("text");
  };

  // Probe a local video file for duration + a poster frame.
  const probeVideo = (file: File): Promise<{ durationSec: number }> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.src = url;
      v.onloadedmetadata = () => {
        const durationSec = isFinite(v.duration) ? v.duration : 0;
        URL.revokeObjectURL(url);
        resolve({ durationSec });
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ durationSec: 0 });
      };
    });

  const handleVideoUpload = async (file: File) => {
    setVideoError(null);
    if (!file.type.startsWith("video/")) {
      setVideoError("Please choose a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setVideoError(
        `Video is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`
      );
      return;
    }

    setVideoUploading(true);
    setVideoProgress(0);
    try {
      const { durationSec } = await probeVideo(file);

      const rawUploadUrl = await generateVideoUploadUrl({});
      // Convex returns a relative path — prepend the public Convex URL
      const convexBase = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://convex.dict.it.com";
      const uploadUrl = rawUploadUrl.startsWith("http")
        ? rawUploadUrl.replace(/https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/, convexBase)
        : `${convexBase}${rawUploadUrl}`;

      const storageId: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setVideoProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText) as { storageId: string };
              resolve(json.storageId);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      setVideoStorageId(storageId);
      setVideoFileName(file.name);
      setVideoDurationSec(durationSec || null);
      setVideoSizeBytes(file.size);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setVideoUploading(false);
    }
  };

  const avatarSrc = userAvatar
    ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName ?? "U")}&backgroundColor=5B6CFF&textColor=ffffff`;

  return (
    <div className={`lh-composer${expanded ? " is-expanded" : ""}`}>
      {!expanded ? (
        <>
          {/* Collapsed — click trigger */}
          <div className="lh-composer-top">
            <img src={avatarSrc} alt={userName ?? "You"} className="lh-composer-avatar" />
            <button
              onClick={() => setExpanded(true)}
              className="lh-composer-trigger"
            >
              What are you sharing with the cohort?
            </button>
          </div>

          {/* Quick-type action bar */}
          <div className="lh-composer-actions">
            <button className="lh-composer-action photos" onClick={() => { setExpanded(true); setType("drive"); }}>
              <span>📄</span> Drive
            </button>
            <button className="lh-composer-action video" onClick={() => { setExpanded(true); setType("youtube"); }}>
              <span>▶️</span> YouTube
            </button>
            <button className="lh-composer-action video" onClick={() => { setExpanded(true); setType("video"); }}>
              <span>🎬</span> Upload video
            </button>
            {canCreateMeet(userRole) && (
              <button className="lh-composer-action meet" onClick={() => { setExpanded(true); setType("meet"); }}>
                <span>🎥</span> Session
              </button>
            )}
            <button className="lh-composer-action form" onClick={() => { setExpanded(true); setType("form"); }}>
              <span>📋</span> Form
            </button>
          </div>
        </>
      ) : (
        <div className="lh-composer-expanded">
          {/* Mobile sheet header — shown only when the composer is rendered
              as a full-screen sheet (≤768px via CSS). Gives users a clear
              back affordance and a sticky Post action without scrolling. */}
          <div className="lh-composer-sheet-header">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="lh-composer-sheet-close"
              aria-label="Close composer"
            >
              ←
            </button>
            <span className="lh-composer-sheet-title">Create post</span>
            <button
              type="button"
              onClick={handlePost}
              disabled={!content.trim() || posting}
              className="lh-composer-sheet-post"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>

          {/* Author row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={avatarSrc} alt={userName ?? "You"} className="lh-composer-avatar" />
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--lh-text)" }}>
                {userName ?? "You"}
              </div>
              <div style={{ fontSize: 11, color: "var(--lh-text-3)" }}>Sharing with ILCDB cohort</div>
            </div>
          </div>

          {/* Type pills */}
          <div className="lh-composer-type-pills">
            {POST_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`lh-composer-pill${type === t.value ? " active" : ""}`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {/* Content textarea with live #hashtag suggestions */}
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={onContentChange}
              onBlur={() => setTimeout(() => setHashtagQuery(null), 150)}
              placeholder="What's on your mind? Use #hashtags so the right learners see this."
              rows={3}
              className="lh-composer-textarea"
              autoFocus
            />
            {hashtagSuggestions.length > 0 && (
              <div
                role="listbox"
                style={{
                  position: "absolute", left: 8, right: 8, bottom: -6,
                  transform: "translateY(100%)", zIndex: 30,
                  background: "#131626", border: "1px solid rgba(91,108,255,0.35)",
                  borderRadius: 10, padding: 6, display: "flex", flexWrap: "wrap", gap: 6,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                }}
              >
                {hashtagSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    onMouseDown={(e) => { e.preventDefault(); insertHashtag(s); }}
                    style={{
                      padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                      background: "rgba(91,108,255,0.14)", border: "1px solid rgba(91,108,255,0.35)",
                      color: "#a3b3ff", cursor: "pointer",
                    }}
                  >
                    #{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail attachment */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                // Reset so the same file can be reselected if removed.
                e.target.value = "";
                setCompressing(true);
                const reader = new FileReader();
                reader.onload = async () => {
                  const raw = reader.result as string;
                  const compressed = await compressImage(raw);
                  setThumbnail(compressed);
                  setCompressing(false);
                };
                reader.readAsDataURL(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="lh-composer-pill"
              style={{ fontSize: 12, opacity: compressing ? 0.6 : 1 }}
              disabled={compressing}
            >
              {compressing ? "⏳ Compressing…" : "🖼️ Attach image"}
            </button>
            {thumbnail && (
              <div style={{ position: "relative" }}>
                <img
                  src={thumbnail}
                  alt="Preview"
                  style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid var(--lh-surface-3)" }}
                />
                <button
                  type="button"
                  onClick={() => setThumbnail(null)}
                  style={{
                    position: "absolute", top: -6, right: -6,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#ef4444", color: "#fff", border: 0,
                    fontSize: 10, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                  aria-label="Remove thumbnail"
                >×</button>
              </div>
            )}
          </div>

          {/* Type-specific URL input */}
          {type === "youtube" && (
            <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..." className="lh-composer-url-input" />
          )}
          {type === "video" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                ref={videoFileRef}
                type="file"
                accept="video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void handleVideoUpload(f);
                }}
              />
              {!videoStorageId && !videoUploading && (
                <button
                  type="button"
                  onClick={() => videoFileRef.current?.click()}
                  className="lh-composer-pill"
                  style={{ fontSize: 13, alignSelf: "flex-start" }}
                >
                  🎬 Choose video file (max {MAX_VIDEO_BYTES / 1024 / 1024} MB)
                </button>
              )}
              {videoUploading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 12, color: "var(--lh-text-3)" }}>
                    Uploading… {videoProgress}%
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--lh-surface-3)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${videoProgress}%`,
                        background: "var(--lh-accent-2)",
                        transition: "width 0.2s",
                      }}
                    />
                  </div>
                </div>
              )}
              {videoStorageId && !videoUploading && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "var(--lh-surface-2)",
                    border: "1px solid var(--lh-surface-3)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>🎬</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--lh-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {videoFileName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--lh-text-3)" }}>
                      {videoSizeBytes ? `${(videoSizeBytes / 1024 / 1024).toFixed(1)} MB` : ""}
                      {videoDurationSec ? ` · ${Math.floor(videoDurationSec / 60)}:${Math.floor(videoDurationSec % 60).toString().padStart(2, "0")}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoStorageId(null);
                      setVideoFileName(null);
                      setVideoDurationSec(null);
                      setVideoSizeBytes(null);
                    }}
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "var(--lh-surface-3)", color: "var(--lh-text-2)",
                      border: 0, fontSize: 12, cursor: "pointer",
                    }}
                    aria-label="Remove video"
                  >×</button>
                </div>
              )}
              {videoError && (
                <div style={{ fontSize: 12, color: "#ef4444" }}>{videoError}</div>
              )}
              <input
                type="text"
                value={videoCourseTitle}
                onChange={(e) => setVideoCourseTitle(e.target.value)}
                placeholder="Course / topic (optional, e.g. Python — Loops)"
                className="lh-composer-url-input"
              />
            </div>
          )}
          {type === "meet" && (
            <>
              <input
                type="datetime-local"
                value={meetDate}
                onChange={(e) => setMeetDate(e.target.value)}
                className="lh-composer-url-input"
                style={{ cursor: "pointer", colorScheme: "dark" }}
                aria-label="Meeting date and time"
              />

              {meetMode === "generate" ? (
                meetLink ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(34,211,160,0.08)",
                      border: "1px solid rgba(34,211,160,0.3)",
                      fontSize: 12,
                      color: "#22d3a0",
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      ✓ Meet link generated
                      <a
                        href={meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#22d3a0", marginLeft: 6, textDecoration: "underline" }}
                      >
                        Open
                      </a>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMeetLink("");
                        setMeetCalendarEventId(null);
                      }}
                      style={{ background: "transparent", border: 0, color: "#22d3a0", cursor: "pointer", fontSize: 11 }}
                    >
                      Regenerate
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={generateMeetLink}
                      disabled={meetGenerating}
                      className="lh-composer-url-input"
                      style={{
                        cursor: meetGenerating ? "wait" : "pointer",
                        background: "rgba(91,108,255,0.12)",
                        border: "1px solid rgba(91,108,255,0.4)",
                        color: "#7c8bff",
                        fontWeight: 600,
                        textAlign: "center",
                        flex: 1,
                      }}
                    >
                      {meetGenerating ? "Generating…" : "🎥  Generate Meet link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeetMode("paste")}
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "#9ba3cc",
                        cursor: "pointer",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Paste a link instead
                    </button>
                  </div>
                )
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="url"
                    value={meetLink}
                    onChange={(e) => setMeetLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="lh-composer-url-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMeetMode("generate");
                      setMeetLink("");
                    }}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "#9ba3cc",
                      cursor: "pointer",
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Generate instead
                  </button>
                </div>
              )}

              {meetGenerateError && (
                <div style={{ fontSize: 11, color: "#ff5f6d" }}>{meetGenerateError}</div>
              )}

              <select
                value={meetOfficeId}
                onChange={(e) => setMeetOfficeId(e.target.value)}
                className="lh-composer-url-input"
                style={{ cursor: "pointer" }}
                aria-label="Hosting DTC office"
              >
                <option value="">— Hosting DTC office (optional)</option>
                {DTC_OFFICES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.city}, {o.province}{o.isMain ? " (Main)" : ""}
                  </option>
                ))}
              </select>
            </>
          )}
          {type === "drive" && (
            <input type="url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..." className="lh-composer-url-input" />
          )}
          {type === "form" && (
            <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://forms.gle/..." className="lh-composer-url-input" />
          )}

          {/* Detected hashtags — confirms what'll be saved. The textarea
              above is the source of truth; this is a read-only preview. */}
          {detectedHashtags.length > 0 && (
            <div style={{ marginTop: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: "#9ba3cc", marginBottom: 6, letterSpacing: "0.04em" }}>
                Hashtags <span style={{ color: "#5c6490" }}>· extracted from your post</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {detectedHashtags.map((h) => (
                  <span
                    key={h}
                    style={{
                      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: "rgba(91,108,255,0.16)", border: "1px solid rgba(91,108,255,0.32)",
                      color: "#a3b3ff",
                    }}
                  >
                    #{h}
                  </span>
                ))}
              </div>
              <p style={{ marginTop: 6, fontSize: 10.5, color: "#6b7396", lineHeight: 1.45 }}>
                Posts whose hashtags match a learner&rsquo;s interests reach more of the right people.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="lh-composer-footer">
            <button
              onClick={() => { setExpanded(false); setContent(""); setType("text"); setThumbnail(null); }}
              className="lh-composer-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handlePost}
              disabled={!content.trim() || posting}
              className="lh-composer-submit"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
