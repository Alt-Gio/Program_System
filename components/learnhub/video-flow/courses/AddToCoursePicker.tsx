"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Check, Plus, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Course = {
  _id: string;
  title: string;
  itemCount: number;
};

type Membership = { courseId: string; itemId: string };

type Props = {
  open: boolean;
  onClose: () => void;
  userId: Id<"learnhub_users"> | null;
  videoId: string;
  videoTitle?: string;
  videoChannel?: string;
  videoThumbnail?: string;
};

export function AddToCoursePicker({ open, onClose, userId, videoId, videoTitle, videoChannel, videoThumbnail }: Props) {
  const [creatingTitle, setCreatingTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const courses = useQuery(
    api.learnhub_video_courses.listMyCourses,
    open && userId ? { ownerId: userId } : "skip"
  ) as Course[] | undefined;

  const memberships = useQuery(
    api.learnhub_video_courses.listCoursesContainingVideo,
    open && userId ? { ownerId: userId, videoId } : "skip"
  ) as Membership[] | undefined;

  const addItem = useMutation(api.learnhub_video_courses.addCourseItem);
  const removeItem = useMutation(api.learnhub_video_courses.removeCourseItem);
  const createCourse = useMutation(api.learnhub_video_courses.createCourse);

  if (!open) return null;

  async function toggle(course: Course) {
    if (!userId) return;
    setAdding(true);
    const member = memberships?.find((m) => m.courseId === course._id);
    if (member) {
      await removeItem({
        itemId: member.itemId as Id<"learnhub_video_course_items">,
        ownerId: userId,
      });
    } else {
      await addItem({
        courseId: course._id as Id<"learnhub_video_courses">,
        ownerId: userId,
        videoId,
        ...(videoTitle ? { title: videoTitle } : {}),
        ...(videoChannel ? { channelName: videoChannel } : {}),
        ...(videoThumbnail ? { thumbnail: videoThumbnail } : {}),
      });
    }
    setAdding(false);
  }

  async function handleCreateAndAdd() {
    if (!userId || !creatingTitle.trim()) return;
    setAdding(true);
    const courseId = await createCourse({
      ownerId: userId,
      title: creatingTitle.trim(),
    });
    if (courseId) {
      await addItem({
        courseId: courseId as Id<"learnhub_video_courses">,
        ownerId: userId,
        videoId,
        ...(videoTitle ? { title: videoTitle } : {}),
        ...(videoChannel ? { channelName: videoChannel } : {}),
        ...(videoThumbnail ? { thumbnail: videoThumbnail } : {}),
      });
    }
    setCreatingTitle("");
    setAdding(false);
  }

  return (
    <div className="vf-modal-backdrop" onClick={onClose}>
      <div className="vf-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Add to course</h2>
          <button className="vf-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <p className="vf-muted">Group this video with related ones to track combined progress.</p>

        <div className="vf-add-course-list">
          {(courses ?? []).length === 0 && <p className="vf-muted">You don't have any courses yet.</p>}
          {(courses ?? []).map((c) => {
            const inCourse = memberships?.some((m) => m.courseId === c._id);
            return (
              <button
                key={c._id}
                className={`vf-add-course-row ${inCourse ? "selected" : ""}`}
                onClick={() => toggle(c)}
                disabled={adding}
              >
                <BookOpen size={14} />
                <span>
                  <strong>{c.title}</strong>
                  <small>{c.itemCount} video{c.itemCount === 1 ? "" : "s"}</small>
                </span>
                {inCourse ? <Check size={16} /> : <Plus size={16} />}
              </button>
            );
          })}
        </div>

        <div className="vf-add-course-create">
          <input
            value={creatingTitle}
            onChange={(e) => setCreatingTitle(e.target.value)}
            placeholder="New course title"
            onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
          />
          <button
            className="vf-primary-btn vf-primary-btn-sm"
            onClick={handleCreateAndAdd}
            disabled={!creatingTitle.trim() || adding}
          >
            <Plus size={14} /> Create &amp; add
          </button>
        </div>
      </div>
    </div>
  );
}
