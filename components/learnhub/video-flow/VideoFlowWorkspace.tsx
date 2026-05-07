"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Copy, Download, Eye, Keyboard, Lock, MapPin, Users, Video } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { VideoFlowStarter } from "./Starter";
import { VideoFlowPlayer, type PlayerControls } from "./Player";
import { ResumeBanner } from "./ResumeBanner";
import { LearningTimeline } from "./Timeline";
import { StudyPanel } from "./StudyPanel";
import { ShortcutCheatsheet } from "./ShortcutCheatsheet";
import { ExportModal } from "./ExportModal";
import { AddToCoursePicker } from "./courses/AddToCoursePicker";
import { DiscoveryHint } from "./DiscoveryHint";
import { Toaster, toast } from "./toast";
import { useVideoFlowShortcuts } from "./useShortcuts";
import { extractYouTubeId, fmtTime, userColor, userInitials } from "./utils";
import type { TimelineEvent, VideoNote, VideoSession } from "./types";

type Props = {
  initialVideoId?: string | null;
  initialPostId?: string | null;
  initialSessionId?: string | null;
  initialTitle?: string | null;
  initialThumbnail?: string | null;
  initialChannelName?: string | null;
};

export function VideoFlowWorkspace({
  initialVideoId,
  initialPostId,
  initialSessionId,
  initialTitle,
  initialThumbnail,
  initialChannelName,
}: Props) {
  const { userId, session, loading } = useLearnhubSession();

  const [videoInput, setVideoInput] = useState(initialVideoId ?? "");
  const [videoId, setVideoId] = useState(initialVideoId ?? "");
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  const [savingLabel, setSavingLabel] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const [theater, setTheater] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAddToCourse, setShowAddToCourse] = useState(false);
  const [showSharedViewers, setShowSharedViewers] = useState(true);
  const currentSecRef = useRef(0);
  const [transcript, setTranscript] = useState("");
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  const lastSavedRef = useRef(0);
  const seenNonZeroRef = useRef(false);
  const controlsRef = useRef<PlayerControls | null>(null);
  const wasPlayingRef = useRef(false);
  const quickBookmarkRef = useRef<() => void>(() => {});
  const focusComposerRef = useRef<() => void>(() => {});

  const getOrCreateSession = useMutation(api.learnhub_video_flow.getOrCreateSession);
  const updateProgress = useMutation(api.learnhub_video_flow.updateProgress);
  const markCompleted = useMutation(api.learnhub_video_flow.markCompleted);
  const setVisibility = useMutation(api.learnhub_video_flow.setVisibility);
  const logExport = useMutation(api.learnhub_video_flow.logExportEvent);
  const pingViewer = useMutation(api.learnhub_video_collab.pingViewer);

  const recentSessions = useQuery(
    api.learnhub_video_flow.listMySessions,
    userId ? { userId, limit: 8 } : "skip"
  ) as VideoSession[] | undefined;

  const bundle = useQuery(
    api.learnhub_video_flow.getSessionBundle,
    userId && sessionId
      ? { sessionId: sessionId as Id<"learnhub_video_sessions">, userId }
      : "skip"
  ) as { session: VideoSession; notes: VideoNote[]; timeline: TimelineEvent[] } | null | undefined;

  const sharedBundle = useQuery(
    api.learnhub_video_flow.getSharedTimeline,
    sessionId && (!userId || bundle === null)
      ? userId
        ? { sessionId: sessionId as Id<"learnhub_video_sessions">, viewerId: userId }
        : { sessionId: sessionId as Id<"learnhub_video_sessions"> }
      : "skip"
  ) as { session: VideoSession; owner: { name: string; avatarUrl: string } | null; notes: VideoNote[]; timeline: TimelineEvent[] } | null | undefined;

  const certsByEmail = useQuery(
    api.learnhub_certificates.getCertsByEmail,
    session?.email ? { email: session.email } : "skip"
  ) as { status: string }[] | undefined;

  const activeBundle = bundle ?? sharedBundle ?? null;
  const activeSession = activeBundle?.session ?? null;
  const notes = activeBundle?.notes ?? [];
  const timeline = activeBundle?.timeline ?? [];
  const isOwner = Boolean(userId && activeSession?.userId === userId);
  const isShared = Boolean(activeSession && activeSession.visibility !== "private");

  const sharedViewers = useQuery(
    api.learnhub_video_collab.listSharedViewersForVideo,
    activeSession?.videoId && isShared
      ? userId
        ? { videoId: activeSession.videoId, viewerId: userId }
        : { videoId: activeSession.videoId }
      : "skip"
  ) as { userId: string; sessionId: string; currentSec: number; progressPct: number; durationSec?: number; isSelf: boolean; name: string; avatarUrl?: string; lastPingAt: number }[] | undefined;

  useEffect(() => {
    if (!sessionId || !userId || !isShared) return;
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void pingViewer({
        sessionId: sessionId as Id<"learnhub_video_sessions">,
        userId,
        currentSec: currentSecRef.current,
      });
    };
    ping();
    const t = window.setInterval(ping, 5000);
    const onVisible = () => { if (!document.hidden) ping(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, userId, isShared, pingViewer]);

  const startSession = useCallback(async (nextInput?: string, postId?: string) => {
    if (!userId) return;
    const parsed = extractYouTubeId(nextInput ?? videoInput);
    if (!parsed) {
      setError("Paste a valid YouTube URL or video ID.");
      return;
    }
    setError(null);
    const args: Parameters<typeof getOrCreateSession>[0] = {
      userId,
      videoId: parsed,
      thumbnail: initialThumbnail ?? `https://img.youtube.com/vi/${parsed}/hqdefault.jpg`,
      title: initialTitle ?? "YouTube Learning Session",
      ...(postId ? { postId: postId as Id<"learnhub_posts"> } : {}),
      ...(((nextInput ?? "").startsWith("http") || videoInput.startsWith("http"))
        ? { sourceUrl: (nextInput ?? "").startsWith("http") ? (nextInput ?? "") : videoInput }
        : {}),
      ...(initialChannelName ? { channelName: initialChannelName } : {}),
    };
    const nextSessionId = await getOrCreateSession(args);
    setVideoId(parsed);
    setSessionId(nextSessionId as string);
    setVideoInput(parsed);
    setResumeDismissed(false);
  }, [userId, videoInput, initialThumbnail, initialTitle, initialChannelName, getOrCreateSession]);

  useEffect(() => {
    if (!userId || !initialVideoId || sessionId) return;
    void startSession(initialVideoId, initialPostId ?? undefined);
  }, [userId, initialVideoId, initialPostId, sessionId, startSession]);

  useEffect(() => {
    if (!activeSession) return;
    setVideoId(activeSession.videoId);
    setCurrentSec(activeSession.lastPositionSec ?? 0);
    setDurationSec(activeSession.durationSec ?? 0);
    setResumeDismissed(false);
    seenNonZeroRef.current = false;
    lastSavedRef.current = Date.now();
  }, [activeSession?._id]);

  const progressPct = durationSec > 0
    ? Math.min(100, Math.round((currentSec / durationSec) * 100))
    : activeSession?.progressPct ?? 0;

  const saveProgress = useCallback(async (nextSec: number, nextDuration: number) => {
    const lastKnown = activeSession?.lastPositionSec ?? 0;
    if (nextSec > 1) seenNonZeroRef.current = true;
    if (nextSec === 0 && lastKnown > 5 && !seenNonZeroRef.current) {
      // Player hasn't completed seek-to-resume yet; ignore the zero report.
      return;
    }
    currentSecRef.current = nextSec;
    setCurrentSec(nextSec);
    if (nextDuration && nextDuration !== durationSec) setDurationSec(nextDuration);
    if (!sessionId || !userId || !isOwner) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 6000 && Math.abs(nextSec - lastKnown) < 20) return;
    lastSavedRef.current = now;
    setSavingLabel("Saving…");
    await updateProgress({
      sessionId: sessionId as Id<"learnhub_video_sessions">,
      userId,
      lastPositionSec: nextSec,
      ...(nextDuration > 0 ? { durationSec: nextDuration } : {}),
    });
    setSavingLabel("Saved");
    window.setTimeout(() => setSavingLabel("Ready"), 1200);
  }, [sessionId, userId, isOwner, durationSec, activeSession?.lastPositionSec, updateProgress]);

  const copyShareLink = useCallback(async () => {
    if (!sessionId) return;
    const url = `${window.location.origin}/learnhub/video-flow?sessionId=${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setSavingLabel("Link copied");
      toast("Share link copied", { kind: "success" });
    } catch {
      toast("Couldn't copy link — clipboard blocked", { kind: "error" });
    }
    window.setTimeout(() => setSavingLabel("Ready"), 1400);
  }, [sessionId]);

  const handleTypingChange = useCallback((typing: boolean) => {
    const c = controlsRef.current;
    if (!c) return;
    if (typing) {
      if (c.isPlaying()) {
        wasPlayingRef.current = true;
        c.pause();
      }
    } else {
      if (wasPlayingRef.current) {
        wasPlayingRef.current = false;
        c.play();
      }
    }
  }, []);

  const onPlayerReady = useCallback((controls: PlayerControls) => {
    controlsRef.current = controls;
  }, []);

  useVideoFlowShortcuts({
    controlsRef,
    enabled: Boolean(activeSession),
    toggleTheater: () => setTheater((v) => !v),
    toggleHelp: () => setShowShortcuts((v) => !v),
    focusNoteComposer: () => focusComposerRef.current?.(),
    quickBookmark: () => quickBookmarkRef.current?.(),
    setLoopA: () => controlsRef.current?.setLoopAAtCurrent(),
    setLoopB: () => controlsRef.current?.setLoopBAtCurrent(),
  });

  if (loading) {
    return <div className="vf-shell"><div className="lh-skeleton" style={{ height: 420 }} /></div>;
  }

  if (!session) {
    return (
      <div className="vf-shell">
        <div className="vf-empty-card">
          <Lock size={34} />
          <h1>Sign in to use Video Flow</h1>
          <p>Your notes, progress, timelines, and certificates connect to your Google-powered LearnHub account.</p>
          <Link href="/login/student" className="vf-primary-btn">Continue with Google</Link>
        </div>
      </div>
    );
  }

  if (!videoId && !activeSession) {
    return (
      <div className="vf-shell">
        <VideoFlowStarter
          videoInput={videoInput}
          setVideoInput={setVideoInput}
          startSession={() => startSession()}
          recentSessions={recentSessions ?? []}
          openSession={(s) => {
            setSessionId(s._id);
            setVideoId(s.videoId);
          }}
          error={error}
          certificateCount={certsByEmail?.length ?? 0}
          unclaimedCertificateCount={certsByEmail?.filter((cert) => cert.status !== "claimed").length ?? 0}
        />
      </div>
    );
  }

  const showResume = isOwner && !resumeDismissed && (activeSession?.lastPositionSec ?? 0) > 5 && (activeSession?.status !== "completed");

  return (
    <div className={`vf-shell vf-shell-active ${theater ? "vf-shell-theater" : ""}`}>
      <div className="vf-topbar">
        <div>
          <p className="vf-eyebrow">
            <Video size={14} /> Video Flow
            {isWatching && (
              <span className="vf-watch-indicator" aria-label="Currently watching">
                <span className="vf-watch-dot" /> Watching now
              </span>
            )}
          </p>
          <h1>{activeSession?.title ?? "YouTube Learning Session"}</h1>
          <p>{activeSession?.channelName ?? "Focused YouTube learning workspace"}</p>
        </div>
        <div className="vf-top-actions">
          {isShared && sharedViewers && sharedViewers.filter((v) => !v.isSelf).length > 0 && (
            <button
              type="button"
              className={`vf-viewer-pill ${showSharedViewers ? "active" : ""}`}
              onClick={() => setShowSharedViewers(!showSharedViewers)}
              title={`${sharedViewers.filter((v) => !v.isSelf).length} other viewer${sharedViewers.filter((v) => !v.isSelf).length === 1 ? "" : "s"} on this video — click to ${showSharedViewers ? "hide" : "show"} their positions`}
            >
              {showSharedViewers ? <MapPin size={13} /> : <Users size={13} />}
              <span className="vf-viewer-stack">
                {sharedViewers.filter((v) => !v.isSelf).slice(0, 4).map((v) => {
                  const c = userColor(v.userId);
                  return v.avatarUrl
                    ? <img key={v.userId} src={v.avatarUrl} alt={v.name} title={v.name} style={{ borderColor: c.hex }} />
                    : <span key={v.userId} title={v.name} style={{ background: c.hex }}>{userInitials(v.name)}</span>;
                })}
              </span>
              <strong>{sharedViewers.filter((v) => !v.isSelf).length}</strong>
            </button>
          )}
          <span className="vf-save-state">{savingLabel}</span>
          <button className="vf-ghost-btn" onClick={() => setShowShortcuts(true)} title="Shortcuts (?)">
            <Keyboard size={15} /> Shortcuts
          </button>
          {isOwner && (
            <button
              className={`vf-share-toggle ${activeSession?.visibility === "private" ? "private" : "shared"}`}
              onClick={async () => {
                if (!sessionId || !userId) return;
                const willShare = activeSession?.visibility === "private";
                try {
                  await setVisibility({
                    sessionId: sessionId as Id<"learnhub_video_sessions">,
                    userId,
                    visibility: willShare ? "learnhub" : "private",
                  });
                  toast(
                    willShare
                      ? "Sharing your watch — other shared viewers can see your position"
                      : "Switched to private — your position is hidden",
                    { kind: willShare ? "success" : "info" }
                  );
                } catch {
                  toast("Couldn't change sharing state", { kind: "error" });
                }
              }}
              disabled={!sessionId}
              title={activeSession?.visibility === "private"
                ? "You're watching privately. Click to share your timeline so other LearnHub members can see where you are on this video."
                : "You're sharing your timeline. Other shared viewers can see your position. Click to switch back to private."}
            >
              {activeSession?.visibility === "private" ? <Lock size={14} /> : <Eye size={14} />}
              {activeSession?.visibility === "private" ? "Private watch" : "Sharing watch"}
            </button>
          )}
          <button className="vf-ghost-btn" onClick={copyShareLink} disabled={!sessionId}>
            <Copy size={15} /> Copy link
          </button>
          <button
            className="vf-ghost-btn"
            onClick={() => setShowAddToCourse(true)}
            disabled={!activeSession || !isOwner}
            title="Add to course"
          >
            <BookOpen size={15} /> Add to course
          </button>
          <button className="vf-ghost-btn" onClick={() => setShowExport(true)} disabled={!activeSession}>
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      <div className="vf-progress-card">
        <div className="vf-progress-meta">
          <span>{fmtTime(currentSec)} / {fmtTime(durationSec || activeSession?.durationSec)}</span>
          <span>{progressPct}% complete</span>
        </div>
        <div className="vf-progress-track"><span style={{ width: `${progressPct}%` }} /></div>
      </div>

      {isShared && sharedViewers && sharedViewers.filter((v) => !v.isSelf).length > 0 && (
        <DiscoveryHint
          storageKey="shared-pins"
          title="Live position pins are on"
          body="Each colored avatar on the progress bar shows where another shared viewer is right now. Click a pin to jump to their spot. Everyone learns at their own pace — this is just visibility, not sync."
        />
      )}
      <DiscoveryHint
        storageKey="user-color"
        title="Your personal color"
        body="Your notes carry a colored accent unique to your account. When mentors and peers leave comments, their avatars use their own color so you can tell who's who at a glance."
      />

      {showResume && (
        <ResumeBanner
          lastPositionSec={activeSession?.lastPositionSec ?? 0}
          durationSec={activeSession?.durationSec}
          onResume={() => {
            setSeekToSec(activeSession?.lastPositionSec ?? 0);
            controlsRef.current?.play();
            setResumeDismissed(true);
          }}
          onStartOver={() => {
            setSeekToSec(0);
            controlsRef.current?.play();
            setResumeDismissed(true);
          }}
          onDismiss={() => setResumeDismissed(true)}
        />
      )}

      <div className="vf-grid">
        <main className="vf-player-column">
          <VideoFlowPlayer
            videoId={videoId || activeSession?.videoId || ""}
            startSec={activeSession?.lastPositionSec ?? 0}
            seekToSec={seekToSec}
            notes={notes}
            sharedViewers={sharedViewers}
            showSharedViewers={showSharedViewers && isShared}
            onProgress={saveProgress}
            onReady={onPlayerReady}
            onPlayingChange={setIsWatching}
            theater={theater}
            setTheater={setTheater}
          />
          <LearningTimeline timeline={timeline} notes={notes} onSeek={(sec) => setSeekToSec(sec)} />
        </main>

        <aside className="vf-study-panel">
          <StudyPanel
            sessionId={sessionId}
            userId={userId}
            isOwner={isOwner}
            notes={notes}
            session={activeSession}
            currentSec={currentSec}
            ownerId={activeSession?.userId}
            transcript={transcript}
            setTranscript={setTranscript}
            onSeek={(sec) => setSeekToSec(sec)}
            onCompleted={async () => {
              if (!sessionId || !userId) return;
              try {
                await markCompleted({ sessionId: sessionId as Id<"learnhub_video_sessions">, userId });
                toast("Session marked complete · nice work", { kind: "celebrate" });
              } catch {
                toast("Couldn't mark complete", { kind: "error" });
              }
            }}
            onTypingChange={handleTypingChange}
            registerQuickBookmark={(fn) => { quickBookmarkRef.current = fn; }}
            registerFocusComposer={(fn) => { focusComposerRef.current = fn; }}
          />
        </aside>
      </div>

      <ShortcutCheatsheet open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <AddToCoursePicker
        open={showAddToCourse}
        onClose={() => setShowAddToCourse(false)}
        userId={userId}
        videoId={videoId || activeSession?.videoId || ""}
        videoTitle={activeSession?.title}
        videoChannel={activeSession?.channelName}
        videoThumbnail={activeSession?.thumbnail}
      />
      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        session={activeSession}
        notes={notes}
        transcript={transcript}
        onExported={() => {
          if (!sessionId || !userId) return;
          void logExport({
            sessionId: sessionId as Id<"learnhub_video_sessions">,
            userId,
          });
          toast("Export pack ready", { kind: "success" });
        }}
      />
      <Toaster />
    </div>
  );
}
