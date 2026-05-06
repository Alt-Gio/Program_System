"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { Award, Brain, CalendarClock, CheckCircle2, Copy, FileText, HelpCircle, ListChecks, Lock, PlayCircle, Share2, Sparkles, StickyNote, Timer, Video } from "lucide-react";

type NoteKind = "note" | "question" | "bookmark" | "takeaway";
type Visibility = "private" | "mentors" | "learnhub" | "public";

type VideoNote = {
  _id: string;
  timestampSec: number;
  content: string;
  kind: NoteKind;
  label?: string;
  isShared: boolean;
  createdAt: number;
};

type TimelineEvent = {
  _id: string;
  type: string;
  timestampSec?: number;
  message: string;
  createdAt: number;
};

type VideoSession = {
  _id: string;
  userId: string;
  videoId: string;
  sourceUrl?: string;
  title?: string;
  thumbnail?: string;
  channelName?: string;
  status: "not_started" | "in_progress" | "completed";
  lastPositionSec: number;
  durationSec?: number;
  progressPct: number;
  summary?: string;
  aiSummary?: AiSummary;
  takeaways?: string[];
  visibility: Visibility;
  updatedAt: number;
  completedAt?: number;
};

type AiSummary = {
  summary?: string;
  keyConcepts?: string[];
  actionItems?: string[];
  questions?: string[];
  quizItems?: { question: string; answer: string }[];
  beginnerExplanation?: string;
};

function extractYouTubeId(input: string) {
  const value = input.trim();
  if (!value) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return /^[a-zA-Z0-9_-]{6,}$/.test(value) ? value : null;
}

function fmtTime(sec?: number) {
  const safe = Math.max(0, Math.floor(sec ?? 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

function labelForKind(kind: NoteKind) {
  if (kind === "question") return "Question";
  if (kind === "bookmark") return "Bookmark";
  if (kind === "takeaway") return "Takeaway";
  return "Note";
}

function iconForKind(kind: NoteKind) {
  if (kind === "question") return <HelpCircle size={14} />;
  if (kind === "bookmark") return <Timer size={14} />;
  if (kind === "takeaway") return <ListChecks size={14} />;
  return <StickyNote size={14} />;
}

export function VideoFlowWorkspace({
  initialVideoId,
  initialPostId,
  initialSessionId,
  initialTitle,
  initialThumbnail,
  initialChannelName,
}: {
  initialVideoId?: string | null;
  initialPostId?: string | null;
  initialSessionId?: string | null;
  initialTitle?: string | null;
  initialThumbnail?: string | null;
  initialChannelName?: string | null;
}) {
  const { userId, session, loading } = useLearnhubSession();
  const [videoInput, setVideoInput] = useState(initialVideoId ?? "");
  const [videoId, setVideoId] = useState(initialVideoId ?? "");
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  const [savingLabel, setSavingLabel] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(0);

  const getOrCreateSession = useMutation(api.learnhub_video_flow.getOrCreateSession);
  const updateProgress = useMutation(api.learnhub_video_flow.updateProgress);
  const markCompleted = useMutation(api.learnhub_video_flow.markCompleted);
  const setVisibility = useMutation(api.learnhub_video_flow.setVisibility);

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

  useEffect(() => {
    if (!userId || !initialVideoId || sessionId) return;
    void startSession(initialVideoId, initialPostId ?? undefined);
  }, [userId, initialVideoId, initialPostId, sessionId]);

  useEffect(() => {
    if (!activeSession) return;
    setVideoId(activeSession.videoId);
    setCurrentSec(activeSession.lastPositionSec ?? 0);
    setDurationSec(activeSession.durationSec ?? 0);
  }, [activeSession?._id]);

  const progressPct = durationSec > 0
    ? Math.min(100, Math.round((currentSec / durationSec) * 100))
    : activeSession?.progressPct ?? 0;

  async function startSession(nextInput?: string, postId?: string) {
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
      ...((nextInput?.startsWith("http") || videoInput.startsWith("http")) ? { sourceUrl: nextInput?.startsWith("http") ? nextInput : videoInput } : {}),
      ...(initialChannelName ? { channelName: initialChannelName } : {}),
    };
    const nextSessionId = await getOrCreateSession(args);
    setVideoId(parsed);
    setSessionId(nextSessionId as string);
    setVideoInput(parsed);
  }

  async function saveProgress(nextSec: number, nextDuration: number) {
    setCurrentSec(nextSec);
    setDurationSec(nextDuration);
    if (!sessionId || !userId || !isOwner) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 6000 && Math.abs(nextSec - (activeSession?.lastPositionSec ?? 0)) < 20) return;
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
  }

  async function copyShareLink() {
    if (!sessionId) return;
    const url = `${window.location.origin}/learnhub/video-flow?sessionId=${sessionId}`;
    await navigator.clipboard.writeText(url);
    setSavingLabel("Link copied");
    window.setTimeout(() => setSavingLabel("Ready"), 1400);
  }

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

  return (
    <div className="vf-shell vf-shell-active">
      <div className="vf-topbar">
        <div>
          <p className="vf-eyebrow"><Video size={14} /> Video Flow</p>
          <h1>{activeSession?.title ?? "YouTube Learning Session"}</h1>
          <p>{activeSession?.channelName ?? "Focused YouTube learning workspace"}</p>
        </div>
        <div className="vf-top-actions">
          <span className="vf-save-state">{savingLabel}</span>
          {isOwner && (
            <button
              className="vf-ghost-btn"
              onClick={() => {
                if (!sessionId || !userId) return;
                setVisibility({
                  sessionId: sessionId as Id<"learnhub_video_sessions">,
                  userId,
                  visibility: activeSession?.visibility === "private" ? "learnhub" : "private",
                });
              }}
              disabled={!sessionId}
            >
              <Share2 size={15} /> {activeSession?.visibility === "private" ? "Share timeline" : "Make private"}
            </button>
          )}
          <button className="vf-ghost-btn" onClick={copyShareLink} disabled={!sessionId}>
            <Copy size={15} /> Copy link
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

      <div className="vf-grid">
        <main className="vf-player-column">
          <VideoFlowPlayer
            videoId={videoId || activeSession?.videoId || ""}
            startSec={activeSession?.lastPositionSec ?? 0}
            seekToSec={seekToSec}
            onProgress={saveProgress}
          />
          <LearningTimeline timeline={timeline} notes={notes} onSeek={(sec) => setSeekToSec(sec)} />
        </main>

        <aside className="vf-study-panel">
          <StudyPanel
            sessionId={sessionId as Id<"learnhub_video_sessions"> | null}
            userId={userId}
            isOwner={isOwner}
            notes={notes}
            session={activeSession}
            currentSec={currentSec}
            onSeek={(sec) => setSeekToSec(sec)}
            onCompleted={() => sessionId && userId && markCompleted({ sessionId: sessionId as Id<"learnhub_video_sessions">, userId })}
          />
        </aside>
      </div>
    </div>
  );
}

function VideoFlowStarter({
  videoInput,
  setVideoInput,
  startSession,
  recentSessions,
  openSession,
  error,
  certificateCount,
  unclaimedCertificateCount,
}: {
  videoInput: string;
  setVideoInput: (v: string) => void;
  startSession: () => void;
  recentSessions: VideoSession[];
  openSession: (s: VideoSession) => void;
  error: string | null;
  certificateCount: number;
  unclaimedCertificateCount: number;
}) {
  return (
    <div className="vf-start-layout">
      <section className="vf-hero-card">
        <p className="vf-eyebrow"><Sparkles size={14} /> Professional learning mode</p>
        <h1>Turn any YouTube video into a guided learning session.</h1>
        <p>Watch with focus, save timestamped notes, build a timeline, generate AI summaries, and share what you learned with mentors or classmates.</p>
        <div className="vf-url-row">
          <input value={videoInput} onChange={(e) => setVideoInput(e.target.value)} placeholder="Paste a YouTube URL or video ID…" onKeyDown={(e) => e.key === "Enter" && startSession()} />
          <button onClick={startSession}><PlayCircle size={17} /> Start Video Flow</button>
        </div>
        {error && <p className="vf-error">{error}</p>}
        <div className="vf-feature-grid">
          {["AI summary", "Timestamp notes", "Smart bookmarks", "Shareable timeline"].map((item) => <span key={item}>{item}</span>)}
        </div>
        {certificateCount > 0 && (
          <Link href="/learnhub/certificates" className="vf-cert-callout">
            <Award size={18} />
            <span>
              <strong>{certificateCount} certificate{certificateCount === 1 ? "" : "s"} connected to your Google email</strong>
              <small>{unclaimedCertificateCount > 0 ? `${unclaimedCertificateCount} ready to claim` : "All visible in your LearnHub profile"}</small>
            </span>
          </Link>
        )}
      </section>

      <section className="vf-side-card">
        <h2>Continue learning</h2>
        {recentSessions.length === 0 && <p className="vf-muted">Your recent Video Flow sessions will appear here.</p>}
        <div className="vf-session-list">
          {recentSessions.map((s) => (
            <button key={s._id} onClick={() => openSession(s)}>
              <img src={s.thumbnail ?? `https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg`} alt="" />
              <span><strong>{s.title ?? "YouTube session"}</strong><small>{s.progressPct}% · {s.status.replace("_", " ")}</small></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function VideoFlowPlayer({ videoId, startSec, seekToSec, onProgress }: { videoId: string; startSec: number; seekToSec: number | null; onProgress: (sec: number, duration: number) => void }) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  useEffect(() => {
    let disposed = false;
    const load = () => new Promise<void>((resolve) => {
      if ((window as any).YT?.Player) { resolve(); return; }
      const existing = document.querySelector("script[src='https://www.youtube.com/iframe_api']");
      (window as any).onYouTubeIframeAPIReady = () => resolve();
      if (!existing) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    });

    load().then(() => {
      if (disposed || !holderRef.current) return;
      playerRef.current?.destroy?.();
      playerRef.current = new (window as any).YT.Player(holderRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1, start: Math.floor(startSec || 0) },
        events: {
          onReady: (event: any) => {
            if (startSec > 0) event.target.seekTo(startSec, true);
          },
        },
      });
    });

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const sec = Math.floor(player.getCurrentTime() || 0);
      const duration = Math.floor(player.getDuration?.() || 0);
      onProgressRef.current(sec, duration);
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (seekToSec === null) return;
    playerRef.current?.seekTo?.(seekToSec, true);
  }, [seekToSec]);

  return <div className="vf-player-wrap"><div ref={holderRef} /></div>;
}

function StudyPanel({ sessionId, userId, isOwner, notes, session, currentSec, onSeek, onCompleted }: { sessionId: string | null; userId: Id<"learnhub_users"> | null; isOwner: boolean; notes: VideoNote[]; session: VideoSession | null; currentSec: number; onSeek: (sec: number) => void; onCompleted: () => void }) {
  const [tab, setTab] = useState<"notes" | "summary" | "checklist">("notes");

  return (
    <div className="vf-panel-card">
      <div className="vf-tabs">
        <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}><StickyNote size={14} /> Notes</button>
        <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}><Brain size={14} /> AI</button>
        <button className={tab === "checklist" ? "active" : ""} onClick={() => setTab("checklist")}><CheckCircle2 size={14} /> Review</button>
      </div>
      {tab === "notes" && <NotesPanel sessionId={sessionId} userId={userId} isOwner={isOwner} notes={notes} currentSec={currentSec} onSeek={onSeek} />}
      {tab === "summary" && <AISummaryPanel sessionId={sessionId} userId={userId} isOwner={isOwner} notes={notes} session={session} />}
      {tab === "checklist" && <ChecklistPanel session={session} noteCount={notes.length} onCompleted={onCompleted} isOwner={isOwner} />}
    </div>
  );
}

function NotesPanel({ sessionId, userId, isOwner, notes, currentSec, onSeek }: { sessionId: string | null; userId: Id<"learnhub_users"> | null; isOwner: boolean; notes: VideoNote[]; currentSec: number; onSeek: (sec: number) => void }) {
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<NoteKind>("note");
  const [isShared, setIsShared] = useState(false);
  const createNote = useMutation(api.learnhub_video_flow.createNote);

  async function submit() {
    if (!sessionId || !userId || !content.trim()) return;
    await createNote({
      sessionId: sessionId as Id<"learnhub_video_sessions">,
      userId,
      timestampSec: currentSec,
      content: content.trim(),
      kind,
      isShared,
    });
    setContent("");
  }

  return (
    <div className="vf-tab-body">
      {isOwner && (
        <div className="vf-note-composer">
          <div className="vf-note-row">
            <select value={kind} onChange={(e) => setKind(e.target.value as NoteKind)}>
              <option value="note">Note</option>
              <option value="question">Question</option>
              <option value="bookmark">Bookmark</option>
              <option value="takeaway">Takeaway</option>
            </select>
            <span>{fmtTime(currentSec)}</span>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Capture what matters at this moment…" />
          <label><input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} /> Include when timeline is shared</label>
          <button onClick={submit} disabled={!content.trim()}>Add timestamp</button>
        </div>
      )}
      <div className="vf-note-list">
        {notes.length === 0 && <p className="vf-muted">No timestamped notes yet.</p>}
        {notes.map((note) => (
          <article key={note._id} className={`vf-note vf-note-${note.kind}`}>
            <button onClick={() => onSeek(note.timestampSec)} className="vf-time-chip">{fmtTime(note.timestampSec)}</button>
            <div>
              <p className="vf-note-kind">{iconForKind(note.kind)} {labelForKind(note.kind)} {note.isShared && <span>Shared</span>}</p>
              <p>{note.content}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AISummaryPanel({ sessionId, userId, isOwner, notes, session }: { sessionId: string | null; userId: Id<"learnhub_users"> | null; isOwner: boolean; notes: VideoNote[]; session: VideoSession | null }) {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateSummary = useMutation(api.learnhub_video_flow.updateSummary);
  const ai = session?.aiSummary;

  async function generate() {
    if (!sessionId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/learnhub/video-flow/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session?.title ?? "YouTube Learning Session",
          videoId: session?.videoId,
          transcript,
          notes: notes.map((n) => ({ timestamp: fmtTime(n.timestampSec), kind: n.kind, content: n.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI summary unavailable");
      await updateSummary({
        sessionId: sessionId as Id<"learnhub_video_sessions">,
        userId,
        aiSummary: data.summary,
        summary: data.summary?.summary,
        takeaways: data.summary?.keyConcepts ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI summary unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vf-tab-body">
      {isOwner && (
        <div className="vf-ai-box">
          <p>Generate from your notes and an optional pasted transcript. This avoids unreliable YouTube transcript scraping and keeps the output grounded.</p>
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Optional: paste transcript or important video sections here…" />
          <button onClick={generate} disabled={loading || notes.length === 0}>{loading ? "Generating…" : "Generate Groq summary"}</button>
          {error && <p className="vf-error">{error}</p>}
        </div>
      )}
      {!ai && <p className="vf-muted">Add notes, then generate a structured AI summary.</p>}
      {ai && (
        <div className="vf-summary-output">
          <h3>Summary</h3>
          <p>{ai.summary}</p>
          <SummaryList title="Key concepts" items={ai.keyConcepts} />
          <SummaryList title="Action items" items={ai.actionItems} />
          <SummaryList title="Questions to review" items={ai.questions} />
          {ai.beginnerExplanation && <><h3>Beginner explanation</h3><p>{ai.beginnerExplanation}</p></>}
          {ai.quizItems && ai.quizItems.length > 0 && <><h3>Quick recall</h3>{ai.quizItems.map((q, i) => <details key={i}><summary>{q.question}</summary><p>{q.answer}</p></details>)}</>}
        </div>
      )}
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return <><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></>;
}

function ChecklistPanel({ session, noteCount, onCompleted, isOwner }: { session: VideoSession | null; noteCount: number; onCompleted: () => void; isOwner: boolean }) {
  const checklist = [
    { label: "Started a focused session", done: Boolean(session) },
    { label: "Reached 50% progress", done: (session?.progressPct ?? 0) >= 50 },
    { label: "Captured at least 3 notes", done: noteCount >= 3 },
    { label: "Generated or wrote a summary", done: Boolean(session?.summary || session?.aiSummary) },
    { label: "Marked session complete", done: session?.status === "completed" },
  ];

  return (
    <div className="vf-tab-body">
      <div className="vf-checklist">
        {checklist.map((item) => <div key={item.label} className={item.done ? "done" : ""}><CheckCircle2 size={16} /> <span>{item.label}</span></div>)}
      </div>
      <div className="vf-review-card">
        <CalendarClock size={18} />
        <div><strong>Review scheduler</strong><p>Next upgrade: send review reminders to Google Calendar.</p></div>
      </div>
      {isOwner && <button className="vf-primary-btn vf-full" onClick={onCompleted}>Mark as completed</button>}
    </div>
  );
}

function LearningTimeline({ timeline, notes, onSeek }: { timeline: TimelineEvent[]; notes: VideoNote[]; onSeek: (sec: number) => void }) {
  const items = useMemo(() => {
    const noteItems = notes.map((note) => ({ id: `note-${note._id}`, at: note.createdAt, timestampSec: note.timestampSec, label: `${labelForKind(note.kind)} · ${fmtTime(note.timestampSec)}`, message: note.content }));
    const eventItems = timeline.map((event) => ({ id: `event-${event._id}`, at: event.createdAt, timestampSec: event.timestampSec, label: event.type.replace("_", " "), message: event.message }));
    return [...noteItems, ...eventItems].sort((a, b) => a.at - b.at);
  }, [timeline, notes]);

  return (
    <section className="vf-timeline-card">
      <div className="vf-section-head"><FileText size={16} /><div><h2>Learning timeline</h2><p>A detailed record of how this video was learned.</p></div></div>
      {items.length === 0 && <p className="vf-muted">Progress and notes will build your timeline.</p>}
      <div className="vf-timeline-list">
        {items.map((item) => (
          <button key={item.id} onClick={() => item.timestampSec !== undefined && onSeek(item.timestampSec)}>
            <span />
            <strong>{item.label}</strong>
            <small>{item.message}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
