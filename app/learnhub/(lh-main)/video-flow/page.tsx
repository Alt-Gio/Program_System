"use client";
import { Suspense } from "react";

import { useSearchParams } from "next/navigation";
import { VideoFlowWorkspace } from "@/components/learnhub/video-flow/VideoFlowWorkspace";

function VideoFlowPageInner() {
  const sp = useSearchParams();
  return (
    <VideoFlowWorkspace
      initialVideoId={sp.get("videoId")}
      initialPostId={sp.get("postId")}
      initialSessionId={sp.get("sessionId")}
      initialTitle={sp.get("title")}
      initialThumbnail={sp.get("thumbnail")}
      initialChannelName={sp.get("channel")}
    />
  );
}

export default function VideoFlowPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <VideoFlowPageInner />
    </Suspense>
  )
}
