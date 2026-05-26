"use client";

import { useState } from "react";

interface YouTubeMetadata {
  videoId: string;
  title?: string;
  thumbnail?: string;
  channelName?: string;
  duration?: string;
}

export function YouTubePost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as YouTubeMetadata;
  const [playing, setPlaying] = useState(false);

  if (!m.videoId) return null;

  const thumbnailUrl =
    m.thumbnail ?? `https://img.youtube.com/vi/${m.videoId}/mqdefault.jpg`;

  if (playing) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${m.videoId}?autoplay=1&rel=0`}
          title={m.title ?? "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: "none", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer group relative"
      style={{
        background: "var(--lh-input-bg)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      onClick={() => setPlaying(true)}
    >
      {/* Thumbnail */}
      <div className="relative" style={{ aspectRatio: "16/9" }}>
        <img
          src={thumbnailUrl}
          alt={m.title ?? "YouTube video"}
          className="w-full h-full object-cover"
        />
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: "#ff0000" }}
          >
            <svg width="22" height="22" fill="white" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        </div>
        {/* Duration badge */}
        {m.duration && (
          <span
            className="absolute bottom-2 right-2 text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,0.8)", color: "#fff" }}
          >
            {m.duration}
          </span>
        )}
      </div>
      {/* Info row */}
      {m.title && (
        <div className="px-3 py-2.5 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff0000">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.26 8.26 0 0 0 4.83 1.55V6.78a4.85 4.85 0 0 1-1.06-.09z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--lh-text)" }}
            >
              {m.title}
            </p>
            {m.channelName && (
              <p className="text-xs truncate" style={{ color: "var(--lh-text-2)" }}>
                {m.channelName}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
