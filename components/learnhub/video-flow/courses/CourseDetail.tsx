"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, GripVertical, Lock, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { VideoFlowWorkspace } from "@/components/learnhub/video-flow/VideoFlowWorkspace";
import { extractYouTubeId, fmtTime } from "@/components/learnhub/video-flow/utils";

type Course = {
  _id: string;
  ownerId: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "archived";
  visibility: "private" | "learnhub" | "public";
  itemCount: number;
};

type Item = {
  _id: string;
  courseId: string;
  ownerId: string;
  videoId: string;
  title?: string;
  channelName?: string;
  thumbnail?: string;
  position: number;
  itemNote?: string;
};

type Bundle = {
  course: Course;
  items: Item[];
  owner: { name: string; avatarUrl?: string } | null;
  progressByVideoId: Record<string, { progressPct: number; lastPositionSec: number; sessionId: string; status: string }>;
  totalProgress: number;
  completedCount: number;
};

export function CourseDetail({ courseId }: { courseId: Id<"learnhub_video_courses"> }) {
  const { userId, session, loading } = useLearnhubSession();
  const [activeIndex, setActiveIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bundle = useQuery(
    api.learnhub_video_courses.getCourseWithProgress,
    userId
      ? { courseId, viewerId: userId }
      : "skip"
  ) as Bundle | null | undefined;

  const addItem = useMutation(api.learnhub_video_courses.addCourseItem);
  const removeItem = useMutation(api.learnhub_video_courses.removeCourseItem);
  const reorderItems = useMutation(api.learnhub_video_courses.reorderCourseItems);

  const items = bundle?.items ?? [];
  const isOwner = Boolean(userId && bundle?.course.ownerId === userId);
  const activeItem = items[activeIndex] ?? null;

  useEffect(() => {
    if (items.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= items.length) setActiveIndex(items.length - 1);
  }, [items.length]);

  if (loading) return <div className="vf-shell"><div className="lh-skeleton" style={{ height: 360 }} /></div>;
  if (!session) {
    return (
      <div className="vf-shell">
        <div className="vf-empty-card">
          <Lock size={34} />
          <h1>Sign in to view this course</h1>
          <Link href="/login/student" className="vf-primary-btn">Continue with Google</Link>
        </div>
      </div>
    );
  }

  if (bundle === undefined) return <div className="vf-shell"><div className="lh-skeleton" style={{ height: 360 }} /></div>;
  if (bundle === null) {
    return (
      <div className="vf-shell">
        <div className="vf-empty-card">
          <h1>Course not found</h1>
          <p>This course may be private or no longer exists.</p>
          <Link href="/learnhub/courses" className="vf-primary-btn">Back to courses</Link>
        </div>
      </div>
    );
  }

  async function handleAdd() {
    if (!userId) return;
    const videoId = extractYouTubeId(newUrl);
    if (!videoId) {
      setError("Paste a valid YouTube URL or video ID.");
      return;
    }
    setError(null);
    await addItem({
      courseId,
      ownerId: userId,
      videoId,
      ...(newTitle.trim() ? { title: newTitle.trim() } : {}),
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    });
    setNewUrl("");
    setNewTitle("");
    setAdding(false);
  }

  async function handleRemove(itemId: string) {
    if (!userId) return;
    await removeItem({ itemId: itemId as Id<"learnhub_video_course_items">, ownerId: userId });
  }

  async function handleMove(itemId: string, direction: -1 | 1) {
    if (!userId) return;
    const idx = items.findIndex((it) => it._id === itemId);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    await reorderItems({
      courseId,
      ownerId: userId,
      orderedItemIds: reordered.map((it) => it._id) as Id<"learnhub_video_course_items">[],
    });
    if (activeIndex === idx) setActiveIndex(targetIdx);
  }

  function progressFor(item: Item) {
    return bundle?.progressByVideoId[item.videoId];
  }

  function statusFor(item: Item) {
    const p = progressFor(item);
    if (!p) return "not_started";
    return p.status;
  }

  return (
    <div className="vf-shell vf-course-shell">
      <div className="vf-course-header">
        <Link href="/learnhub/courses" className="vf-link-btn"><ArrowLeft size={14} /> All courses</Link>
        <h1>{bundle.course.title}</h1>
        {bundle.course.description && <p className="vf-muted">{bundle.course.description}</p>}
        <div className="vf-course-stats">
          <span><strong>{bundle.completedCount}/{items.length}</strong> videos completed</span>
          <span><strong>{bundle.totalProgress}%</strong> course progress</span>
        </div>
        <div className="vf-progress-track"><span style={{ width: `${bundle.totalProgress}%` }} /></div>
      </div>

      <div className="vf-course-layout">
        <aside className="vf-course-sidebar">
          <header>
            <h2>Curriculum</h2>
            {isOwner && (
              <button className="vf-icon-btn" onClick={() => setAdding(true)} title="Add video">
                <Plus size={14} />
              </button>
            )}
          </header>

          {adding && (
            <div className="vf-course-add">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="YouTube URL or video ID"
                autoFocus
              />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Optional title"
              />
              {error && <p className="vf-error">{error}</p>}
              <div className="vf-course-add-actions">
                <button className="vf-primary-btn vf-primary-btn-sm" onClick={handleAdd}>Add</button>
                <button className="vf-ghost-btn vf-ghost-btn-sm" onClick={() => { setAdding(false); setError(null); }}>Cancel</button>
              </div>
            </div>
          )}

          {items.length === 0 && <p className="vf-muted">No videos in this course yet.</p>}

          <ol className="vf-course-items">
            {items.map((item, i) => {
              const p = progressFor(item);
              const completed = (p?.progressPct ?? 0) >= 95;
              const isActive = i === activeIndex;
              return (
                <li
                  key={item._id}
                  className={`vf-course-item ${isActive ? "active" : ""} ${completed ? "completed" : ""}`}
                >
                  <button className="vf-course-item-main" onClick={() => setActiveIndex(i)}>
                    <span className="vf-course-item-pos">
                      {completed ? <Check size={12} /> : i + 1}
                    </span>
                    <img
                      src={item.thumbnail ?? `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                      alt=""
                    />
                    <div className="vf-course-item-text">
                      <strong>{item.title ?? `Video ${i + 1}`}</strong>
                      <small>
                        {p
                          ? `${p.progressPct}% · ${fmtTime(p.lastPositionSec)}`
                          : "Not started"}
                      </small>
                    </div>
                    {isActive && <ChevronRight size={14} />}
                  </button>
                  {isOwner && (
                    <div className="vf-course-item-controls">
                      <button onClick={() => handleMove(item._id, -1)} disabled={i === 0} title="Move up">
                        <GripVertical size={12} style={{ transform: "rotate(180deg)" }} />
                      </button>
                      <button onClick={() => handleMove(item._id, 1)} disabled={i === items.length - 1} title="Move down">
                        <GripVertical size={12} />
                      </button>
                      <button onClick={() => handleRemove(item._id)} title="Remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {activeItem && activeIndex < items.length - 1 && progressFor(activeItem) && (progressFor(activeItem)!.progressPct ?? 0) >= 95 && (
            <button
              className="vf-primary-btn vf-full"
              onClick={() => setActiveIndex(activeIndex + 1)}
            >
              Next video <ArrowRight size={14} />
            </button>
          )}
        </aside>

        <main className="vf-course-main">
          {activeItem ? (
            <VideoFlowWorkspace
              key={activeItem.videoId}
              initialVideoId={activeItem.videoId}
              initialTitle={activeItem.title ?? null}
              initialThumbnail={activeItem.thumbnail ?? null}
              initialChannelName={activeItem.channelName ?? null}
            />
          ) : (
            <div className="vf-empty-card">
              <h2>This course is empty</h2>
              <p>{isOwner ? "Add your first video using the + button on the left." : "The owner hasn't added videos yet."}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
