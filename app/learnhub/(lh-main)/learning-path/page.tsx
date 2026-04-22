"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDistanceToNow } from "date-fns";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

type ConvexUserId = (typeof api.learnhub_bookmarks.listBookmarks extends (...args: infer A) => unknown ? A[1] extends { userId: infer U } ? U : never : never);
type BookmarkStatus = "want_to_learn" | "in_progress" | "done";

const COLUMNS: { id: BookmarkStatus; label: string; emoji: string; color: string }[] = [
  { id: "want_to_learn", label: "Want to Learn", emoji: "🎯", color: "#5b6cff" },
  { id: "in_progress", label: "In Progress", emoji: "⚡", color: "#ff8c42" },
  { id: "done", label: "Done", emoji: "✅", color: "#22d3a0" },
];

export default function LearningPathPage() {
  const { userId } = useLearnhubSession();

  const bookmarks = useQuery(api.learnhub_bookmarks.listBookmarks, userId ? { userId: userId as ConvexUserId } : "skip");
  const upsertBookmark = useMutation(api.learnhub_bookmarks.upsertBookmark);
  const removeBookmark = useMutation(api.learnhub_bookmarks.removeBookmark);

  const moveCard = async (bookmarkId: string, postId: string, status: BookmarkStatus) => {
    if (!userId) return;
    await upsertBookmark({ userId: userId as ConvexUserId, postId: postId as Parameters<typeof upsertBookmark>[0]["postId"], status });
  };

  const removeCard = async (bookmarkId: string) => {
    await removeBookmark({ bookmarkId: bookmarkId as Parameters<typeof removeBookmark>[0]["bookmarkId"] });
  };

  const grouped: Record<BookmarkStatus, typeof bookmarks> = {
    want_to_learn: bookmarks?.filter((b) => b.status === "want_to_learn"),
    in_progress: bookmarks?.filter((b) => b.status === "in_progress"),
    done: bookmarks?.filter((b) => b.status === "done"),
  };

  const totalDone = grouped.done?.length ?? 0;

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>My Learning Path</h1>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>Bookmarked content organized by your progress · {totalDone} completed</p>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.id];
          return (
            <div key={col.id} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-base">{col.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: col.color, fontFamily: "var(--font-sora)" }}>{col.label}</span>
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: col.color + "20", color: col.color }}>
                  {items?.length ?? 0}
                </span>
              </div>

              {/* Column drop zone */}
              <div className="flex flex-col gap-2 min-h-24 rounded-2xl p-2" style={{ background: "rgba(255,255,255,0.02)", border: `1px dashed ${col.color}25` }}>
                {items === undefined && Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#131626" }} />
                ))}

                {items?.length === 0 && (
                  <div className="flex items-center justify-center h-20">
                    <p className="text-xs text-center" style={{ color: "#5c6490" }}>
                      {col.id === "want_to_learn" ? "Bookmark posts from the Feed" : `Move cards here when ${col.id === "in_progress" ? "you start" : "complete"}`}
                    </p>
                  </div>
                )}

                {items?.map((bookmark) => {
                  const post = bookmark.post as Record<string, unknown> | null;
                  if (!post) return null;
                  const otherStatuses = COLUMNS.filter((c) => c.id !== col.id);
                  return (
                    <div key={bookmark._id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-xs font-medium line-clamp-2" style={{ color: "#e8eaff" }}>
                        {(post.content as string)?.slice(0, 80)}{(post.content as string)?.length > 80 ? "…" : ""}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: "rgba(255,255,255,0.05)", color: "#9ba3cc" }}>{post.type as string}</span>
                        <span className="text-[10px]" style={{ color: "#5c6490" }}>{formatDistanceToNow(bookmark.updatedAt, { addSuffix: true })}</span>
                      </div>
                      <div className="flex gap-1">
                        {otherStatuses.map((s) => (
                          <button key={s.id} onClick={() => moveCard(bookmark._id, bookmark.postId, s.id)} className="flex-1 text-[10px] py-1 rounded-lg transition-all font-medium" style={{ background: s.color + "15", color: s.color, border: `1px solid ${s.color}25` }}>
                            → {s.label.split(" ")[0]}
                          </button>
                        ))}
                        <button onClick={() => removeCard(bookmark._id)} className="px-2 py-1 rounded-lg text-[10px] transition-all" style={{ color: "#5c6490" }} title="Remove bookmark">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {bookmarks?.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-4xl mb-3">🗂️</p>
          <p className="font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Your board is empty</p>
          <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>Save posts from the Feed using the bookmark icon to track your learning progress.</p>
        </div>
      )}
    </div>
  );
}
