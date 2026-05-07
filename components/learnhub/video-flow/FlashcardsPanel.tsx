"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Layers, Plus, RotateCw, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtTime } from "./utils";
import type { VideoNote } from "./types";

type Flashcard = {
  _id: string;
  sessionId: string;
  userId: string;
  sourceNoteId?: string;
  front: string;
  back: string;
  timestampSec?: number;
  ease: number;
  intervalDays: number;
  reviewCount: number;
  dueAt: number;
  lastReviewedAt?: number;
};

type Props = {
  sessionId: string | null;
  userId: Id<"learnhub_users"> | null;
  isOwner: boolean;
  notes: VideoNote[];
  onSeek: (sec: number) => void;
};

export function FlashcardsPanel({ sessionId, userId, isOwner, notes, onSeek }: Props) {
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [studyMode, setStudyMode] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  const cards = useQuery(
    api.learnhub_video_flow.listSessionFlashcards,
    sessionId && userId
      ? { sessionId: sessionId as Id<"learnhub_video_sessions">, userId }
      : "skip"
  ) as Flashcard[] | undefined;

  const createCard = useMutation(api.learnhub_video_flow.createFlashcard);
  const reviewCard = useMutation(api.learnhub_video_flow.reviewFlashcard);
  const deleteCard = useMutation(api.learnhub_video_flow.deleteFlashcard);

  const dueQueue = useMemo(() => {
    if (!cards) return [];
    const now = Date.now();
    return cards.filter((c) => c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
  }, [cards]);

  async function addCustomCard() {
    if (!sessionId || !userId || !newFront.trim() || !newBack.trim()) return;
    await createCard({
      sessionId: sessionId as Id<"learnhub_video_sessions">,
      userId,
      front: newFront.trim(),
      back: newBack.trim(),
    });
    setNewFront("");
    setNewBack("");
  }

  async function noteToCard(note: VideoNote) {
    if (!sessionId || !userId) return;
    const front = note.kind === "question"
      ? note.content
      : `What does the video say at ${fmtTime(note.timestampSec)}?`;
    const back = note.kind === "question" ? `(Add an answer for: ${note.content})` : note.content;
    await createCard({
      sessionId: sessionId as Id<"learnhub_video_sessions">,
      userId,
      front,
      back,
      sourceNoteId: note._id as Id<"learnhub_video_notes">,
      timestampSec: note.timestampSec,
    });
  }

  async function rate(rating: "hard" | "good" | "easy") {
    const card = dueQueue[studyIndex];
    if (!card || !userId) return;
    await reviewCard({ cardId: card._id as Id<"learnhub_video_flashcards">, userId, rating });
    setShowBack(false);
    if (studyIndex + 1 >= dueQueue.length) {
      setStudyMode(false);
      setStudyIndex(0);
    } else {
      setStudyIndex(studyIndex + 1);
    }
  }

  if (!cards) {
    return <div className="vf-tab-body"><p className="vf-muted">Loading cards…</p></div>;
  }

  if (studyMode && dueQueue.length > 0) {
    const card = dueQueue[studyIndex];
    return (
      <div className="vf-tab-body">
        <div className="vf-card-progress">
          Card {studyIndex + 1} of {dueQueue.length}
        </div>
        <div className={`vf-flashcard ${showBack ? "flipped" : ""}`} onClick={() => setShowBack(!showBack)}>
          <div className="vf-flashcard-side vf-flashcard-front">
            <span className="vf-flashcard-hint">Front · click to flip</span>
            <p>{card.front}</p>
            {card.timestampSec !== undefined && (
              <button
                className="vf-time-chip"
                onClick={(e) => { e.stopPropagation(); onSeek(card.timestampSec!); }}
              >
                {fmtTime(card.timestampSec)}
              </button>
            )}
          </div>
          {showBack && (
            <div className="vf-flashcard-side vf-flashcard-back">
              <span className="vf-flashcard-hint">Back</span>
              <p>{card.back}</p>
            </div>
          )}
        </div>
        {showBack ? (
          <div className="vf-card-rate">
            <button className="vf-rate-btn vf-rate-hard" onClick={() => rate("hard")}>Hard<small>~1d</small></button>
            <button className="vf-rate-btn vf-rate-good" onClick={() => rate("good")}>Good<small>~{Math.round(card.intervalDays * card.ease) || 1}d</small></button>
            <button className="vf-rate-btn vf-rate-easy" onClick={() => rate("easy")}>Easy<small>~{Math.round(card.intervalDays * card.ease * 1.3) || 4}d</small></button>
          </div>
        ) : (
          <button className="vf-ghost-btn vf-full" onClick={() => setShowBack(true)}>Show answer</button>
        )}
        <button
          className="vf-link-btn"
          onClick={() => { setStudyMode(false); setShowBack(false); setStudyIndex(0); }}
        >
          End review
        </button>
      </div>
    );
  }

  return (
    <div className="vf-tab-body">
      <div className="vf-card-stats">
        <div><strong>{cards.length}</strong><span>total</span></div>
        <div><strong>{dueQueue.length}</strong><span>due now</span></div>
        <div><strong>{cards.filter((c) => c.reviewCount > 0).length}</strong><span>reviewed</span></div>
      </div>

      {dueQueue.length > 0 && (
        <button
          className="vf-primary-btn vf-full"
          onClick={() => { setStudyMode(true); setStudyIndex(0); setShowBack(false); }}
        >
          <Layers size={15} /> Review {dueQueue.length} due card{dueQueue.length === 1 ? "" : "s"}
        </button>
      )}

      {isOwner && (
        <details className="vf-card-creator">
          <summary><Plus size={14} /> New flashcard</summary>
          <input
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
            placeholder="Front (question / cue)"
          />
          <textarea
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            placeholder="Back (answer / explanation)"
            rows={3}
          />
          <button onClick={addCustomCard} disabled={!newFront.trim() || !newBack.trim()}>Add card</button>
        </details>
      )}

      {isOwner && notes.length > 0 && (
        <details className="vf-card-from-notes">
          <summary><RotateCw size={14} /> Convert notes to cards</summary>
          <div className="vf-card-note-list">
            {notes.map((n) => (
              <button key={n._id} onClick={() => noteToCard(n)}>
                <span className="vf-time-chip">{fmtTime(n.timestampSec)}</span>
                <span>{n.content.slice(0, 80)}</span>
              </button>
            ))}
          </div>
        </details>
      )}

      <h3 className="vf-card-list-heading">All cards ({cards.length})</h3>
      {cards.length === 0 && <p className="vf-muted">Create flashcards from notes or write your own.</p>}
      <div className="vf-card-list">
        {cards.map((c) => {
          const dueLabel = c.dueAt <= Date.now()
            ? "Due now"
            : `Due in ${Math.max(1, Math.round((c.dueAt - Date.now()) / 86400000))}d`;
          return (
            <article key={c._id} className="vf-card-item">
              <div className="vf-card-item-text">
                <strong>{c.front}</strong>
                <p>{c.back}</p>
              </div>
              <div className="vf-card-item-meta">
                <span>{dueLabel}</span>
                {c.timestampSec !== undefined && (
                  <button className="vf-time-chip" onClick={() => onSeek(c.timestampSec!)}>
                    {fmtTime(c.timestampSec)}
                  </button>
                )}
                {isOwner && (
                  <button
                    className="vf-link-btn"
                    onClick={() => userId && deleteCard({ cardId: c._id as Id<"learnhub_video_flashcards">, userId })}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
