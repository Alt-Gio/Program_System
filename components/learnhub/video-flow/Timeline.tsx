"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { fmtTime, labelForKind } from "./utils";
import type { NoteKind, TimelineEvent, VideoNote } from "./types";

type Props = {
  timeline: TimelineEvent[];
  notes: VideoNote[];
  onSeek: (sec: number) => void;
};

export function LearningTimeline({ timeline, notes, onSeek }: Props) {
  const items = useMemo(() => {
    const noteItems = notes.map((note) => ({
      id: `note-${note._id}`,
      at: note.createdAt,
      timestampSec: note.timestampSec,
      label: `${labelForKind(note.kind as NoteKind)} · ${fmtTime(note.timestampSec)}`,
      message: note.content,
    }));
    const eventItems = timeline
      .filter((event) => event.type !== "note" && event.type !== "question")
      .map((event) => ({
        id: `event-${event._id}`,
        at: event.createdAt,
        timestampSec: event.timestampSec,
        label: event.type.replace("_", " "),
        message: event.message,
      }));
    return [...noteItems, ...eventItems].sort((a, b) => a.at - b.at);
  }, [timeline, notes]);

  return (
    <section className="vf-timeline-card">
      <div className="vf-section-head">
        <FileText size={16} />
        <div>
          <h2>Learning timeline</h2>
          <p>A detailed record of how this video was learned.</p>
        </div>
      </div>
      {items.length === 0 && <p className="vf-muted">Progress and notes will build your timeline.</p>}
      <div className="vf-timeline-list">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => item.timestampSec !== undefined && onSeek(item.timestampSec)}
          >
            <span />
            <strong>{item.label}</strong>
            <small>{item.message}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
