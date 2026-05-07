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
