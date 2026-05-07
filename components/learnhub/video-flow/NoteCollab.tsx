"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { MessageCircle, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { userColor, userInitials } from "./utils";

const REACTIONS = ["👍", "❤️", "🙋", "⭐", "💡", "🤔"];

type Comment = {
  _id: string;
  content: string;
  authorId: string;
  author: { name: string; avatarUrl?: string } | null;
  createdAt: number;
};

type Reactions = { counts: Record<string, number>; mine: string[] } | null;

type Props = {
  noteId: string;
  userId: Id<"learnhub_users"> | null;
  onTypingChange?: (typing: boolean) => void;
};

function relTime(at: number) {
  const diff = Date.now() - at;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NoteCollab({ noteId, userId, onTypingChange }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");

  const reactions = useQuery(
    api.learnhub_video_collab.listNoteReactions,
    {
      noteId: noteId as Id<"learnhub_video_notes">,
      ...(userId ? { viewerId: userId } : {}),
    }
  ) as Reactions;

  const comments = useQuery(
    api.learnhub_video_collab.listNoteComments,
    open
      ? {
          noteId: noteId as Id<"learnhub_video_notes">,
          ...(userId ? { viewerId: userId } : {}),
        }
      : "skip"
  ) as Comment[] | undefined;

  const toggleReaction = useMutation(api.learnhub_video_collab.toggleNoteReaction);
  const addComment = useMutation(api.learnhub_video_collab.addNoteComment);
  const deleteComment = useMutation(api.learnhub_video_collab.deleteNoteComment);

  const counts = reactions?.counts ?? {};
  const mine = new Set(reactions?.mine ?? []);
  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
  const commentCount = comments?.length ?? 0;

  async function react(emoji: string) {
    if (!userId) return;
    await toggleReaction({
      noteId: noteId as Id<"learnhub_video_notes">,
      userId,
      emoji,
    });
  }

  async function submit() {
    if (!userId || !content.trim()) return;
    await addComment({
      noteId: noteId as Id<"learnhub_video_notes">,
      authorId: userId,
      content: content.trim(),
    });
    setContent("");
  }

  return (
    <div className="vf-note-collab">
      <div className="vf-note-reactions">
        {REACTIONS.map((emoji) => {
          const count = counts[emoji] ?? 0;
          const active = mine.has(emoji);
          return (
            <button
              key={emoji}
              className={`vf-react-btn ${active ? "active" : ""}`}
              onClick={() => react(emoji)}
              disabled={!userId}
              title={active ? "Remove reaction" : `React with ${emoji}`}
            >
              <span>{emoji}</span>
              {count > 0 && <small>{count}</small>}
            </button>
          );
        })}
        <button className="vf-react-btn vf-react-toggle" onClick={() => setOpen(!open)} title="Comments">
          <MessageCircle size={12} />
          {commentCount > 0 && <small>{commentCount}</small>}
        </button>
      </div>

      {open && (
        <div className="vf-note-comments">
          {comments === undefined && <p className="vf-muted">Loading…</p>}
          {comments && comments.length === 0 && <p className="vf-muted">No comments yet. Start the discussion.</p>}
          {comments?.map((c) => {
            const canDelete = userId && c.authorId === userId;
            const color = userColor(c.authorId);
            return (
              <article key={c._id} className="vf-note-comment">
                <div className="vf-note-comment-avatar" style={{ background: color.hex }}>
                  {c.author?.avatarUrl
                    ? <img src={c.author.avatarUrl} alt="" />
                    : <span>{userInitials(c.author?.name)}</span>}
                </div>
                <div>
                  <p className="vf-note-comment-meta">
                    <strong>{c.author?.name ?? "Member"}</strong>
                    <small>{relTime(c.createdAt)}</small>
                  </p>
                  <p>{c.content}</p>
                  {canDelete && (
                    <button
                      className="vf-link-btn"
                      onClick={() => userId && deleteComment({
                        commentId: c._id as Id<"learnhub_video_note_comments">,
                        userId,
                      })}
                    >
                      <Trash2 size={11} /> delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {userId && (
            <div className="vf-note-comment-composer">
              <textarea
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
                placeholder="Reply to this note… (Ctrl/Cmd + Enter)"
                rows={2}
              />
              <button onClick={submit} disabled={!content.trim()}>Post</button>
            </div>
          )}
        </div>
      )}

      {!open && totalReactions === 0 && (
        <p className="vf-muted vf-note-collab-hint">No reactions or comments yet.</p>
      )}
    </div>
  );
}
