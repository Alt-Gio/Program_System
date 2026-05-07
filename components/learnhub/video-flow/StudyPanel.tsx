"use client";

import { useState } from "react";
import { Brain, CheckCircle2, Layers, MessageSquare, Sparkles, StickyNote } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { NotesPanel } from "./NotesPanel";
import { AISummaryPanel } from "./AIPanel";
import { ChatPanel } from "./ChatPanel";
import { ChecklistPanel } from "./ChecklistPanel";
import { FlashcardsPanel } from "./FlashcardsPanel";
import { QuizPanel } from "./QuizPanel";
import type { VideoNote, VideoSession } from "./types";

type Tab = "notes" | "summary" | "chat" | "cards" | "quiz" | "checklist";

type Props = {
  sessionId: string | null;
  userId: Id<"learnhub_users"> | null;
  isOwner: boolean;
  notes: VideoNote[];
  session: VideoSession | null;
  currentSec: number;
  ownerId?: string | null;
  transcript: string;
  setTranscript: (next: string) => void;
  onSeek: (sec: number) => void;
  onCompleted: () => void;
  onTypingChange?: (isTyping: boolean) => void;
  registerQuickBookmark?: (fn: () => void) => void;
  registerFocusComposer?: (fn: () => void) => void;
};

export function StudyPanel(props: Props) {
  const [tab, setTab] = useState<Tab>("notes");

  return (
    <div className="vf-panel-card">
      <div className="vf-tabs vf-tabs-scroll">
        <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>
          <StickyNote size={14} /> Notes
        </button>
        <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>
          <Brain size={14} /> AI
        </button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
          <MessageSquare size={14} /> Chat
        </button>
        <button className={tab === "cards" ? "active" : ""} onClick={() => setTab("cards")}>
          <Layers size={14} /> Cards
        </button>
        <button className={tab === "quiz" ? "active" : ""} onClick={() => setTab("quiz")}>
          <Sparkles size={14} /> Quiz
        </button>
        <button className={tab === "checklist" ? "active" : ""} onClick={() => setTab("checklist")}>
          <CheckCircle2 size={14} /> Review
        </button>
      </div>
      {tab === "notes" && (
        <NotesPanel
          sessionId={props.sessionId}
          userId={props.userId}
          isOwner={props.isOwner}
          notes={props.notes}
          currentSec={props.currentSec}
          ownerId={props.ownerId}
          onSeek={props.onSeek}
          onTypingChange={props.onTypingChange}
          registerQuickBookmark={props.registerQuickBookmark}
          registerFocusComposer={props.registerFocusComposer}
        />
      )}
      {tab === "summary" && (
        <AISummaryPanel
          sessionId={props.sessionId}
          userId={props.userId}
          isOwner={props.isOwner}
          notes={props.notes}
          session={props.session}
          transcript={props.transcript}
          setTranscript={props.setTranscript}
        />
      )}
      {tab === "chat" && (
        <ChatPanel
          sessionId={props.sessionId}
          userId={props.userId}
          isOwner={props.isOwner}
          notes={props.notes}
          session={props.session}
          transcript={props.transcript}
          onSeek={props.onSeek}
          onTypingChange={props.onTypingChange}
        />
      )}
      {tab === "cards" && (
        <FlashcardsPanel
          sessionId={props.sessionId}
          userId={props.userId}
          isOwner={props.isOwner}
          notes={props.notes}
          onSeek={props.onSeek}
        />
      )}
      {tab === "quiz" && (
        <QuizPanel
          sessionId={props.sessionId}
          userId={props.userId}
          isOwner={props.isOwner}
          notes={props.notes}
          session={props.session}
          transcript={props.transcript}
          onSeek={props.onSeek}
        />
      )}
      {tab === "checklist" && (
        <ChecklistPanel
          session={props.session}
          noteCount={props.notes.length}
          onCompleted={props.onCompleted}
          isOwner={props.isOwner}
        />
      )}
    </div>
  );
}
