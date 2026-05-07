"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Hash, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtTime, iconForKind, labelForKind, userColor } from "./utils";
import { NoteCollab } from "./NoteCollab";
import type { NoteKind, VideoNote } from "./types";

type Props = {
  sessionId: string | null;
  userId: Id<"learnhub_users"> | null;
  isOwner: boolean;
  notes: VideoNote[];
  currentSec: number;
  ownerId?: string | null;
  onSeek: (sec: number) => void;
  onTypingChange?: (isTyping: boolean) => void;
  registerQuickBookmark?: (fn: () => void) => void;
  registerFocusComposer?: (fn: () => void) => void;
};

const KINDS: NoteKind[] = ["note", "question", "bookmark", "takeaway"];

function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\n]/)
        .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
        .filter((t) => t.length > 0 && t.length <= 24)
    )
  ).slice(0, 8);
}

export function NotesPanel({
  sessionId,
  userId,
  isOwner,
  notes,
  currentSec,
  ownerId,
  onSeek,
  onTypingChange,
  registerQuickBookmark,
  registerFocusComposer,
}: Props) {
  const accent = userColor(ownerId);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<NoteKind>("note");
  const [tagsInput, setTagsInput] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [filterKind, setFilterKind] = useState<NoteKind | "all">("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [editTagsValue, setEditTagsValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const createNote = useMutation(api.learnhub_video_flow.createNote);
  const deleteNote = useMutation(api.learnhub_video_flow.deleteNote);
  const setNoteTags = useMutation(api.learnhub_video_flow.setNoteTags);

  useEffect(() => {
    if (!registerQuickBookmark) return;
    registerQuickBookmark(async () => {
      if (!sessionId || !userId) return;
      await createNote({
        sessionId: sessionId as Id<"learnhub_video_sessions">,
        userId,
        timestampSec: currentSec,
        content: `Bookmark at ${fmtTime(currentSec)}`,
        kind: "bookmark",
        isShared: false,
      });
    });
  }, [registerQuickBookmark, sessionId, userId, currentSec, createNote]);

  useEffect(() => {
    if (!registerFocusComposer) return;
    registerFocusComposer(() => textareaRef.current?.focus());
  }, [registerFocusComposer]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) for (const t of n.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [notes]);

  async function submit() {
    if (!sessionId || !userId || !content.trim()) return;
    const tags = parseTags(tagsInput);
    const noteId = await createNote({
      sessionId: sessionId as Id<"learnhub_video_sessions">,
      userId,
      timestampSec: currentSec,
      content: content.trim(),
      kind,
      isShared,
    });
    if (tags.length > 0 && noteId) {
      await setNoteTags({
        noteId: noteId as Id<"learnhub_video_notes">,
        userId,
        tags,
      });
    }
    setContent("");
    setTagsInput("");
  }

  async function remove(noteId: string) {
    if (!userId) return;
    await deleteNote({ noteId: noteId as Id<"learnhub_video_notes">, userId });
  }

  async function saveTagEdit(noteId: string) {
    if (!userId) return;
    await setNoteTags({
      noteId: noteId as Id<"learnhub_video_notes">,
      userId,
      tags: parseTags(editTagsValue),
    });
    setEditingTagsFor(null);
    setEditTagsValue("");
  }

  const filtered = notes.filter((n) => {
    if (filterKind !== "all" && n.kind !== filterKind) return false;
    if (filterTag && !(n.tags ?? []).includes(filterTag)) return false;
    return true;
  });

  return (
    <div className="vf-tab-body">
      {isOwner && (
        <div className="vf-note-composer">
          <div className="vf-note-row">
            <select value={kind} onChange={(e) => setKind(e.target.value as NoteKind)}>
              <option value="note">Note</option>
              <option value="question">Question</option>
              <option value="bookmark">Bookmark</option>
              <option value="takeaway">Takeaway</option>
            </select>
            <span>{fmtTime(currentSec)}</span>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => onTypingChange?.(true)}
            onBlur={() => onTypingChange?.(false)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Capture what matters at this moment… (Ctrl/Cmd + Enter to save)"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onFocus={() => onTypingChange?.(true)}
            onBlur={() => onTypingChange?.(false)}
            placeholder="Tags (comma-separated, optional)"
            className="vf-tag-input"
          />
          <label>
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
            Include when timeline is shared
          </label>
          <button onClick={submit} disabled={!content.trim()}>Add timestamp</button>
        </div>
      )}

      <div className="vf-note-filter" role="tablist" aria-label="Filter notes">
        <button className={filterKind === "all" ? "active" : ""} onClick={() => setFilterKind("all")}>
          All ({notes.length})
        </button>
        {KINDS.map((k) => {
          const count = notes.filter((n) => n.kind === k).length;
          return (
            <button key={k} className={filterKind === k ? "active" : ""} onClick={() => setFilterKind(k)}>
              {labelForKind(k)} ({count})
            </button>
          );
        })}
      </div>

      {allTags.length > 0 && (
        <div className="vf-tag-cloud">
          <button
            className={`vf-tag-chip ${filterTag === null ? "active" : ""}`}
            onClick={() => setFilterTag(null)}
          >
            <Hash size={10} /> all tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`vf-tag-chip ${filterTag === tag ? "active" : ""}`}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
            >
              <Hash size={10} /> {tag}
            </button>
          ))}
        </div>
      )}

      <div className="vf-note-list">
        {filtered.length === 0 && <p className="vf-muted">No notes match this filter yet.</p>}
        {filtered.map((note) => (
          <article
            key={note._id}
            className={`vf-note vf-note-${note.kind}`}
            style={{ borderLeft: `3px solid ${accent.hex}` }}
          >
            <button onClick={() => onSeek(note.timestampSec)} className="vf-time-chip">
              {fmtTime(note.timestampSec)}
            </button>
            <div>
              <p className="vf-note-kind">
                {iconForKind(note.kind)} {labelForKind(note.kind)}
                {note.isShared && <span>Shared</span>}
              </p>
              <p>{note.content}</p>
              {(note.tags?.length ?? 0) > 0 && (
                <div className="vf-note-tags">
                  {note.tags!.map((t) => (
                    <button
                      key={t}
                      className={`vf-tag-chip vf-tag-chip-sm ${filterTag === t ? "active" : ""}`}
                      onClick={() => setFilterTag(filterTag === t ? null : t)}
                    >
                      <Hash size={9} /> {t}
                    </button>
                  ))}
                </div>
              )}
              {isOwner && editingTagsFor === note._id ? (
                <div className="vf-tag-edit-row">
                  <input
                    autoFocus
                    value={editTagsValue}
                    onChange={(e) => setEditTagsValue(e.target.value)}
                    onFocus={() => onTypingChange?.(true)}
                    onBlur={() => onTypingChange?.(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); void saveTagEdit(note._id); }
                      if (e.key === "Escape") { setEditingTagsFor(null); setEditTagsValue(""); }
                    }}
                    placeholder="comma, separated, tags"
                  />
                  <button className="vf-link-btn" onClick={() => saveTagEdit(note._id)}>Save</button>
                  <button className="vf-link-btn" onClick={() => { setEditingTagsFor(null); setEditTagsValue(""); }}>Cancel</button>
                </div>
              ) : isOwner && (
                <div className="vf-note-actions">
                  <button
                    className="vf-link-btn"
                    onClick={() => {
                      setEditingTagsFor(note._id);
                      setEditTagsValue((note.tags ?? []).join(", "));
                    }}
                  >
                    <Hash size={11} /> {note.tags?.length ? "edit tags" : "add tags"}
                  </button>
                  <button className="vf-link-btn" onClick={() => remove(note._id)}>
                    <Trash2 size={11} /> delete
                  </button>
                </div>
              )}
              <NoteCollab noteId={note._id} userId={userId} onTypingChange={onTypingChange} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
