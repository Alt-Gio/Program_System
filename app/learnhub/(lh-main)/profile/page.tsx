"use client";

/**
 * /learnhub/profile
 *
 * Shortcut route â€” redirects to the signed-in user's profile page
 * at /learnhub/profile/[userId]. Linked from the TopNav avatar.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { userId, loading } = useLearnhubSession();

  useEffect(() => {
    if (loading) return;
    if (userId) {
      router.replace(`/learnhub/profile/${userId}`);
    } else {
      router.replace("/login/student");
    }
  }, [userId, loading, router]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="animate-pulse text-3xl mb-3">ðŸ‘¤</div>
      <p className="text-sm" style={{ color: "var(--lh-text-2)" }}>Loading your profileâ€¦</p>
      <Link href="/learnhub/feed" className="text-xs mt-4 inline-block" style={{ color: "#5b6cff" }}>
        â† Back to Feed
      </Link>
    </div>
  );
}
