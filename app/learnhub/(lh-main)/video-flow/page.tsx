"use client";

import { useSearchParams } from "next/navigation";
import { VideoFlowWorkspace } from "@/components/learnhub/video-flow/VideoFlowWorkspace";

export default function VideoFlowPage() {
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
