import type { Id } from "@/convex/_generated/dataModel";

export type NoteKind = "note" | "question" | "bookmark" | "takeaway";
export type Visibility = "private" | "mentors" | "learnhub" | "public";

export type VideoNote = {
  _id: string;
  timestampSec: number;
  content: string;
  kind: NoteKind;
  label?: string;
  tags?: string[];
  isShared: boolean;
  createdAt: number;
};

export type TimelineEvent = {
  _id: string;
  type: string;
  timestampSec?: number;
  message: string;
  createdAt: number;
};

export type AiSummary = {
  summary?: string;
  keyConcepts?: string[];
  actionItems?: string[];
  questions?: string[];
  quizItems?: { question: string; answer: string }[];
  beginnerExplanation?: string;
};

export type VideoSession = {
  _id: string;
  userId: string;
  videoId: string;
  sourceUrl?: string;
  title?: string;
  thumbnail?: string;
  channelName?: string;
  status: "not_started" | "in_progress" | "completed";
  lastPositionSec: number;
  durationSec?: number;
  progressPct: number;
  summary?: string;
  aiSummary?: AiSummary;
  takeaways?: string[];
  visibility: Visibility;
  updatedAt: number;
  completedAt?: number;
};

export type SessionId = Id<"learnhub_video_sessions">;
export type UserId = Id<"learnhub_users">;
