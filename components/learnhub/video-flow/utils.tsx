import { HelpCircle, ListChecks, StickyNote, Timer } from "lucide-react";
import type { NoteKind } from "./types";

export function extractYouTubeId(input: string) {
  const value = input.trim();
  if (!value) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return /^[a-zA-Z0-9_-]{6,}$/.test(value) ? value : null;
}

/**
 * Pull a YouTube channel identifier out of any of the URL forms a user is
 * likely to paste. Returns one of:
 *   • `{ kind: "id", value: "UCxxxxxxxxxxxxxxxxxxxxxx" }` — canonical UC… id
 *   • `{ kind: "handle", value: "@somename" }` — modern @-handle (no API lookup needed)
 *   • `{ kind: "user", value: "legacyName" }` — legacy /user/ URL
 *   • `{ kind: "custom", value: "customSlug" }` — legacy /c/ URL
 *   • `null` if no channel-shaped identifier is present.
 *
 * We don't normalize handles into ids here — that would require a YouTube
 * Data API call, which we're explicitly deferring. The watch page can
 * still link to https://youtube.com/@handle directly.
 */
export function extractYouTubeChannelId(
  input: string,
): { kind: "id" | "handle" | "user" | "custom"; value: string } | null {
  const value = input.trim();
  if (!value) return null;
  const idMatch = value.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/);
  if (idMatch?.[1]) return { kind: "id", value: idMatch[1] };
  const handleMatch = value.match(/youtube\.com\/(@[a-zA-Z0-9._-]{2,})/);
  if (handleMatch?.[1]) return { kind: "handle", value: handleMatch[1] };
  const userMatch = value.match(/youtube\.com\/user\/([a-zA-Z0-9._-]+)/);
  if (userMatch?.[1]) return { kind: "user", value: userMatch[1] };
  const customMatch = value.match(/youtube\.com\/c\/([a-zA-Z0-9._-]+)/);
  if (customMatch?.[1]) return { kind: "custom", value: customMatch[1] };
  // Bare @handle paste
  if (/^@[a-zA-Z0-9._-]{2,}$/.test(value)) return { kind: "handle", value };
  // Bare UC id paste
  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(value)) return { kind: "id", value };
  return null;
}

export function fmtTime(sec?: number) {
  const safe = Math.max(0, Math.floor(sec ?? 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

export function labelForKind(kind: NoteKind) {
  if (kind === "question") return "Question";
  if (kind === "bookmark") return "Bookmark";
  if (kind === "takeaway") return "Takeaway";
  return "Note";
}

export function iconForKind(kind: NoteKind) {
  if (kind === "question") return <HelpCircle size={14} />;
  if (kind === "bookmark") return <Timer size={14} />;
  if (kind === "takeaway") return <ListChecks size={14} />;
  return <StickyNote size={14} />;
}

export function youtubeUrl(videoId: string, atSec?: number) {
  const base = `https://youtu.be/${videoId}`;
  if (!atSec || atSec <= 0) return base;
  return `${base}?t=${Math.floor(atSec)}`;
}

export type UserColor = {
  hex: string;
  bg: string;
  border: string;
  fg: string;
};

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function userColor(userId: string | null | undefined): UserColor {
  const seed = hashString(userId ?? "anon");
  const hue = seed % 360;
  const sat = 62 + (seed % 18);
  const light = 56;
  const hex = `hsl(${hue} ${sat}% ${light}%)`;
  const bg = `hsl(${hue} ${sat}% ${light}% / 0.18)`;
  const border = `hsl(${hue} ${sat}% ${light}% / 0.55)`;
  const fg = `hsl(${hue} ${sat}% 92%)`;
  return { hex, bg, border, fg };
}

export function userInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}
