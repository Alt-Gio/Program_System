"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FeedPost } from "@/components/learnhub/feed/FeedPost";
import { PostComposer } from "@/components/learnhub/feed/PostComposer";
import type { MockPost } from "@/components/learnhub/feed/FeedPost";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const MOCK_MENTOR = { id: "m1", name: "Ma. Lourdes Santos", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Lourdes", role: "mentor" as const };
const MOCK_STUDENT = { id: "s1", name: "Carlo Reyes", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Carlo", role: "student" as const };
const MOCK_ORG = { id: "o1", name: "TechCorp PH", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=TechCorp", role: "org_partner" as const };

const SEED: MockPost[] = [
  { id: "p1", type: "text", author: MOCK_MENTOR, content: "Welcome to ILCDB LearnHub! 🎉 This is your space to learn, connect, and grow within DICT Region V. Share your journey, earn certificates, and explore opportunities. #ILCDB #DICT #Tech4All", metadata: {}, likeCount: 24, commentCount: 5, isPinned: true, createdAt: Date.now() - 2 * 3600000 },
  { id: "p2", type: "youtube", author: MOCK_MENTOR, content: "Essential cybersecurity skills for every digital citizen. Watch before starting the SPARK module! 🔐", metadata: { videoId: "aEmXT0bKbgE", title: "Cybersecurity Full Course for Beginners", thumbnail: "https://img.youtube.com/vi/aEmXT0bKbgE/mqdefault.jpg", channelName: "freeCodeCamp.org", duration: "11:45:00" }, likeCount: 18, commentCount: 3, isPinned: false, createdAt: Date.now() - 5 * 3600000 },
  { id: "p3", type: "meet", author: MOCK_MENTOR, content: "📅 Live Q&A for SPARK Module 3. Bring your questions about cloud computing. Attendance required for certification.", metadata: { meetLink: "https://meet.google.com/abc-defg-hij", scheduledAt: Date.now() + 2 * 3600000, durationMinutes: 90, isLive: false, viewerCount: 0 }, likeCount: 12, commentCount: 7, isPinned: false, createdAt: Date.now() - 8 * 3600000 },
  { id: "p4", type: "opportunity", author: MOCK_ORG, content: "Looking for ILCDB graduates to join our remote support team. Paid opportunity for certified Tech4ED completers.", metadata: { title: "Remote IT Support Specialist", workType: "remote", payType: "paid", payAmount: "₱18,000/mo", slots: 3, deadline: Date.now() + 7 * 86400000, duration: "6 months", requiredCerts: ["Tech4ED", "SPARK"] }, likeCount: 31, commentCount: 14, isPinned: false, createdAt: Date.now() - 86400000 },
  { id: "p5", type: "drive", author: MOCK_MENTOR, content: "Study guide for DWIA Module 2 assessment. Review before Friday's quiz. #DWIA", metadata: { driveFileId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74", fileName: "DWIA Module 2 Study Guide.pdf", mimeType: "application/pdf", previewUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74/preview" }, likeCount: 9, commentCount: 2, isPinned: false, createdAt: Date.now() - 2 * 86400000 },
  { id: "p6", type: "form", author: MOCK_MENTOR, content: "Post-training evaluation for SPARK Module 1 — takes 5 minutes. Your feedback shapes future sessions! 📋", metadata: { formUrl: "https://forms.gle/example", formTitle: "SPARK Module 1 — Post-Training Evaluation", responseCount: 47, closingAt: Date.now() + 3 * 86400000 }, likeCount: 6, commentCount: 1, isPinned: false, createdAt: Date.now() - 3 * 86400000 },
  { id: "p7", type: "certificate", author: MOCK_STUDENT, content: "Just earned my SPARK Digital Literacy certificate! 🎓 Grateful to all DICT Region V mentors. #ILCDB #SPARK #Certified", metadata: { certTitle: "SPARK Digital Literacy Program", programType: "SPARK", issuedByName: "Ma. Lourdes Santos", verificationId: "LH-2025-SPARK-0042" }, likeCount: 52, commentCount: 11, isPinned: false, createdAt: Date.now() - 4 * 86400000 },
];

function mapConvexPost(p: ReturnType<typeof useQuery<typeof api.learnhub_posts.listFeedWithAuthors>> extends (infer T)[] | undefined ? T : never): MockPost {
  return {
    id: p._id,
    convexPostId: p._id,
    type: p.type as MockPost["type"],
    author: {
      id: p.authorId,
      name: p.author?.name ?? "Unknown",
      avatarUrl: p.author?.avatarUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=U`,
      role: (p.author?.role ?? "student") as MockPost["author"]["role"],
    },
    content: p.content,
    metadata: p.metadata ?? {},
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    isPinned: p.isPinned,
    createdAt: p.createdAt,
  };
}

export default function FeedPage() {
  const [localPosts, setLocalPosts] = useState<MockPost[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const livePosts = useQuery(api.learnhub_posts.listFeedWithAuthors, { limit: 30 });
  const { userId, session } = useLearnhubSession();
  const prevLiveCountRef = useRef(0);

  // Clear optimistic local posts once Convex confirms new posts
  useEffect(() => {
    if (livePosts && livePosts.length > prevLiveCountRef.current) {
      setLocalPosts([]);
      prevLiveCountRef.current = livePosts.length;
    }
  }, [livePosts]);

  const convexPosts: MockPost[] = livePosts ? livePosts.map(mapConvexPost) : [];
  const source: MockPost[] = convexPosts.length > 0 ? convexPosts : livePosts === undefined ? [] : SEED;
  const allPosts: MockPost[] = [...localPosts, ...source.filter((p) => !localPosts.some((l) => l.id === p.id))];

  const handleLike = (id: string) => {
    setLiked((s) => new Set(Array.from(s).concat(id)));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Feed</h1>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>What&apos;s happening in your cohort</p>
      </div>
      <PostComposer
        onPost={(post) => setLocalPosts((p) => [post, ...p])}
        userId={userId}
        userName={session?.name}
        userAvatar={session?.avatarUrl}
        userRole={session?.role === "admin" ? "mentor" : session?.role}
      />
      {livePosts === undefined && (
        <div className="flex flex-col gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "#131626" }} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4 mt-4">
        {allPosts.map((post) => (
          <FeedPost
            key={post.id}
            post={{ ...post, likeCount: post.likeCount + (liked.has(post.id) ? 1 : 0) }}
            userId={userId}
            onLike={handleLike}
          />
        ))}
      </div>
    </div>
  );
}
