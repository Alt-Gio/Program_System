"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Web Share Target landing page. The PWA manifest declares this route as
// the share_target action, so when a user picks "ILCDB LearnHub" from
// their OS share sheet, the OS calls /learnhub/share?title=â€¦&text=â€¦&url=â€¦
//
// We just forward the shared payload into the feed composer via the
// existing #compose hash anchor (used elsewhere too â€” see LeftRail's
// "Create post" CTA). sessionStorage is used as the handoff because
// query params would leak the shared text into the URL bar.
function ShareReceiverInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const title = sp.get("title") ?? "";
    const text = sp.get("text") ?? "";
    const url = sp.get("url") ?? "";
    const composed = [title, text, url].filter(Boolean).join("\n\n").trim();
    if (composed) {
      try {
        sessionStorage.setItem("learnhub:shared-draft", composed);
      } catch {
        // sessionStorage can throw in private mode â€” falling back to
        // dropping the draft is fine; the user lands on the feed
        // composer and types it themselves.
      }
    }
    router.replace("/learnhub/feed#compose");
  }, [sp, router]);

  return (
    <div
      style={{
        background: "var(--lh-bg)",
        color: "var(--lh-text-2)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        padding: 24,
      }}
    >
      Opening LearnHub composerâ€¦
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareReceiverInner />
    </Suspense>
  );
}
