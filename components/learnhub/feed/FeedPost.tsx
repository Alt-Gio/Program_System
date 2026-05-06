"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { YouTubePost } from "./post-types/YouTubePost";
import { MeetPost } from "./post-types/MeetPost";
import { DrivePost } from "./post-types/DrivePost";
import { FormPost } from "./post-types/FormPost";
import { OpportunityPost } from "./post-types/OpportunityPost";
import { CertificatePost } from "./post-types/CertificatePost";

export interface MockAuthor {
  id: string;
  name: string;
  avatarUrl: string;
  role: "student" | "mentor" | "org_partner";
}

export interface MockPost {
  id: string;
  convexPostId?: string;
  type:
    | "text"
    | "youtube"
    | "meet"
    | "drive"
    | "form"
    | "opportunity"
    | "certificate";
  author: MockAuthor;
  content: string;
  metadata: Record<string, unknown>;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: number;
}

const ROLE_BADGE: Record<
  MockAuthor["role"],
  { label: string; color: string }
> = {
  student: { label: "Student", color: "#22d3a0" },
  mentor: { label: "Mentor", color: "#5b6cff" },
  org_partner: { label: "Org Partner", color: "#ff8c42" },
};

function Avatar({ author }: { author: MockAuthor }) {
  return (
    <div className="relative shrink-0">
      <img
        src={author.avatarUrl}
        alt={author.name}
        width={38}
        height={38}
        className="rounded-full object-cover"
        style={{ background: "#1a1d30" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(author.name)}`;
        }}
      />
    </div>
  );
}

function PostBody({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 280;
  const needsTrunc = content.length > limit;
  const displayed = expanded ? content : content.slice(0, limit);

  const renderContent = (text: string) =>
    text.split(/(\s+)/).map((word, i) =>
      word.startsWith("#") ? (
        <span key={i} style={{ color: "#5b6cff" }}>
          {word}
        </span>
      ) : (
        word
      )
    );

  return (
    <p className="lh-post-text">
      {renderContent(displayed)}
      {needsTrunc && !expanded && "…"}
      {needsTrunc && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="ml-1 text-sm font-medium"
          style={{ color: "#5b6cff" }}
        >
          {expanded ? " Show less" : " Show more"}
        </button>
      )}
    </p>
  );
}

interface FeedPostProps {
  post: MockPost;
  userId?: string | null;
  onLike?: (postId: string) => void;
}

function CommentsSection({ convexPostId, userId, authorName }: { convexPostId: Id<"learnhub_posts">; userId: string | null; authorName?: string }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const comments = useQuery(api.learnhub_comments.listCommentsWithAuthors, { postId: convexPostId });
  const createComment = useMutation(api.learnhub_comments.createComment);

  const submit = async () => {
    if (!text.trim() || !userId) return;
    setPosting(true);
    try {
      await createComment({ postId: convexPostId, authorId: userId as Id<"learnhub_users">, content: text.trim() });
      setText("");
    } finally { setPosting(false); }
  };

  return (
    <div className="lh-comment-thread">
      {comments === undefined && (
        <div style={{ display: "flex", gap: 8, paddingTop: 10 }}>
          <div className="lh-skeleton" style={{ height: 32, flex: 1 }} />
          <div className="lh-skeleton" style={{ height: 32, flex: 1 }} />
        </div>
      )}
      {(comments ?? []).map((c) => (
        <div key={c._id} className="lh-comment-item">
          <img
            src={c.author?.avatarUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.author?.name ?? "U")}`}
            width={28} height={28}
            className="lh-comment-avatar"
            alt=""
          />
          <div className="lh-comment-bubble">
            <div className="lh-comment-author">{c.author?.name ?? "User"}</div>
            <div className="lh-comment-text">{c.content}</div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, paddingTop: 10 }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
          placeholder={userId ? "Add a comment…" : "Sign in to comment"}
          disabled={!userId || posting}
          className="lh-comment-input"
          style={{ flex: 1 }}
        />
        {text.trim() && userId && (
          <button
            onClick={submit}
            disabled={posting}
            className="lh-composer-submit"
            style={{ padding: "7px 16px" }}
          >
            {posting ? "…" : "Post"}
          </button>
        )}
      </div>
    </div>
  );
}

export function FeedPost({ post, userId, onLike }: FeedPostProps) {
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);
  const badge = ROLE_BADGE[post.author.role];
  const likePost = useMutation(api.learnhub_posts.likePost);
  const unlikePost = useMutation(api.learnhub_posts.unlikePost);

  const handleLike = () => {
    const nowLiked = !liked;
    setLiked(nowLiked);
    setLocalLikes((c) => (nowLiked ? c + 1 : c - 1));
    if (userId && post.convexPostId) {
      const id = post.convexPostId as Id<"learnhub_posts">;
      const uid = userId as Id<"learnhub_users">;
      (nowLiked ? likePost : unlikePost)({ postId: id, userId: uid });
    }
    if (nowLiked) onLike?.(post.id);
  };

  const commentInputRef = useRef<HTMLInputElement>(null);

  return (
    <article
      id={post.convexPostId ? `post-${post.convexPostId}` : undefined}
      className={`lh-post${post.isPinned ? " lh-post-pinned" : ""}`}
      style={{ scrollMarginTop: 80 }}
    >
      {/* Pinned banner */}
      {post.isPinned && (
        <div className="lh-pinned-banner">
          <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Pinned post
        </div>
      )}

      {/* Header */}
      <div className="lh-post-header">
        <div className="lh-post-author-wrap">
          <div className="lh-post-avatar-wrap">
            <img
              src={post.author.avatarUrl}
              alt={post.author.name}
              className="lh-post-avatar"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(post.author.name)}`;
              }}
            />
          </div>
          <div>
            <div className="lh-post-author-name">
              {post.author.name}
              {post.author.role === "mentor" && (
                <span className="lh-verify-badge-sm" title="Mentor">✓</span>
              )}
              <span
                className="lh-role-badge"
                style={{ background: badge.color + "20", color: badge.color }}
              >
                {badge.label}
              </span>
            </div>
            <div className="lh-post-meta">
              {formatDistanceToNow(post.createdAt, { addSuffix: true })}
            </div>
          </div>
        </div>
        <button className="lh-icon-btn" style={{ width: 30, height: 30, fontSize: 14 }} aria-label="More">
          •••
        </button>
      </div>

      {/* Body */}
      <div className="lh-post-body">
        <PostBody content={post.content} />
      </div>

      {/* Thumbnail (any post type) */}
      {Boolean(post.metadata.thumbnailUrl) && (
        <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden" }}>
          <img
            src={String(post.metadata.thumbnailUrl)}
            alt="Post attachment"
            style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Media */}
      {post.type === "youtube" && <div style={{ marginTop: 10 }}><YouTubePost metadata={post.metadata} /></div>}
      {post.type === "meet"    && <div style={{ marginTop: 10 }}><MeetPost    metadata={post.metadata} /></div>}
      {post.type === "drive"   && <div style={{ marginTop: 10 }}><DrivePost   metadata={post.metadata} /></div>}
      {post.type === "form"    && <div style={{ marginTop: 10 }}><FormPost    metadata={post.metadata} /></div>}
      {post.type === "opportunity" && <div style={{ marginTop: 10 }}><OpportunityPost metadata={post.metadata} /></div>}
      {post.type === "certificate" && <div style={{ marginTop: 10 }}><CertificatePost metadata={post.metadata} /></div>}

      {/* Engagement line */}
      {localLikes > 0 && (
        <div className="lh-post-engagement">
          <span className="lh-liked-text">❤️ {localLikes} {localLikes === 1 ? "like" : "likes"}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="lh-post-actions">
        <button
          onClick={handleLike}
          className={`lh-action-btn${liked ? " liked" : ""}`}
        >
          <span className="lh-action-icon">{liked ? "❤️" : "🤍"}</span>
          {localLikes > 0 && <span>{localLikes}</span>}
        </button>

        <button
          onClick={() => {
            setShowComments((s) => !s);
            setTimeout(() => commentInputRef.current?.focus(), 100);
          }}
          className="lh-action-btn"
        >
          <span className="lh-action-icon">💬</span>
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
        </button>

        <button
          onClick={() => {
            if (navigator.share) { navigator.share({ url: window.location.href }); }
            else { navigator.clipboard.writeText(window.location.href); }
          }}
          className="lh-action-btn"
        >
          <span className="lh-action-icon">↗️</span>
        </button>

        <button className="lh-action-btn lh-action-save" title="Save to Learning Path">
          🔖
        </button>
      </div>

      {/* Inline comment input (always visible) */}
      <div className="lh-post-comment-wrap">
        <div
          style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: "var(--lh-accent-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "white", fontWeight: 700,
          }}
        >
          {userId ? "Me" : "?"}
        </div>
        <input
          ref={commentInputRef}
          placeholder="Write a comment…"
          className="lh-comment-input"
          disabled={!userId}
          onFocus={() => setShowComments(true)}
        />
      </div>

      {/* Comments thread */}
      {showComments && post.convexPostId && (
        <CommentsSection
          convexPostId={post.convexPostId as Id<"learnhub_posts">}
          userId={userId ?? null}
          authorName={post.author.name}
        />
      )}
      {showComments && !post.convexPostId && (
        <div className="lh-comment-thread">
          <p style={{ fontSize: 12, color: "var(--lh-text-3)", paddingTop: 8 }}>
            Comments available for live posts only.
          </p>
        </div>
      )}
    </article>
  );
}
