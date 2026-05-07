"use client";

import { useParams } from "next/navigation";
import { CourseDetail } from "@/components/learnhub/video-flow/courses/CourseDetail";
import type { Id } from "@/convex/_generated/dataModel";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  return <CourseDetail courseId={params.courseId as Id<"learnhub_video_courses">} />;
}
