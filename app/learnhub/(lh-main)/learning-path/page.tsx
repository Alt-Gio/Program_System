"use client";

/**
 * /learnhub/learning-path — three-tab learner overview.
 *
 *   • Paths   — enrolled learnhub_learning_paths with module progress.
 *   • Courses — active learnhub_video_courses with watch progress.
 *   • Saved   — the legacy bookmark Kanban (kept for muscle-memory).
 *
 * One subscription powers the Paths/Courses headers via the new
 * `learnhub_progress.getLearnerOverview` and
 * `learnhub_video_courses.getCoursesForUser` queries — the existing
 * `learnhub_bookmarks` queries still power the Saved tab.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { Flame, ArrowRight, BookMarked, GraduationCap, Play, Layers } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const ORANGE = "#f97316";
const INDIGO = "#5b6cff";
const GREEN = "#22d3a0";
const AMBER = "#fbbf24";
const SKY = "#38bdf8";

type Tab = "paths" | "courses" | "saved";
type BookmarkStatus = "want_to_learn" | "in_progress" | "done";

const BOOKMARK_COLUMNS: { id: BookmarkStatus; label: string; emoji: string; color: string }[] = [
  { id: "want_to_learn", label: "Want to Learn", emoji: "🎯", color: INDIGO },
  { id: "in_progress",   label: "In Progress",   emoji: "⚡", color: ORANGE },
  { id: "done",          label: "Done",          emoji: "✅", color: GREEN },
];

export default function LearningPathPage() {
  const { userId } = useLearnhubSession();
  const uid = userId ? (userId as Id<"learnhub_users">) : null;

  const [tab, setTab] = useState<Tab>("paths");

  const overview = useQuery(
    api.learnhub_progress.getLearnerOverview,
    uid ? { userId: uid } : "skip",
  );
  const courses = useQuery(
    api.learnhub_video_courses.getCoursesForUser,
    uid ? { userId: uid } : "skip",
  );
  const bookmarks = useQuery(
    api.learnhub_bookmarks.listBookmarks,
    uid ? { userId: uid } : "skip",
  );
  const flashcardsDue = useQuery(
    api.learnhub_video_flow.countMyDueFlashcards,
    uid ? { userId: uid } : "skip",
  );

  const upsertBookmark = useMutation(api.learnhub_bookmarks.upsertBookmark);
  const removeBookmark = useMutation(api.learnhub_bookmarks.removeBookmark);

  if (!uid) {
    return (
      <div className="px-4 py-6" style={{ color: "#e8eaff" }}>
        <p>Sign in to see your learning path.</p>
        <Link href="/learnhub/login" style={{ color: INDIGO }}>← Sign in</Link>
      </div>
    );
  }

  const streak = overview?.streak;
  const pathCount = overview?.paths?.length ?? 0;
  const inProgressSessions = overview?.sessionsInProgress ?? [];

  return (
    <div className="px-4 py-6" style={{ color: "#e8eaff", fontFamily: "var(--font-dm-sans, 'Inter', sans-serif)" }}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)", letterSpacing: "-0.02em" }}>
            My Learning Path
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>
            {overview === undefined || overview === null
              ? "Loading…"
              : `${pathCount} path${pathCount === 1 ? "" : "s"} · ${inProgressSessions.length} video${inProgressSessions.length === 1 ? "" : "s"} in progress · ${overview.certCount} certificate${overview.certCount === 1 ? "" : "s"}`}
          </p>
        </div>
        {streak && (streak.currentStreak ?? 0) > 0 && (
          <span title="Daily learning streak" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            background: `${ORANGE}1c`, border: `1px solid ${ORANGE}55`, color: ORANGE,
            fontSize: 12, fontWeight: 700,
          }}>
            <Flame size={14} /> {streak.currentStreak}-day streak
          </span>
        )}
      </div>

      {/* Flashcards-due review tile */}
      {flashcardsDue !== undefined && (
        <FlashcardsTile
          dueCount={flashcardsDue.dueCount}
          firstDueSessionId={flashcardsDue.firstDueSessionId}
        />
      )}

      {/* Stat strip */}
      {overview && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10, marginBottom: 18,
        }}>
          <StatTile icon={<Layers size={14} />} label="Paths enrolled" value={pathCount} color={INDIGO} />
          <StatTile icon={<Play size={14} />} label="Active videos" value={inProgressSessions.length} color={ORANGE} />
          <StatTile icon={<GraduationCap size={14} />} label="Certificates" value={overview.certCount} color={GREEN} />
          <StatTile icon={<BookMarked size={14} />} label="Saved" value={overview.bookmarkCounts.want_to_learn + overview.bookmarkCounts.in_progress + overview.bookmarkCounts.done} color={SKY} />
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="Learning path sections" style={{
        display: "flex", gap: 4, marginBottom: 18,
        padding: 4, borderRadius: 12,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        width: "fit-content",
      }}>
        {([
          { id: "paths" as const, label: "Paths", count: pathCount },
          { id: "courses" as const, label: "Courses", count: courses?.length ?? 0 },
          { id: "saved" as const, label: "Saved", count: bookmarks?.length ?? 0 },
        ]).map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: active ? "rgba(91,108,255,0.18)" : "transparent",
              color: active ? "#e8eaff" : "#9ba3cc",
              border: active ? "1px solid rgba(91,108,255,0.4)" : "1px solid transparent",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)",
            }}>
              <span>{t.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 999,
                background: active ? "rgba(91,108,255,0.3)" : "rgba(255,255,255,0.06)",
                color: active ? "#e8eaff" : "#9ba3cc",
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "paths" && (
        <PathsTab overview={overview ?? undefined} />
      )}
      {tab === "courses" && (
        <CoursesTab courses={courses} sessions={inProgressSessions} completed={overview?.sessionsCompleted ?? []} />
      )}
      {tab === "saved" && (
        <SavedTab
          bookmarks={bookmarks}
          uid={uid}
          onMove={async (postId, status) => {
            await upsertBookmark({ userId: uid, postId: postId as Id<"learnhub_posts">, status });
          }}
          onRemove={async (bookmarkId) => {
            await removeBookmark({ bookmarkId: bookmarkId as Id<"learnhub_bookmarks"> });
          }}
        />
      )}
    </div>
  );
}

function FlashcardsTile({
  dueCount,
  firstDueSessionId,
}: {
  dueCount: number;
  firstDueSessionId: Id<"learnhub_video_sessions"> | null;
}) {
  const hasDue = dueCount > 0;
  const href = hasDue && firstDueSessionId
    ? `/learnhub/video-flow?session=${encodeURIComponent(firstDueSessionId)}&tab=flashcards`
    : null;
  return (
    <div
      style={{
        marginBottom: 14,
        padding: "12px 16px",
        borderRadius: 12,
        background: hasDue
          ? `linear-gradient(135deg, ${AMBER}1c, ${ORANGE}14)`
          : "rgba(34,211,160,0.06)",
        border: `1px solid ${hasDue ? AMBER + "55" : GREEN + "44"}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{hasDue ? "🎴" : "✅"}</span>
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#e8eaff",
            fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)",
          }}
        >
          {hasDue
            ? `${dueCount} flashcard${dueCount === 1 ? "" : "s"} due for review`
            : "All caught up on flashcards"}
        </div>
        <div style={{ fontSize: 11.5, color: "#9ba3cc", marginTop: 2 }}>
          {hasDue
            ? "Spend a few minutes to keep your spaced-repetition streak alive."
            : "New cards become due as you space them out — check back tomorrow."}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          style={{
            padding: "7px 14px",
            borderRadius: 999,
            background: `linear-gradient(135deg, ${ORANGE}, #ef4444)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Review now →
        </Link>
      )}
    </div>
  );
}

function StatTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color }}>
        {icon}
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#e8eaff", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Paths tab
// ────────────────────────────────────────────────────────────────────────

type OverviewResult = NonNullable<ReturnType<typeof useQuery<typeof api.learnhub_progress.getLearnerOverview>>>;

function PathsTab({ overview }: { overview: OverviewResult | undefined }) {
  if (overview === undefined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} className="lh-path-card" style={{ minHeight: 120, opacity: 0.5 }} />
        ))}
      </div>
    );
  }
  if (overview === null || overview.paths.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: "center", borderRadius: 16,
        background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
        color: "#9ba3cc",
      }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>🗺️</div>
        <p style={{ margin: 0, fontWeight: 700, color: "#e8eaff", fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)" }}>
          You haven&rsquo;t enrolled in a path yet
        </p>
        <p style={{ margin: "6px auto 14px", fontSize: 13, maxWidth: 460 }}>
          Learning paths are multi-module programs your mentor or coordinator publishes. Browse the available paths or check in with your mentor for an enrollment link.
        </p>
        <Link href="/learnhub/feed" style={{
          display: "inline-block", padding: "9px 18px", borderRadius: 999,
          background: ORANGE, color: "white", fontWeight: 700, fontSize: 13,
          textDecoration: "none",
        }}>Explore the feed →</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {overview.paths.map((p) => (
        <PathCard key={p.pathId as unknown as string} path={p} />
      ))}
      {overview.goals.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <h3 style={{ margin: "8px 0", fontSize: 12.5, color: "#9ba3cc", letterSpacing: 1.2, textTransform: "uppercase" }}>Goals</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {overview.goals.map((g) => (
              <div key={g.id as unknown as string} style={{
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>{g.completedAt ? "✅" : "🎯"}</span>
                <span style={{ flex: 1, fontSize: 13, color: "#e8eaff", textDecoration: g.completedAt ? "line-through" : "none" }}>
                  {g.title}
                </span>
                {g.deadline && (
                  <span style={{ fontSize: 11, color: "#9ba3cc" }}>
                    {formatDistanceToNow(g.deadline, { addSuffix: true })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PathCard({ path }: { path: OverviewResult["paths"][number] }) {
  const isComplete = path.completedAt !== null;
  const continueHref = path.nextPostId
    ? `/learnhub/feed?post=${path.nextPostId}#post-${path.nextPostId}`
    : "/learnhub/feed";
  return (
    <div className="lh-path-card" style={{
      padding: 16, borderRadius: 14,
      background: `linear-gradient(135deg, ${INDIGO}10, rgba(255,255,255,0.025))`,
      border: `1px solid ${isComplete ? `${GREEN}55` : `${INDIGO}33`}`,
      display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2,
            padding: "2px 8px", borderRadius: 4,
            background: `${INDIGO}1c`, color: INDIGO, border: `1px solid ${INDIGO}33`,
          }}>{path.programType.toUpperCase()}</span>
          {isComplete && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2,
              padding: "2px 8px", borderRadius: 4,
              background: `${GREEN}1c`, color: GREEN, border: `1px solid ${GREEN}33`,
            }}>COMPLETED</span>
          )}
        </div>
        <h3 style={{
          margin: 0, fontSize: 17, fontWeight: 700, color: "#e8eaff",
          fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)",
          letterSpacing: "-0.01em",
        }}>{path.title}</h3>
        <p style={{
          margin: "4px 0 10px", fontSize: 12.5, color: "#9ba3cc", lineHeight: 1.5,
          maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
        }}>{path.description}</p>

        {/* Progress bar + counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            flex: 1, height: 8, borderRadius: 99,
            background: "rgba(255,255,255,0.06)", overflow: "hidden",
          }}>
            <div style={{
              width: `${path.progressPct}%`, height: "100%",
              background: isComplete ? GREEN : ORANGE,
              transition: "width 0.3s ease",
            }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: isComplete ? GREEN : ORANGE, minWidth: 70, textAlign: "right" }}>
            {path.completedModules} / {path.totalModules} · {path.progressPct}%
          </span>
        </div>

        {!isComplete && path.currentModuleTitle && (
          <p style={{ margin: 0, fontSize: 12, color: "#9ba3cc" }}>
            <span style={{ color: "#cdd2e6", fontWeight: 600 }}>Next:</span> {path.currentModuleTitle}
          </p>
        )}
      </div>

      <Link href={continueHref} style={{
        padding: "10px 16px", borderRadius: 999, textDecoration: "none",
        background: isComplete ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
        color: isComplete ? "#9ba3cc" : "white",
        border: isComplete ? "1px solid rgba(255,255,255,0.08)" : "none",
        fontSize: 12.5, fontWeight: 700,
        display: "inline-flex", alignItems: "center", gap: 6,
        whiteSpace: "nowrap",
      }}>
        {isComplete ? "Review" : "Continue"} <ArrowRight size={14} />
      </Link>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Courses tab — user-built playlists + raw in-progress video sessions
// ────────────────────────────────────────────────────────────────────────

type CoursesResult = NonNullable<ReturnType<typeof useQuery<typeof api.learnhub_video_courses.getCoursesForUser>>>;
type Session = OverviewResult["sessionsInProgress"][number];

function CoursesTab({ courses, sessions, completed }: {
  courses: CoursesResult | undefined;
  sessions: Session[];
  completed: OverviewResult["sessionsCompleted"];
}) {
  if (courses === undefined && sessions.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: "center", borderRadius: 16,
        background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
        color: "#9ba3cc",
      }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>📺</div>
        <p style={{ margin: 0, fontWeight: 700, color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Loading your courses…</p>
      </div>
    );
  }

  const hasSomething = (courses && courses.length > 0) || sessions.length > 0 || completed.length > 0;
  if (!hasSomething) {
    return (
      <div style={{
        padding: 40, textAlign: "center", borderRadius: 16,
        background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
        color: "#9ba3cc",
      }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>📚</div>
        <p style={{ margin: 0, fontWeight: 700, color: "#e8eaff", fontFamily: "var(--font-sora)" }}>No active courses yet</p>
        <p style={{ margin: "6px auto 14px", fontSize: 13, maxWidth: 460 }}>
          Start a video on the feed, group videos into a playlist on <Link href="/learnhub/video-flow" style={{ color: INDIGO }}>Video Flow</Link>, or watch a curated short on <Link href="/learnhub/watch" style={{ color: ORANGE }}>Watch</Link>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {sessions.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 10px", fontSize: 12.5, color: "#9ba3cc", letterSpacing: 1.2, textTransform: "uppercase" }}>
            Pick up where you left off
          </h3>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 12,
          }}>
            {sessions.map((s) => (
              <SessionCard key={s.id as unknown as string} s={s} />
            ))}
          </div>
        </section>
      )}

      {courses && courses.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 10px", fontSize: 12.5, color: "#9ba3cc", letterSpacing: 1.2, textTransform: "uppercase" }}>
            Your playlists
          </h3>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}>
            {courses.map((c) => (
              <CourseCard key={c.id as unknown as string} c={c} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 10px", fontSize: 12.5, color: "#9ba3cc", letterSpacing: 1.2, textTransform: "uppercase" }}>
            Recently completed
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {completed.map((s) => (
              <div key={s.id as unknown as string} style={{
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(34,211,160,0.06)", border: `1px solid ${GREEN}33`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ flex: 1, fontSize: 13, color: "#e8eaff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </span>
                <span style={{ fontSize: 11, color: "#9ba3cc" }}>
                  {formatDistanceToNow(s.completedAt, { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SessionCard({ s }: { s: Session }) {
  const ringSize = 44;
  const stroke = 4;
  const r = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (s.progressPct / 100) * circ;
  return (
    <Link href={`/learnhub/video-flow?videoId=${encodeURIComponent(s.videoId)}`} style={{
      display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 12,
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
      textDecoration: "none", color: "inherit",
    }}>
      <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "#10121e" }}>
        {s.thumbnail ? (
          <img src={s.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ba3cc" }}>
            <Play size={20} />
          </div>
        )}
        <div className="lh-path-progress-ring" style={{ position: "absolute", bottom: 6, right: 6 }}>
          <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} fill="none" />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={r}
              stroke={ORANGE} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            />
          </svg>
          <span style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 9.5, fontWeight: 800, color: "#fff",
          }}>{s.progressPct}%</span>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: "#e8eaff",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          lineHeight: 1.35,
        }}>{s.title}</div>
        {s.channelName && (
          <div style={{ fontSize: 11, color: "#9ba3cc", marginTop: 3 }}>{s.channelName}</div>
        )}
      </div>
    </Link>
  );
}

function CourseCard({ c }: { c: CoursesResult[number] }) {
  return (
    <Link
      href={c.nextVideoId
        ? `/learnhub/video-flow?videoId=${encodeURIComponent(c.nextVideoId)}&courseId=${c.id}`
        : `/learnhub/video-flow?courseId=${c.id}`}
      style={{
        display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 12,
        background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
        textDecoration: "none", color: "inherit",
      }}>
      <div style={{
        aspectRatio: "16/9", borderRadius: 8, overflow: "hidden",
        background: c.coverImageUrl ? "#10121e" : `linear-gradient(135deg, ${INDIGO}33, ${ORANGE}22)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.55)",
      }}>
        {c.coverImageUrl ? (
          <img src={c.coverImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Layers size={28} />
        )}
      </div>
      <div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: "#e8eaff",
          fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)",
        }}>{c.title}</div>
        <div style={{ fontSize: 11.5, color: "#9ba3cc", marginTop: 3 }}>
          {c.completedCount} / {c.itemCount} videos · {c.totalProgress}%
        </div>
        <div style={{
          marginTop: 6, height: 4, borderRadius: 99,
          background: "rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <div style={{
            width: `${c.totalProgress}%`, height: "100%", background: ORANGE,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Saved tab — preserved Kanban
// ────────────────────────────────────────────────────────────────────────

type BookmarksResult = NonNullable<ReturnType<typeof useQuery<typeof api.learnhub_bookmarks.listBookmarks>>>;

function SavedTab({ bookmarks, onMove, onRemove }: {
  bookmarks: BookmarksResult | undefined;
  uid: Id<"learnhub_users">;
  onMove: (postId: string, status: BookmarkStatus) => Promise<void>;
  onRemove: (bookmarkId: string) => Promise<void>;
}) {
  const grouped = useMemo(() => {
    const out: Record<BookmarkStatus, BookmarksResult> = {
      want_to_learn: [],
      in_progress: [],
      done: [],
    };
    if (!bookmarks) return out;
    for (const b of bookmarks) out[b.status as BookmarkStatus].push(b);
    return out;
  }, [bookmarks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {BOOKMARK_COLUMNS.map((col) => {
        const items = grouped[col.id];
        return (
          <div key={col.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <span className="text-base">{col.emoji}</span>
              <span className="text-sm font-semibold" style={{ color: col.color, fontFamily: "var(--font-sora)" }}>{col.label}</span>
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: col.color + "20", color: col.color }}>
                {bookmarks === undefined ? "…" : items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 min-h-24 rounded-2xl p-2" style={{ background: "rgba(255,255,255,0.02)", border: `1px dashed ${col.color}25` }}>
              {bookmarks === undefined && Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#131626" }} />
              ))}

              {bookmarks !== undefined && items.length === 0 && (
                <div className="flex items-center justify-center h-20">
                  <p className="text-xs text-center" style={{ color: "#5c6490" }}>
                    {col.id === "want_to_learn"
                      ? "Bookmark posts from the Feed"
                      : `Move cards here when ${col.id === "in_progress" ? "you start" : "complete"}`}
                  </p>
                </div>
              )}

              {items.map((bookmark) => {
                const post = bookmark.post as Record<string, unknown> | null;
                if (!post) return null;
                const otherStatuses = BOOKMARK_COLUMNS.filter((c) => c.id !== col.id);
                return (
                  <div key={bookmark._id as unknown as string} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-medium line-clamp-2" style={{ color: "#e8eaff" }}>
                      {(post.content as string)?.slice(0, 80)}{(post.content as string)?.length > 80 ? "…" : ""}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: "rgba(255,255,255,0.05)", color: "#9ba3cc" }}>{post.type as string}</span>
                      <span className="text-[10px]" style={{ color: "#5c6490" }}>{formatDistanceToNow(bookmark.updatedAt, { addSuffix: true })}</span>
                    </div>
                    <div className="flex gap-1">
                      {otherStatuses.map((s) => (
                        <button key={s.id} onClick={() => onMove(bookmark.postId as unknown as string, s.id)} className="flex-1 text-[10px] py-1 rounded-lg font-medium" style={{ background: s.color + "15", color: s.color, border: `1px solid ${s.color}25` }}>
                          → {s.label.split(" ")[0]}
                        </button>
                      ))}
                      <button onClick={() => onRemove(bookmark._id as unknown as string)} className="px-2 py-1 rounded-lg text-[10px]" style={{ color: "#5c6490" }} title="Remove bookmark">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
