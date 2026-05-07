"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Award, RefreshCcw, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtTime } from "./utils";
import type { VideoNote, VideoSession } from "./types";

type QuizQuestion = {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  timestampSec?: number;
};

type Quiz = {
  _id: string;
  sessionId: string;
  userId: string;
  questions: QuizQuestion[];
  bestScore?: number;
  attempts: number;
  generatedAt: number;
};

type Props = {
  sessionId: string | null;
  userId: Id<"learnhub_users"> | null;
  isOwner: boolean;
  notes: VideoNote[];
  session: VideoSession | null;
  transcript: string;
  onSeek: (sec: number) => void;
};

export function QuizPanel({ sessionId, userId, isOwner, notes, session, transcript, onSeek }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const quiz = useQuery(
    api.learnhub_video_flow.getSessionQuiz,
    sessionId && userId
      ? { sessionId: sessionId as Id<"learnhub_video_sessions">, userId }
      : "skip"
  ) as Quiz | null | undefined;

  const saveQuiz = useMutation(api.learnhub_video_flow.saveQuiz);
  const recordAttempt = useMutation(api.learnhub_video_flow.recordQuizAttempt);

  useEffect(() => {
    if (!quiz) return;
    setAnswers(new Array(quiz.questions.length).fill(-1));
  }, [quiz?._id, quiz?.generatedAt]);

  async function generate() {
    if (!sessionId || !userId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/learnhub/video-flow/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session?.title,
          videoId: session?.videoId,
          transcript,
          notes: notes.map((n) => ({ timestamp: fmtTime(n.timestampSec), timestampSec: n.timestampSec, kind: n.kind, content: n.content })),
          count: 6,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quiz generation failed");
      await saveQuiz({
        sessionId: sessionId as Id<"learnhub_video_sessions">,
        userId,
        questions: data.questions,
      });
      setActive(false);
      setSubmitted(false);
      setScore(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function startQuiz() {
    if (!quiz) return;
    setAnswers(new Array(quiz.questions.length).fill(-1));
    setActive(true);
    setSubmitted(false);
    setScore(null);
  }

  async function submit() {
    if (!quiz || !userId) return;
    const correct = quiz.questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
    const pct = Math.round((correct / quiz.questions.length) * 100);
    setScore(pct);
    setSubmitted(true);
    await recordAttempt({
      quizId: quiz._id as Id<"learnhub_video_quizzes">,
      userId,
      score: pct,
    });
  }

  if (quiz === undefined) {
    return <div className="vf-tab-body"><p className="vf-muted">Loading quiz…</p></div>;
  }

  if (!quiz) {
    return (
      <div className="vf-tab-body">
        <p className="vf-muted">Generate a multiple-choice quiz from your notes and transcript. You'll get scored and can retake to push your best.</p>
        {isOwner && (
          <button
            className="vf-primary-btn vf-full"
            onClick={generate}
            disabled={generating || (notes.length === 0 && transcript.trim().length < 120)}
          >
            <Sparkles size={15} /> {generating ? "Generating…" : "Generate quiz"}
          </button>
        )}
        {error && <p className="vf-error">{error}</p>}
      </div>
    );
  }

  if (!active) {
    return (
      <div className="vf-tab-body">
        <div className="vf-quiz-summary">
          <div>
            <h3>{quiz.questions.length}-question quiz</h3>
            <p>
              Best score: <strong>{quiz.bestScore !== undefined ? `${quiz.bestScore}%` : "—"}</strong>
              {" "}· Attempts: <strong>{quiz.attempts}</strong>
            </p>
          </div>
          {quiz.bestScore !== undefined && quiz.bestScore >= 70 && (
            <span className="vf-quiz-badge"><Award size={14} /> Passed</span>
          )}
        </div>
        <button className="vf-primary-btn vf-full" onClick={startQuiz}>Start quiz</button>
        {isOwner && (
          <button className="vf-ghost-btn vf-full" onClick={generate} disabled={generating}>
            <RefreshCcw size={14} /> {generating ? "Regenerating…" : "Regenerate questions"}
          </button>
        )}
        {error && <p className="vf-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="vf-tab-body">
      {submitted && score !== null && (
        <div className={`vf-quiz-result ${score >= 70 ? "passed" : "failed"}`}>
          <strong>{score}%</strong>
          <span>{score >= 70 ? "Passed" : "Below 70% — review and retry"}</span>
        </div>
      )}
      <div className="vf-quiz-list">
        {quiz.questions.map((q, qi) => {
          const picked = answers[qi];
          return (
            <article key={qi} className="vf-quiz-q">
              <header>
                <span>Q{qi + 1}</span>
                {q.timestampSec !== undefined && (
                  <button className="vf-time-chip" onClick={() => onSeek(q.timestampSec!)}>
                    {fmtTime(q.timestampSec)}
                  </button>
                )}
              </header>
              <p className="vf-quiz-prompt">{q.question}</p>
              <div className="vf-quiz-choices">
                {q.choices.map((choice, ci) => {
                  const isPicked = picked === ci;
                  const isCorrect = q.answerIndex === ci;
                  let cls = "vf-quiz-choice";
                  if (submitted) {
                    if (isCorrect) cls += " correct";
                    else if (isPicked) cls += " wrong";
                  } else if (isPicked) cls += " picked";
                  return (
                    <button
                      key={ci}
                      type="button"
                      className={cls}
                      disabled={submitted}
                      onClick={() => {
                        if (submitted) return;
                        const next = [...answers];
                        next[qi] = ci;
                        setAnswers(next);
                      }}
                    >
                      <span className="vf-quiz-choice-letter">{String.fromCharCode(65 + ci)}</span>
                      <span>{choice}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && q.explanation && (
                <p className="vf-quiz-explanation">{q.explanation}</p>
              )}
            </article>
          );
        })}
      </div>
      {!submitted && (
        <button
          className="vf-primary-btn vf-full"
          onClick={submit}
          disabled={answers.some((a) => a === -1)}
        >
          Submit quiz
        </button>
      )}
      {submitted && (
        <button className="vf-ghost-btn vf-full" onClick={startQuiz}>Retake</button>
      )}
    </div>
  );
}
