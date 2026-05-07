"use client";

import Link from "next/link";
import { Award, History, PlayCircle, Sparkles } from "lucide-react";
import { fmtTime } from "./utils";
import type { VideoSession } from "./types";

type Props = {
  videoInput: string;
  setVideoInput: (v: string) => void;
  startSession: () => void;
  recentSessions: VideoSession[];
  openSession: (s: VideoSession) => void;
  error: string | null;
  certificateCount: number;
  unclaimedCertificateCount: number;
};

export function VideoFlowStarter({
  videoInput,
  setVideoInput,
  startSession,
  recentSessions,
  openSession,
  error,
  certificateCount,
  unclaimedCertificateCount,
}: Props) {
  const inProgress = recentSessions.find((s) => s.status === "in_progress" && s.lastPositionSec > 5);

  return (
    <div className="vf-start-layout">
      <section className="vf-hero-card">
        <p className="vf-eyebrow"><Sparkles size={14} /> Professional learning mode</p>
        <h1>Turn any YouTube video into a guided learning session.</h1>
        <p>Watch with focus, save timestamped notes, build a timeline, generate AI summaries, and share what you learned with mentors or classmates.</p>

        {inProgress && (
          <button className="vf-resume-callout" onClick={() => openSession(inProgress)}>
            <History size={18} />
            <span>
              <strong>Resume "{inProgress.title ?? "YouTube session"}"</strong>
              <small>Picks up at {fmtTime(inProgress.lastPositionSec)} · {inProgress.progressPct}% complete</small>
            </span>
          </button>
        )}

        <div className="vf-url-row">
          <input
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="Paste a YouTube URL or video ID…"
            onKeyDown={(e) => e.key === "Enter" && startSession()}
          />
          <button onClick={startSession}><PlayCircle size={17} /> Start Video Flow</button>
        </div>
        {error && <p className="vf-error">{error}</p>}
        <div className="vf-feature-grid">
          {[
            "Theater mode",
            "Timestamp notes",
            "A↔B loop",
            "Speed control",
            "AI summary",
            "Ask the video",
            "Export to Markdown",
          ].map((item) => <span key={item}>{item}</span>)}
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
              <img
                src={s.thumbnail ?? `https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg`}
                alt=""
              />
              <span>
                <strong>{s.title ?? "YouTube session"}</strong>
                <small>{s.progressPct}% · {s.status.replace("_", " ")} · {fmtTime(s.lastPositionSec)}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
