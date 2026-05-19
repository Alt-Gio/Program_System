"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Horizontal rail surfacing the signed-in learner's owned video courses
 * on /learnhub/feed. Visible only when the user has at least one course;
 * empty state offers a CTA to the course-creation flow.
 */
export function YourCoursesRail({ userId }: { userId: Id<"learnhub_users"> | null }) {
  const courses = useQuery(
    api.learnhub_video_courses.listMyCourses,
    userId ? { ownerId: userId } : "skip",
  );

  if (!userId || courses === undefined) return null;
  if (courses.length === 0) return null; // Hide entirely for new users to avoid feed clutter.

  const top = courses.slice(0, 4);

  return (
    <div
      style={{
        margin: "12px 0",
        padding: 12,
        borderRadius: 12,
        background: "rgba(91,108,255,0.04)",
        border: "1px solid rgba(91,108,255,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: "#7c8bff",
            fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)",
          }}
        >
          Your courses
        </span>
        <Link
          href="/learnhub/learning-path"
          style={{ fontSize: 11, color: "#9ba3cc", textDecoration: "none" }}
        >
          See all →
        </Link>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {top.map((c) => (
          <Link
            key={c._id}
            href={`/learnhub/courses/${c._id}`}
            style={{
              flex: "0 0 180px",
              padding: 10,
              borderRadius: 10,
              background: "rgba(13,15,26,0.6)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#e8eaff",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
              {c.title}
            </span>
            <span style={{ fontSize: 10.5, color: "#9ba3cc" }}>
              {c.visibility === "public"
                ? "Public"
                : c.visibility === "learnhub"
                  ? "Shared"
                  : "Private"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
