import { redirect } from "next/navigation";
export default function OldFeedRedirect() { redirect("/learnhub/feed"); }
// dead code below — real page at app/learnhub/(lh-main)/feed/page.tsx
import type { FC } from "react";

// ── MOCK DATA — swap for real Convex useQuery when backend is ready ──
const MOCK_AUTHOR = {
  id: "mock-mentor-1",
  name: "Ma. Lourdes Santos",
  avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Lourdes+Santos",
  role: "mentor" as const,
};

const MOCK_STUDENT = {
  id: "mock-student-1",
  name: "Carlo Reyes",
  avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Carlo+Reyes",
  role: "student" as const,
};

const MOCK_ORG = {
  id: "mock-org-1",
  name: "TechCorp Philippines",
  avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=TechCorp",
  role: "org_partner" as const,
};

const INITIAL_POSTS: MockPost[] = [
  {
    id: "post-1",
    type: "text",
    author: MOCK_AUTHOR,
    content:
      "Welcome to ILCDB LearnHub! 🎉 This platform is your space to learn, connect, and grow within the DICT Region V community. Share your learning journey, earn certificates, and explore work opportunities. Let's build the future of digital literacy together. #ILCDB #DICT #Tech4All",
    metadata: {},
    likeCount: 24,
    commentCount: 5,
    isPinned: true,
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
  },
  {
    id: "post-2",
    type: "youtube",
    author: MOCK_AUTHOR,
    content:
      "Essential cybersecurity skills for every digital citizen. Watch this before starting the SPARK module! 🔐",
    metadata: {
      videoId: "aEmXT0bKbgE",
      title: "Cybersecurity Full Course for Beginners",
      thumbnail: "https://img.youtube.com/vi/aEmXT0bKbgE/mqdefault.jpg",
      channelName: "freeCodeCamp.org",
      duration: "11:45:00",
    },
    likeCount: 18,
    commentCount: 3,
    isPinned: false,
    createdAt: Date.now() - 5 * 60 * 60 * 1000,
  },
  {
    id: "post-3",
    type: "meet",
    author: MOCK_AUTHOR,
    content:
      "📅 Live Q&A session for SPARK Module 3 participants. Bring your questions about cloud computing and Google Workspace basics. Attendance required for certification.",
    metadata: {
      meetLink: "https://meet.google.com/abc-defg-hij",
      scheduledAt: Date.now() + 2 * 60 * 60 * 1000,
      durationMinutes: 90,
      isLive: false,
      viewerCount: 0,
    },
    likeCount: 12,
    commentCount: 7,
    isPinned: false,
    createdAt: Date.now() - 8 * 60 * 60 * 1000,
  },
  {
    id: "post-4",
    type: "opportunity",
    author: MOCK_ORG,
    content:
      "We are looking for ILCDB graduates to join our remote support team. This is a paid opportunity for certified Tech4ED completers.",
    metadata: {
      title: "Remote IT Support Specialist",
      workType: "remote",
      payType: "paid",
      payAmount: "₱18,000/mo",
      slots: 3,
      deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
      duration: "6 months",
      requiredCerts: ["Tech4ED", "SPARK"],
    },
    likeCount: 31,
    commentCount: 14,
    isPinned: false,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: "post-5",
    type: "drive",
    author: MOCK_AUTHOR,
    content:
      "Study guide for the DWIA Module 2 assessment. Download and review before the quiz on Friday. #DWIA",
    metadata: {
      driveFileId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
      fileName: "DWIA Module 2 Study Guide.pdf",
      mimeType: "application/pdf",
      previewUrl:
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview",
    },
    likeCount: 9,
    commentCount: 2,
    isPinned: false,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: "post-6",
    type: "form",
    author: MOCK_AUTHOR,
    content:
      "Please complete this post-training evaluation for SPARK Module 1. Takes about 5 minutes. Your feedback shapes future sessions! 📋",
    metadata: {
      formUrl: "https://forms.gle/example",
      formTitle: "SPARK Module 1 — Post-Training Evaluation",
      responseCount: 47,
      closingAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
    },
    likeCount: 6,
    commentCount: 1,
    isPinned: false,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "post-7",
    type: "certificate",
    author: MOCK_STUDENT,
    content: "Just earned my SPARK Digital Literacy certificate! 🎓 Grateful to all the mentors at DICT Region V. Time to level up! #ILCDB #SPARK #Certified",
    metadata: {
      certTitle: "SPARK Digital Literacy Program",
      programType: "SPARK",
      issuedByName: "Ma. Lourdes Santos",
      verificationId: "LH-2025-SPARK-0042",
    },
    likeCount: 52,
    commentCount: 11,
    isPinned: false,
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
];

function _FeedPage_unused() {
  const [posts, setPosts] = useState<MockPost[]>(INITIAL_POSTS);

  const handleNewPost = (post: MockPost) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likeCount: p.likeCount + 1 } : p
      )
    );
  };

  return (
    <div
      className="max-w-2xl mx-auto px-4 py-6"
      style={{ fontFamily: "var(--font-dm-sans)" }}
    >
      {/* Page heading */}
      <div className="mb-6">
        <h1
          className="text-xl font-bold"
          style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}
        >
          Feed
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>
          What&apos;s happening in your cohort
        </p>
      </div>

      {/* Post composer */}
      <PostComposer onPost={handleNewPost} />

      {/* Posts */}
      <div className="flex flex-col gap-4 mt-4">
        {posts.map((post) => (
          <FeedPost key={post.id} post={post} onLike={handleLike} />
        ))}
      </div>
    </div>
  );
}
