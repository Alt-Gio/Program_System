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

// Same vocabulary as INTEREST_TAXONOMY in app/learnhub/onboarding/page.tsx.
// Posts tagged with any of these surface higher for students who picked them.
const POST_TAGS = [
  "Digital Literacy",
  "Python",
  "Data Analysis",
  "Web Dev",
  "Cybersecurity",
  "Project Management",
  "Communication",
  "Career Pivot",
] as const;
const MAX_POST_TAGS = 3;

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [meetMode, setMeetMode] = useState<"generate" | "paste">("generate");
  const [meetGenerating, setMeetGenerating] = useState(false);
  const [meetGenerateError, setMeetGenerateError] = useState<string | null>(null);
  const [meetCalendarEventId, setMeetCalendarEventId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoFileRef = useRef<HTMLInputElement | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_POST_TAGS) return prev;
      return [...prev, tag];
    });
  };

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
    window.addEventListener("lh-composer-collapse", onCollapse);
    return () => window.removeEventListener("lh-composer-collapse", onCollapse);
  }, []);

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
          ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
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
    setSelectedTags([]);
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
    <div className="lh-composer">
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

          {/* Content textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Use #hashtags for topics."
            rows={3}
            className="lh-composer-textarea"
            autoFocus
          />

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

          {/* Topic tags — surface this post to students whose interests overlap */}
          <div style={{ marginTop: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#9ba3cc", marginBottom: 6, letterSpacing: "0.04em" }}>
              Topics <span style={{ color: "#5c6490" }}>(optional · pick up to {MAX_POST_TAGS})</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {POST_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                const atCap = !active && selectedTags.length >= MAX_POST_TAGS;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    disabled={atCap}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 500,
                      background: active ? "rgba(91,108,255,0.18)" : "transparent",
                      border: active ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.1)",
                      color: active ? "#7c8bff" : "#e8eaff",
                      cursor: atCap ? "not-allowed" : "pointer",
                      opacity: atCap ? 0.4 : 1,
                      transition: "all 0.12s ease",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

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
