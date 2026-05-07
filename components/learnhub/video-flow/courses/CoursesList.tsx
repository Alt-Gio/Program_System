"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Lock, Plus, BookOpen, ArrowRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

type Course = {
  _id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  status: "draft" | "active" | "archived";
  visibility: "private" | "learnhub" | "public";
  itemCount: number;
  createdAt: number;
  updatedAt: number;
};

export function CoursesList() {
  const { userId, session, loading } = useLearnhubSession();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const courses = useQuery(
    api.learnhub_video_courses.listMyCourses,
    userId ? { ownerId: userId } : "skip"
  ) as Course[] | undefined;
  const createCourse = useMutation(api.learnhub_video_courses.createCourse);

  if (loading) return <div className="vf-shell"><div className="lh-skeleton" style={{ height: 320 }} /></div>;

  if (!session) {
    return (
      <div className="vf-shell">
        <div className="vf-empty-card">
          <Lock size={34} />
          <h1>Sign in to use Courses</h1>
          <p>Group videos into courses to learn structured paths and track full-course progress.</p>
          <Link href="/login/student" className="vf-primary-btn">Continue with Google</Link>
        </div>
      </div>
    );
  }

  async function submit() {
    if (!userId || !title.trim()) return;
    await createCourse({
      ownerId: userId,
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    setTitle("");
    setDescription("");
    setCreating(false);
  }

  return (
    <div className="vf-shell">
      <div className="vf-courses-header">
        <div>
          <p className="vf-eyebrow"><BookOpen size={14} /> Courses</p>
          <h1>Your learning paths</h1>
          <p>Bundle related YouTube videos into a course. Track full progress, build a single combined summary, and share the path.</p>
        </div>
        <button className="vf-primary-btn" onClick={() => setCreating(true)}>
          <Plus size={16} /> New course
        </button>
      </div>

      {creating && (
        <div className="vf-modal-backdrop" onClick={() => setCreating(false)}>
          <div className="vf-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>New course</h2>
              <button className="vf-icon-btn" onClick={() => setCreating(false)}>×</button>
            </header>
            <input
              className="vf-tag-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title (e.g. Intro to Python)"
              autoFocus
            />
            <textarea
              className="vf-export-textarea"
              style={{ minHeight: 80 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional: what is this course about?"
            />
            <div className="vf-modal-actions">
              <button className="vf-primary-btn" onClick={submit} disabled={!title.trim()}>Create</button>
              <button className="vf-ghost-btn" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {(courses ?? []).length === 0 && !creating && (
        <div className="vf-empty-card">
          <BookOpen size={28} />
          <h2>No courses yet</h2>
          <p>Create your first course, then add videos from inside Video Flow.</p>
          <button className="vf-primary-btn" onClick={() => setCreating(true)}>
            <Plus size={16} /> Create course
          </button>
        </div>
      )}

      <div className="vf-course-grid">
        {(courses ?? []).map((c) => (
          <Link key={c._id} href={`/learnhub/courses/${c._id}`} className="vf-course-card">
            <div className="vf-course-card-cover">
              {c.coverImageUrl ? <img src={c.coverImageUrl} alt="" /> : <BookOpen size={34} />}
            </div>
            <div className="vf-course-card-body">
              <h3>{c.title}</h3>
              {c.description && <p>{c.description}</p>}
              <div className="vf-course-card-meta">
                <span>{c.itemCount} video{c.itemCount === 1 ? "" : "s"}</span>
                <span>{c.status}</span>
                <span>{c.visibility}</span>
              </div>
              <span className="vf-course-card-cta"><ArrowRight size={14} /> Open</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
