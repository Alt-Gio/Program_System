"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MockPost } from "./FeedPost";

const POST_TYPES = [
  { value: "text", label: "Text", emoji: "✍️" },
  { value: "youtube", label: "YouTube", emoji: "▶️" },
  { value: "meet", label: "Meet", emoji: "📹" },
  { value: "drive", label: "Drive", emoji: "📄" },
  { value: "form", label: "Form", emoji: "📋" },
];

interface PostComposerProps {
  onPost: (post: MockPost) => void;
  userId?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  userRole?: "student" | "mentor" | "org_partner";
}

export function PostComposer({ onPost, userId, userName, userAvatar, userRole }: PostComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState<"text" | "youtube" | "meet" | "drive" | "form">("text");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const createPost = useMutation(api.learnhub_posts.createPost);

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
      metadata = {
        meetLink,
        isLive: false,
        scheduledAt: Date.now() + 60 * 60 * 1000,
        durationMinutes: 60,
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
        });
      } else {
        onPost(optimisticPost);
      }
    } finally {
      setPosting(false);
    }
    setContent("");
    setYoutubeUrl("");
    setMeetLink("");
    setDriveUrl("");
    setFormUrl("");
    setExpanded(false);
    setType("text");
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
            <button className="lh-composer-action meet" onClick={() => { setExpanded(true); setType("meet"); }}>
              <span>🎥</span> Session
            </button>
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
                onClick={() => setType(t.value as typeof type)}
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

          {/* Type-specific URL input */}
          {type === "youtube" && (
            <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..." className="lh-composer-url-input" />
          )}
          {type === "meet" && (
            <input type="url" value={meetLink} onChange={(e) => setMeetLink(e.target.value)}
              placeholder="https://meet.google.com/..." className="lh-composer-url-input" />
          )}
          {type === "drive" && (
            <input type="url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..." className="lh-composer-url-input" />
          )}
          {type === "form" && (
            <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://forms.gle/..." className="lh-composer-url-input" />
          )}

          {/* Footer */}
          <div className="lh-composer-footer">
            <button
              onClick={() => { setExpanded(false); setContent(""); setType("text"); }}
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
