"use client";

/**
 * Rec #3 — cohort-scoped posts tab.
 *
 * Composer (text-only for v1) + scrollable list of posts pinned to this
 * cohort (learnhub_posts.groupId === groupId). Reuses the existing
 * learnhub_posts table — no parallel storage.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel";

const CARD = "#111323";
const CARD2 = "#161929";
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT = "#e8eaf4";
const MUTED = "rgba(185,190,230,0.6)";
const INDIGO = "#6366f1";

export function CohortPostsFeed({
  groupId,
  canPost,
}: {
  groupId: Id<"learnhub_groups">;
  canPost: boolean;
}) {
  const { userId } = useLearnhubSession();
  const posts = useQuery(api.learnhub_posts.listCohortPosts, { groupId, limit: 30 });
  const createPost = useMutation(api.learnhub_posts.createCohortPost);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePost = async () => {
    if (!userId || !draft.trim()) return;
    setPosting(true);
    setErr(null);
    try {
      await createPost({
        authorId: userId as Id<"learnhub_users">,
        groupId,
        content: draft.trim(),
      });
      setDraft("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Composer */}
      {canPost && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share an update with your cohort — #hashtags work too"
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${BORDER2}`,
              color: TEXT,
              fontSize: 13,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          {err && <p style={{ color: "#fca5a5", fontSize: 12, margin: "6px 0 0" }}>{err}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: MUTED }}>{draft.length}/2000</span>
            <button
              onClick={handlePost}
              disabled={posting || !draft.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: 99,
                background: INDIGO,
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                opacity: posting || !draft.trim() ? 0.5 : 1,
              }}
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {posts === undefined ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Loading…</p>
      ) : posts.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, textAlign: "center", color: MUTED }}>
          <p style={{ margin: 0, fontSize: 13 }}>No posts yet.</p>
          <p style={{ margin: "6px 0 0", fontSize: 12 }}>
            {canPost ? "Be the first to share something with your cohort 👋" : "Members can post here once they join."}
          </p>
        </div>
      ) : (
        posts.map((p) => (
          <article key={p._id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              {p.author && (
                <img src={p.author.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>
                  {p.author?.name ?? "Unknown"}
                </p>
                <p style={{ margin: "1px 0 0", fontSize: 11, color: MUTED }}>
                  {formatDistanceToNow(p.createdAt, { addSuffix: true })}
                </p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: TEXT, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {p.content}
            </p>
            <div style={{ marginTop: 8, fontSize: 11, color: MUTED, display: "flex", gap: 12 }}>
              <span>♥ {p.likeCount}</span>
              <span>💬 {p.commentCount}</span>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
