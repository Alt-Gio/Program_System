"use client";

/**
 * Phase 9.A.4 — Create a Learning Path.
 *
 * Single-page form: metadata + modules (orderable) + post picker.
 * - Students see visibility forced to Private (UI + mutation guard).
 * - Mentors/coordinators/admins/org_partners can pick Private/Cohort/Public.
 * - ?goalId=... pre-fills the title from the goal and forces visibility=private.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { ORG_CONFIG, programColor } from "@/lib/learnhub/org-config";
import type { Id } from "@/convex/_generated/dataModel";

const BG = "#090b18";
const CARD = "#111323";
const CARD2 = "#161929";
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT = "#e8eaf4";
const MUTED = "rgba(185,190,230,0.6)";
const INDIGO = "#5b6cff";
const GREEN = "#22d3a0";
const ORANGE = "#f97316";

type Visibility = "private" | "cohort" | "public";

type Module = {
  order: number;
  title: string;
  postIds: Id<"learnhub_posts">[];
  completionRequirements: {
    watchPercent?: number;
    formPassingScore?: number;
  };
};

const POST_TYPES = ["youtube", "video", "drive", "form", "text", "meet", "event", "opportunity", "certificate", "photo"] as const;

function PathCreatorInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const goalIdParam = sp.get("goalId");
  const editPathIdParam = sp.get("edit");
  const isEditMode = !!editPathIdParam;
  const { userId } = useLearnhubSession();
  const uid = userId ? (userId as Id<"learnhub_users">) : null;

  const me = useQuery(api.learnhub_users.getUser, uid ? { id: uid } : "skip");
  // Fetch the goal if provided (pull from learner overview)
  const overview = useQuery(
    api.learnhub_progress.getLearnerOverview,
    uid && goalIdParam ? { userId: uid } : "skip",
  );
  const goalRow = useMemo(() => {
    if (!goalIdParam || !overview) return null;
    return overview.goals.find((g) => g._id === goalIdParam) ?? null;
  }, [goalIdParam, overview]);

  // Edit mode — load the existing path.
  const editPath = useQuery(
    api.learnhub_learning_paths.getPath,
    isEditMode ? { pathId: editPathIdParam as Id<"learnhub_learning_paths"> } : "skip",
  );

  const isStudent = me?.role === "student";
  const canPublishPublic =
    me?.role === "mentor" && me?.mentorStatus === "verified"
      ? true
      : me?.role === "coordinator" || me?.role === "org_partner" || me?.role === "admin";

  // Metadata state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [programType, setProgramType] = useState<string>(ORG_CONFIG.programs[0] ?? "");
  const [estimatedWeeks, setEstimatedWeeks] = useState<number>(8);
  const [coverEmoji, setCoverEmoji] = useState("📚");
  const [coverColor, setCoverColor] = useState<string>(programColor(ORG_CONFIG.programs[0] ?? ""));
  const [visibility, setVisibility] = useState<Visibility>("private");

  // Pre-fill from goal
  useEffect(() => {
    if (goalRow && !title) {
      setTitle(`Path: ${goalRow.title}`);
      setVisibility("private");
    }
  }, [goalRow, title]);

  // Force student to private
  useEffect(() => {
    if (isStudent && visibility !== "private") setVisibility("private");
  }, [isStudent, visibility]);

  // Modules state
  const [modules, setModules] = useState<Module[]>([
    { order: 1, title: "", postIds: [], completionRequirements: {} },
  ]);

  const createPath = useMutation(api.learnhub_learning_paths.createLearningPath);
  const updatePath = useMutation(api.learnhub_learning_paths.updateLearningPath);
  const publishPath = useMutation(api.learnhub_learning_paths.publishLearningPath);
  const createMaterial = useMutation(api.learnhub_posts.createMaterialPost);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hydratedFromEdit, setHydratedFromEdit] = useState(false);

  // Hydrate state from edit-mode path.
  useEffect(() => {
    if (!editPath || hydratedFromEdit) return;
    setTitle(editPath.title);
    setDescription(editPath.description);
    setProgramType(editPath.programType);
    setEstimatedWeeks(editPath.estimatedWeeks);
    setCoverEmoji(editPath.coverEmoji ?? "📚");
    if (editPath.coverColor) setCoverColor(editPath.coverColor);
    setVisibility((editPath.visibility ?? "public") as Visibility);
    setModules(
      editPath.modules.map((m) => ({
        order: m.order,
        title: m.title,
        postIds: [...m.postIds],
        completionRequirements: { ...m.completionRequirements },
      })),
    );
    setHydratedFromEdit(true);
  }, [editPath, hydratedFromEdit]);

  // Post picker state (one picker open at a time for a given module)
  const [pickerForModule, setPickerForModule] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerType, setPickerType] = useState<string>("");

  // Rec #1 — inline URL composer state (per module)
  const [urlComposerForModule, setUrlComposerForModule] = useState<number | null>(null);
  const [composerUrl, setComposerUrl] = useState("");
  const [composerTitle, setComposerTitle] = useState("");
  const [composerSaving, setComposerSaving] = useState(false);
  const pickerPosts = useQuery(
    api.learnhub_posts.searchPostsForComposer,
    pickerForModule !== null
      ? {
          hashtag: pickerSearch || undefined,
          type: pickerType || undefined,
          limit: 30,
        }
      : "skip",
  );

  const addModule = () => {
    setModules((prev) => [
      ...prev,
      { order: prev.length + 1, title: "", postIds: [], completionRequirements: {} },
    ]);
  };

  const removeModule = (index: number) => {
    setModules((prev) => prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i + 1 })));
  };

  const moveModule = (index: number, delta: -1 | 1) => {
    setModules((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((m, i) => ({ ...m, order: i + 1 }));
    });
  };

  const updateModule = (index: number, patch: Partial<Module>) => {
    setModules((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const addPostToModule = (moduleIndex: number, postId: Id<"learnhub_posts">) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === moduleIndex
          ? { ...m, postIds: m.postIds.includes(postId) ? m.postIds : [...m.postIds, postId] }
          : m,
      ),
    );
  };

  const removePostFromModule = (moduleIndex: number, postId: Id<"learnhub_posts">) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === moduleIndex ? { ...m, postIds: m.postIds.filter((p) => p !== postId) } : m,
      ),
    );
  };

  const canSubmit = title.trim().length > 0 && modules.every((m) => m.title.trim().length > 0) && uid;

  const handleAddUrl = async (moduleIndex: number) => {
    if (!uid || !composerUrl.trim() || !composerTitle.trim()) {
      setErr("URL and title are required.");
      return;
    }
    setComposerSaving(true);
    setErr(null);
    try {
      const postId = await createMaterial({
        actorId: uid,
        url: composerUrl,
        title: composerTitle,
      });
      addPostToModule(moduleIndex, postId);
      setComposerUrl("");
      setComposerTitle("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setComposerSaving(false);
    }
  };

  const handleSubmit = async (publish: boolean) => {
    if (!uid || !canSubmit) {
      setErr("Title and module titles are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (isEditMode && editPathIdParam) {
        const pathId = editPathIdParam as Id<"learnhub_learning_paths">;
        await updatePath({
          actorId: uid,
          pathId,
          patch: {
            title,
            description,
            programType,
            modules,
            estimatedWeeks,
            visibility,
            coverEmoji,
            coverColor,
          },
        });
        if (publish) {
          try {
            await publishPath({ actorId: uid, pathId });
          } catch (e) {
            // Surface but don't block — the patch already saved.
            setErr(`Saved, but publish failed: ${(e as Error).message}`);
          }
        }
        router.push(`/learnhub/learning-path/${pathId}`);
      } else {
        const pathId = await createPath({
          actorId: uid,
          title,
          description,
          programType,
          modules,
          estimatedWeeks,
          visibility,
          coverEmoji,
          coverColor,
          goalId: goalIdParam ? (goalIdParam as Id<"learnhub_goals">) : undefined,
          publish,
        });
        router.push(`/learnhub/learning-path/${pathId}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!uid) {
    return (
      <div style={{ background: BG, color: TEXT, padding: 32, minHeight: "100vh" }}>
        <p>Sign in to create a learning path.</p>
      </div>
    );
  }

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", padding: "24px 32px" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          {isEditMode ? "Edit learning path" : "Create a learning path"}
        </h1>
        {isEditMode && (
          <p style={{ color: MUTED, marginTop: 4, fontSize: 13 }}>
            Update metadata, reorder modules, or attach more materials. Saved changes apply immediately to enrolled learners.
          </p>
        )}
        {!isEditMode && goalRow && (
          <p style={{ color: MUTED, marginTop: 4, fontSize: 13 }}>
            Building a personal path to achieve: <span style={{ color: TEXT, fontWeight: 600 }}>{goalRow.title}</span>
          </p>
        )}
        {!isEditMode && !goalRow && (
          <p style={{ color: MUTED, marginTop: 4, fontSize: 13 }}>
            Assemble posts into modules. Save as draft to keep iterating, or publish to make it visible.
          </p>
        )}
      </header>

      {/* Metadata */}
      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>
          Path details
        </h2>
        <div style={{ display: "grid", gap: 12 }}>
          <label>
            <span style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Full-Stack Web Foundations"
              style={inputStyle}
            />
          </label>
          <label>
            <span style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What will a learner achieve by the end of this path?"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 8 }}>
            <label>
              <span style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Program</span>
              <select
                value={programType}
                onChange={(e) => {
                  setProgramType(e.target.value);
                  setCoverColor(programColor(e.target.value));
                }}
                style={inputStyle}
              >
                {ORG_CONFIG.programs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Estimated weeks</span>
              <input
                type="number"
                value={estimatedWeeks}
                onChange={(e) => setEstimatedWeeks(Math.max(1, Math.min(52, Number(e.target.value))))}
                min={1}
                max={52}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Cover</span>
              <input
                value={coverEmoji}
                onChange={(e) => setCoverEmoji(e.target.value.slice(0, 4))}
                style={{ ...inputStyle, fontSize: 20, textAlign: "center" }}
              />
            </label>
          </div>
          <div>
            <span style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 6 }}>Visibility</span>
            <div style={{ display: "flex", gap: 8 }}>
              {(["private", "cohort", "public"] as Visibility[]).map((v) => {
                const disabled = isStudent && v !== "private";
                const on = visibility === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => !disabled && setVisibility(v)}
                    disabled={disabled}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 600,
                      background: on ? "rgba(91,108,255,0.18)" : "transparent",
                      border: on ? `1px solid ${INDIGO}` : `1px solid ${BORDER2}`,
                      color: disabled ? MUTED : on ? INDIGO : TEXT,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.4 : 1,
                      textTransform: "capitalize",
                    }}
                  >
                    {v === "public" ? "Public (browse)" : v === "cohort" ? "Cohort" : "Private (just me)"}
                  </button>
                );
              })}
            </div>
            {isStudent && (
              <p style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
                Learners can create private paths for personal goals. Verified mentors can publish public paths to the browse surface.
              </p>
            )}
            {visibility === "public" && !canPublishPublic && (
              <p style={{ fontSize: 11, color: "#fbbf24", marginTop: 6 }}>
                You can save a public path as a draft, but only verified mentors / coordinators can publish it.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>
          Modules
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {modules.map((m, i) => (
            <div key={i} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: MUTED, minWidth: 28 }}>M{m.order}</span>
                <input
                  value={m.title}
                  onChange={(e) => updateModule(i, { title: e.target.value })}
                  placeholder="Module title"
                  style={{ ...inputStyle, flex: 1, fontSize: 14, fontWeight: 600 }}
                />
                <button
                  type="button"
                  onClick={() => moveModule(i, -1)}
                  disabled={i === 0}
                  style={miniBtn}
                  title="Move up"
                >▲</button>
                <button
                  type="button"
                  onClick={() => moveModule(i, 1)}
                  disabled={i === modules.length - 1}
                  style={miniBtn}
                  title="Move down"
                >▼</button>
                <button
                  type="button"
                  onClick={() => removeModule(i)}
                  disabled={modules.length === 1}
                  style={{ ...miniBtn, color: "#fca5a5" }}
                  title="Remove"
                >✕</button>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: MUTED }}>Completion:</span>
                <select
                  value={
                    m.completionRequirements.formPassingScore !== undefined
                      ? "quiz"
                      : m.completionRequirements.watchPercent !== undefined
                      ? "watch"
                      : "none"
                  }
                  onChange={(e) => {
                    if (e.target.value === "none")
                      updateModule(i, { completionRequirements: {} });
                    else if (e.target.value === "quiz")
                      updateModule(i, { completionRequirements: { formPassingScore: 70 } });
                    else if (e.target.value === "watch")
                      updateModule(i, { completionRequirements: { watchPercent: 80 } });
                  }}
                  style={{ ...inputStyle, width: 200 }}
                >
                  <option value="none">No gate (free advance)</option>
                  <option value="watch">Watch % required</option>
                  <option value="quiz">Quiz passing score</option>
                </select>
                {m.completionRequirements.watchPercent !== undefined && (
                  <input
                    type="number"
                    value={m.completionRequirements.watchPercent}
                    onChange={(e) =>
                      updateModule(i, { completionRequirements: { watchPercent: Number(e.target.value) } })
                    }
                    min={0}
                    max={100}
                    style={{ ...inputStyle, width: 70 }}
                  />
                )}
                {m.completionRequirements.formPassingScore !== undefined && (
                  <input
                    type="number"
                    value={m.completionRequirements.formPassingScore}
                    onChange={(e) =>
                      updateModule(i, { completionRequirements: { formPassingScore: Number(e.target.value) } })
                    }
                    min={0}
                    max={100}
                    style={{ ...inputStyle, width: 70 }}
                  />
                )}
              </div>

              {/* Selected posts */}
              {m.postIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {m.postIds.map((pid) => (
                    <span
                      key={pid}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 99,
                        background: "rgba(91,108,255,0.14)",
                        color: INDIGO,
                        fontSize: 11,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      post:{(pid as string).slice(-6)}
                      <button
                        type="button"
                        onClick={() => removePostFromModule(i, pid)}
                        style={{ background: "transparent", border: "none", color: INDIGO, cursor: "pointer", fontSize: 12 }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setPickerForModule(pickerForModule === i ? null : i);
                    setPickerSearch("");
                    setPickerType("");
                  }}
                  style={{ ...miniBtn, padding: "6px 12px", fontSize: 12 }}
                >
                  {pickerForModule === i ? "Close picker" : "+ Add from feed"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUrlComposerForModule(urlComposerForModule === i ? null : i);
                    setComposerUrl("");
                    setComposerTitle("");
                  }}
                  style={{ ...miniBtn, padding: "6px 12px", fontSize: 12, background: "rgba(91,108,255,0.14)", color: "#7c8bff", borderColor: "rgba(91,108,255,0.3)" }}
                >
                  {urlComposerForModule === i ? "Close URL" : "+ Add URL"}
                </button>
              </div>

              {urlComposerForModule === i && (
                <div style={{ marginTop: 10, padding: 12, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: MUTED, margin: "0 0 6px" }}>
                    Paste a YouTube link, Google Drive file, Google Form, or any URL. Type is auto-detected.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                    <input
                      value={composerUrl}
                      onChange={(e) => setComposerUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or https://forms.gle/..."
                      style={inputStyle}
                    />
                    <input
                      value={composerTitle}
                      onChange={(e) => setComposerTitle(e.target.value)}
                      placeholder="Title (shown to learners)"
                      style={inputStyle}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleAddUrl(i)}
                        disabled={composerSaving || !composerUrl.trim() || !composerTitle.trim()}
                        style={{ ...miniBtn, padding: "6px 14px", background: "#5b6cff", color: "#fff", borderColor: "transparent", fontWeight: 600 }}
                      >
                        {composerSaving ? "Adding…" : "Add to module"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {pickerForModule === i && (
                <div style={{ marginTop: 10, padding: 12, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Search by hashtag or content"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <select
                      value={pickerType}
                      onChange={(e) => setPickerType(e.target.value)}
                      style={{ ...inputStyle, width: 130 }}
                    >
                      <option value="">All types</option>
                      {POST_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {pickerPosts === undefined ? (
                      <p style={{ color: MUTED, fontSize: 12 }}>Loading…</p>
                    ) : pickerPosts.length === 0 ? (
                      <p style={{ color: MUTED, fontSize: 12 }}>No posts match.</p>
                    ) : (
                      pickerPosts.map((p) => {
                        const already = m.postIds.includes(p._id);
                        return (
                          <button
                            key={p._id}
                            type="button"
                            onClick={() => addPostToModule(i, p._id)}
                            disabled={already}
                            style={{
                              textAlign: "left",
                              padding: 8,
                              borderRadius: 6,
                              background: already ? "rgba(34,211,160,0.1)" : "transparent",
                              border: `1px solid ${BORDER}`,
                              color: TEXT,
                              cursor: already ? "default" : "pointer",
                              fontSize: 11,
                            }}
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(91,108,255,0.14)", color: INDIGO }}>
                                {p.type}
                              </span>
                              <span style={{ color: TEXT, opacity: 0.9 }}>{p.contentSnippet || "(no content)"}</span>
                              {already && <span style={{ marginLeft: "auto", color: GREEN }}>✓ added</span>}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={addModule} style={{ ...miniBtn, padding: "8px 14px", alignSelf: "flex-start" }}>
            + Add module
          </button>
        </div>
      </section>

      {err && <p style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>{err}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={!canSubmit || saving}
          style={{ padding: "10px 18px", borderRadius: 99, background: "transparent", color: TEXT, border: `1px solid ${BORDER2}`, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          {saving ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={!canSubmit || saving || (visibility === "public" && !canPublishPublic)}
          style={{ padding: "10px 18px", borderRadius: 99, background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`, color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          {saving ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(0,0,0,0.3)",
  border: `1px solid ${BORDER2}`,
  color: TEXT,
  fontSize: 13,
  outline: "none",
};

const miniBtn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${BORDER2}`,
  color: TEXT,
  fontSize: 12,
  cursor: "pointer",
};

export default function CreatePathPage() {
  return (
    <Suspense fallback={null}>
      <PathCreatorInner />
    </Suspense>
  );
}
