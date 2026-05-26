"use client";

/**
 * Phase 9.A.5 — Path detail page.
 *
 * Shows the path metadata, modules, and an action panel.
 *  - Author or admin: "Edit path" + "Archive/Publish" controls.
 *  - Already enrolled: "Continue path" link to the My Learning page.
 *  - Otherwise: "Enroll" CTA (via enrollWithCommitment).
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { programColor } from "@/lib/learnhub/org-config";
import type { Id } from "@/convex/_generated/dataModel";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const BG = "var(--lh-bg)";
const CARD = "var(--lh-card)";
const CARD2 = "var(--lh-card-2)";
const BORDER = "var(--lh-border)";
const BORDER2 = "var(--lh-border-strong)";
const TEXT = "var(--lh-text)";
const MUTED = "var(--lh-text-2)";
const INDIGO = "#5b6cff";
const GREEN = "#22d3a0";
const ORANGE = "#f97316";
const SKY = "#38bdf8";

function PathDetailInner() {
  const params = useParams<{ pathId: string }>();
  const router = useRouter();
  const pathId = params.pathId as Id<"learnhub_learning_paths">;
  const { userId } = useLearnhubSession();
  const uid = userId ? (userId as Id<"learnhub_users">) : null;
  const { t } = useLocale();

  const path = useQuery(api.learnhub_learning_paths.getPath, { pathId });
  const enrollment = useQuery(
    api.learnhub_learning_paths.getMyEnrollment,
    uid ? { userId: uid, pathId } : "skip",
  );
  const author = useQuery(
    api.learnhub_users.getUser,
    path ? { id: path.createdBy } : "skip",
  );
  const me = useQuery(
    api.learnhub_users.getUser,
    uid ? { id: uid } : "skip",
  );

  const enroll = useMutation(api.learnhub_learning_paths.enrollWithCommitment);
  const publish = useMutation(api.learnhub_learning_paths.publishLearningPath);
  const archive = useMutation(api.learnhub_learning_paths.archiveLearningPath);
  const clonePath = useMutation(api.learnhub_learning_paths.cloneLearningPath);

  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Rec #6 — per-module AI tutor drawer. Only one module's tutor is open at
  // a time; chat history is kept in a map keyed by moduleIndex so reopening
  // restores the prior conversation within this page session.
  const [tutorOpen, setTutorOpen] = useState<number | null>(null);
  const [tutorChats, setTutorChats] = useState<
    Record<number, Array<{ role: "user" | "assistant"; content: string }>>
  >({});
  const [tutorDraft, setTutorDraft] = useState("");
  const [tutorSending, setTutorSending] = useState(false);
  const [tutorErr, setTutorErr] = useState<string | null>(null);

  if (path === undefined) {
    return <div style={{ background: BG, color: MUTED, padding: 32, minHeight: "100vh" }}>Loading…</div>;
  }
  if (path === null) {
    return (
      <div style={{ background: BG, color: TEXT, padding: 32, minHeight: "100vh" }}>
        <p>This path doesn't exist.</p>
        <Link href="/learnhub/paths" style={{ color: SKY }}>← Browse paths</Link>
      </div>
    );
  }

  const isAuthor = uid && path.createdBy === uid;
  const isAdmin = me?.role === "admin" || me?.role === "coordinator" || me?.role === "org_partner";
  const visibility = path.visibility ?? "public";
  const published = path.published ?? true;
  const canEnroll = visibility === "public" || isAuthor;

  const handleEnroll = async () => {
    if (!uid) return;
    setEnrolling(true);
    setErr(null);
    try {
      await enroll({ userId: uid, pathId });
      router.push("/learnhub/learning-path");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEnrolling(false);
    }
  };

  const handlePublish = async () => {
    if (!uid) return;
    setBusy(true);
    setErr(null);
    try {
      await publish({ actorId: uid, pathId });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!uid) return;
    if (!confirm("Archive this path? Existing enrollments keep working, but it leaves the browse surface.")) return;
    setBusy(true);
    setErr(null);
    try {
      await archive({ actorId: uid, pathId });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendTutorMessage = async (moduleIndex: number) => {
    if (!path) return;
    const text = tutorDraft.trim();
    if (!text || tutorSending) return;
    const mod = path.modules[moduleIndex];
    if (!mod) return;
    const history = tutorChats[moduleIndex] ?? [];
    const nextHistory = [...history, { role: "user" as const, content: text }];
    setTutorChats((m) => ({ ...m, [moduleIndex]: nextHistory }));
    setTutorDraft("");
    setTutorSending(true);
    setTutorErr(null);
    try {
      const res = await fetch("/api/learnhub/tutor/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathTitle: path.title,
          moduleTitle: mod.title || `Module ${mod.order}`,
          // Module rows don't carry their own description in the schema,
          // so we fall back to the path-level description for grounding.
          moduleDescription: path.description,
          messages: nextHistory,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `Tutor error (${res.status})`);
      }
      const reply = data.reply ?? "(no reply)";
      setTutorChats((m) => ({
        ...m,
        [moduleIndex]: [...nextHistory, { role: "assistant" as const, content: reply }],
      }));
    } catch (e) {
      setTutorErr((e as Error).message);
    } finally {
      setTutorSending(false);
    }
  };

  const handleClone = async () => {
    if (!uid) return;
    setCloning(true);
    setErr(null);
    try {
      const newId = await clonePath({ actorId: uid, sourcePathId: pathId });
      router.push(`/learnhub/learning-path/create?edit=${newId}`);
    } catch (e) {
      setErr((e as Error).message);
      setCloning(false);
    }
  };

  const coverColor = path.coverColor ?? programColor(path.programType);
  const visibilityChip = visibility === "public"
    ? { label: "Public", bg: "rgba(34,197,94,0.14)", fg: GREEN }
    : visibility === "cohort"
    ? { label: "Cohort", bg: "rgba(56,189,248,0.14)", fg: SKY }
    : { label: "Private", bg: "rgba(185,190,230,0.14)", fg: MUTED };

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", padding: "24px 32px" }}>
      <Link href="/learnhub/paths" style={{ color: MUTED, fontSize: 12, textDecoration: "none" }}>
        ← Browse paths
      </Link>

      {/* Header */}
      <header
        style={{
          marginTop: 12,
          marginBottom: 20,
          background: `linear-gradient(135deg, ${coverColor}30, ${CARD})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: 24,
          display: "flex",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ fontSize: 56, lineHeight: 1 }}>{path.coverEmoji ?? "📚"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, padding: "2px 8px", borderRadius: 4, background: `${coverColor}1c`, color: coverColor, border: `1px solid ${coverColor}33` }}>
              {path.programType.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: visibilityChip.bg, color: visibilityChip.fg, fontWeight: 600 }}>
              {visibilityChip.label}
            </span>
            {!published && (
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(251,191,36,0.14)", color: "#fbbf24", fontWeight: 600 }}>
                Draft
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px" }}>{path.title}</h1>
          <p style={{ color: MUTED, fontSize: 14, margin: "0 0 12px", lineHeight: 1.5 }}>{path.description}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: MUTED }}>
            <span>{path.modules.length} modules</span>
            <span>~{path.estimatedWeeks} weeks</span>
            <span>{path.enrollmentCount} enrolled</span>
          </div>
          {author && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <img src={author.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: 99 }} />
              <span style={{ fontSize: 12, color: MUTED }}>
                by <span style={{ color: TEXT, fontWeight: 600 }}>{author.name}</span>
                {author.role === "mentor" && author.mentorStatus === "verified" && (
                  <span style={{ marginLeft: 6, color: GREEN, fontSize: 11 }}>✓ Verified</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Action panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
          {enrollment ? (
            <Link
              href="/learnhub/learning-path"
              style={{ padding: "10px 16px", borderRadius: 99, background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: 13, textAlign: "center" }}
            >
              {t("btn.continuePath")}
            </Link>
          ) : canEnroll ? (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              style={{ padding: "10px 16px", borderRadius: 99, background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`, color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              {enrolling ? t("btn.enrolling") : t("btn.enroll")}
            </button>
          ) : null}

          {(isAuthor || isAdmin) && (
            <>
              {!published ? (
                <button
                  onClick={handlePublish}
                  disabled={busy}
                  style={{ padding: "8px 14px", borderRadius: 99, background: GREEN, color: "#fff", border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                >
                  {t("btn.publish")}
                </button>
              ) : (
                <button
                  onClick={handleArchive}
                  disabled={busy}
                  style={{ padding: "8px 14px", borderRadius: 99, background: "transparent", color: "#fca5a5", border: `1px solid ${BORDER2}`, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                >
                  {t("btn.archive")}
                </button>
              )}
              <Link
                href={`/learnhub/learning-path/create?edit=${pathId}`}
                style={{ padding: "8px 14px", borderRadius: 99, background: "transparent", color: TEXT, border: `1px solid ${BORDER2}`, textDecoration: "none", fontWeight: 600, fontSize: 12, textAlign: "center" }}
              >
                {t("btn.editPath")}
              </Link>
            </>
          )}

          {/* Rec #9 — non-authors can clone a public path as a private draft */}
          {!isAuthor && visibility === "public" && uid && (
            <button
              onClick={handleClone}
              disabled={cloning}
              style={{ padding: "8px 14px", borderRadius: 99, background: "transparent", color: SKY, border: `1px solid ${BORDER2}`, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              title="Copy this path into your private drafts to customize"
            >
              {cloning ? "Cloning…" : t("btn.cloneCustomize")}
            </button>
          )}
        </div>
      </header>

      {err && <p style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>{err}</p>}

      {/* Modules */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>
          Modules
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {path.modules.map((m, i) => {
            const completed = enrollment && enrollment.completedModuleIndices.includes(i);
            const current = enrollment && enrollment.currentModuleIndex === i;
            const requirement =
              m.completionRequirements.formPassingScore !== undefined
                ? `Quiz: ${m.completionRequirements.formPassingScore}% to pass`
                : m.completionRequirements.watchPercent !== undefined
                ? `Watch: ${m.completionRequirements.watchPercent}%`
                : "Free advance";
            const tutorIsOpen = tutorOpen === i;
            const history = tutorChats[i] ?? [];
            return (
              <div
                key={i}
                style={{
                  background: CARD,
                  border: `1px solid ${current ? coverColor : BORDER}`,
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 99,
                    background: completed ? GREEN : current ? coverColor : "rgba(255,255,255,0.05)",
                    color: completed ? "#fff" : MUTED,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {completed ? "✓" : m.order}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{m.title || "(untitled)"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED }}>
                      {m.postIds.length === 0 ? "No materials yet — author is still composing." : `${m.postIds.length} item${m.postIds.length === 1 ? "" : "s"}`} · {requirement}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTutorOpen(tutorIsOpen ? null : i);
                      setTutorErr(null);
                      setTutorDraft("");
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 99,
                      background: tutorIsOpen ? INDIGO : "rgba(91,108,255,0.14)",
                      color: tutorIsOpen ? "#fff" : "#a8b4ff",
                      border: `1px solid ${tutorIsOpen ? INDIGO : "rgba(91,108,255,0.3)"}`,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    title="Open the AI tutor for this module"
                  >
                    {tutorIsOpen ? t("btn.closeTutor") : history.length > 0 ? `Tutor (${history.filter((x) => x.role === "user").length})` : t("btn.askTutor")}
                  </button>
                </div>

                {tutorIsOpen && (
                  <div
                    style={{
                      background: CARD2,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        maxHeight: 240,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {history.length === 0 ? (
                        <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                          Ask anything about <strong style={{ color: TEXT }}>{m.title || `Module ${m.order}`}</strong>. The tutor stays scoped to this module.
                        </p>
                      ) : (
                        history.map((msg, idx) => (
                          <div
                            key={idx}
                            style={{
                              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                              maxWidth: "85%",
                              background: msg.role === "user" ? `${INDIGO}26` : "rgba(255,255,255,0.04)",
                              border: `1px solid ${msg.role === "user" ? "rgba(91,108,255,0.4)" : BORDER}`,
                              color: TEXT,
                              padding: "8px 12px",
                              borderRadius: 10,
                              fontSize: 13,
                              lineHeight: 1.5,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {msg.content}
                          </div>
                        ))
                      )}
                      {tutorSending && (
                        <p style={{ fontSize: 11, color: MUTED, margin: 0, alignSelf: "flex-start" }}>
                          Tutor is typing…
                        </p>
                      )}
                    </div>
                    {tutorErr && (
                      <p style={{ fontSize: 11, color: "#fca5a5", margin: 0 }}>{tutorErr}</p>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={tutorDraft}
                        onChange={(e) => setTutorDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendTutorMessage(i);
                          }
                        }}
                        placeholder="Ask the tutor a question…"
                        disabled={tutorSending}
                        style={{
                          flex: 1,
                          background: "rgba(0,0,0,0.3)",
                          border: `1px solid ${BORDER2}`,
                          borderRadius: 8,
                          padding: "8px 12px",
                          color: TEXT,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => sendTutorMessage(i)}
                        disabled={tutorSending || !tutorDraft.trim()}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: INDIGO,
                          color: "#fff",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: tutorSending || !tutorDraft.trim() ? "not-allowed" : "pointer",
                          opacity: tutorSending || !tutorDraft.trim() ? 0.5 : 1,
                        }}
                      >
                        {t("btn.send")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function PathDetailPage() {
  return (
    <Suspense fallback={null}>
      <PathDetailInner />
    </Suspense>
  );
}
