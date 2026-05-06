"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface VideoMetadata {
  storageId?: string;
  videoUrl?: string;
  posterUrl?: string;
  title?: string;
  durationSec?: number;
  sizeBytes?: number;
  mimeType?: string;
  courseTitle?: string;
}

function fmtDuration(sec?: number) {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as VideoMetadata;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Resolve a storage-backed video to a signed URL via Convex.
  const storageUrl = useQuery(
    api.learnhub_posts.getStorageUrl,
    m.storageId ? { storageId: m.storageId as Id<"_storage"> } : "skip"
  );
  const src = m.videoUrl ?? storageUrl ?? null;

  // Pause when the post scrolls out of view.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && !el.paused) el.pause();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!src && m.storageId && storageUrl === undefined) {
    return (
      <div
        className="lh-skeleton"
        style={{ width: "100%", aspectRatio: "16/9", borderRadius: 12 }}
      />
    );
  }
  if (!src) return null;

  const duration = fmtDuration(m.durationSec);

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: "#0d0f1a",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={m.posterUrl}
        controls={playing}
        playsInline
        preload="metadata"
        onClick={() => {
          const el = videoRef.current;
          if (!el) return;
          if (el.paused) {
            el.play().catch(() => {});
            setPlaying(true);
          }
        }}
        style={{
          width: "100%",
          maxHeight: 480,
          display: "block",
          background: "#0d0f1a",
          cursor: playing ? "default" : "pointer",
        }}
      />
      {!playing && (
        <button
          type="button"
          aria-label="Play video"
          onClick={() => {
            const el = videoRef.current;
            if (!el) return;
            el.play().catch(() => {});
            setPlaying(true);
          }}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.25)",
            border: 0,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <svg width="22" height="22" fill="white" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </span>
        </button>
      )}
      {duration && !playing && (
        <span
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
          }}
        >
          {duration}
        </span>
      )}
      {(m.title || m.courseTitle) && (
        <div style={{ padding: "10px 12px" }}>
          {m.title && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--lh-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {m.title}
            </p>
          )}
          {m.courseTitle && (
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "var(--lh-text-3)",
              }}
            >
              📚 {m.courseTitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
