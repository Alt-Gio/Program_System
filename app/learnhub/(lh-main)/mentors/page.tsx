"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

// Visual tokens — match the rest of LearnHub
const BG = "#090b18";
const CARD = "#111323";
const CARD2 = "#161929";
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT = "#e8eaf4";
const MUTED = "rgba(185,190,230,0.6)";
const DIM = "rgba(100,110,165,0.5)";
const ORANGE = "#f97316";
const GREEN = "#22c55e";
const SKY = "#38bdf8";
const INDIGO = "#6366f1";

const ACCENT_CYCLE = [GREEN, INDIGO, ORANGE, "#a855f7", SKY, "#ec4899", "#fbbf24"] as const;
function accentFor(i: number) {
  return ACCENT_CYCLE[i % ACCENT_CYCLE.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type Mentor = {
  _id: Id<"learnhub_users">;
  name: string;
  avatarUrl: string;
  bio: string | null;
  designation: string | null;
  regionalOffice: string | null;
  province: string | null;
  expertiseTags: string[];
  interests: string[];
  activeMenteeCount: number;
  maxMentees: number | null;
  hasCapacity: boolean;
};

function MentorsPageInner() {
  const { userId, role } = useLearnhubSession();
  const mentors = useQuery(api.learnhub_mentors.listAvailableMentors, {});
  const [selected, setSelected] = useState<Mentor | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hideFull, setHideFull] = useState(true);

  const allTags = useMemo(() => {
    if (!mentors) return [] as string[];
    const set = new Set<string>();
    for (const m of mentors) {
      for (const t of m.expertiseTags) set.add(t);
      for (const t of m.interests) set.add(t);
    }
    return Array.from(set).sort();
  }, [mentors]);

  const filtered = useMemo(() => {
    if (!mentors) return [] as Mentor[];
    const q = query.trim().toLowerCase();
    return mentors.filter((m) => {
      if (hideFull && !m.hasCapacity) return false;
      if (filterTag) {
        const has = m.expertiseTags.includes(filterTag) || m.interests.includes(filterTag);
        if (!has) return false;
      }
      if (!q) return true;
      const hay = [
        m.name,
        m.designation ?? "",
        m.regionalOffice ?? "",
        m.province ?? "",
        m.bio ?? "",
        ...m.expertiseTags,
        ...m.interests,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [mentors, query, filterTag, hideFull]);

  const canRequest = role === "student" || role === "org_partner";

  return (
    <div className="mx-auto" style={{ maxWidth: 1100, padding: "20px 16px 40px", color: TEXT, background: BG, minHeight: "100vh" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: 1.4 }}>
          MENTOR MARKETPLACE · DICT REGION V
        </div>
        <h1
          style={{
            fontFamily: "var(--font-dm-serif, serif)",
            fontSize: 28,
            margin: "6px 0 2px",
            color: TEXT,
            lineHeight: 1.15,
          }}
        >
          Find a mentor who fits your <em style={{ color: ORANGE }}>journey</em>
        </h1>
        <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
          Browse verified DICT mentors. Pick someone aligned with your interests and send a short intro to start a mentorship.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, designation, expertise…"
          style={{
            flex: "1 1 220px",
            minWidth: 200,
            background: CARD,
            border: `1px solid ${BORDER2}`,
            borderRadius: 10,
            padding: "10px 12px",
            color: TEXT,
            fontSize: 13,
            outline: "none",
          }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: MUTED,
            background: CARD,
            border: `1px solid ${BORDER2}`,
            borderRadius: 10,
            padding: "9px 12px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={hideFull}
            onChange={(e) => setHideFull(e.target.checked)}
            style={{ accentColor: ORANGE }}
          />
          Hide mentors at capacity
        </label>
      </div>

      {allTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          <button
            onClick={() => setFilterTag(null)}
            style={chipStyle(filterTag === null)}
          >
            All expertise
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setFilterTag(t === filterTag ? null : t)} style={chipStyle(t === filterTag)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {mentors === undefined && (
        <div style={{ color: MUTED, fontSize: 13, padding: 20 }}>Loading mentors…</div>
      )}

      {mentors && filtered.length === 0 && (
        <div
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            padding: 28,
            textAlign: "center",
            color: MUTED,
          }}
        >
          <p style={{ margin: "0 0 6px", color: TEXT, fontWeight: 600 }}>No mentors match your filters.</p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Try clearing the expertise filter or showing mentors at capacity.
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {filtered.map((m, i) => (
          <MentorCard
            key={m._id}
            mentor={m}
            accent={accentFor(i)}
            onOpen={() => setSelected(m)}
            disabled={!canRequest}
          />
        ))}
      </div>

      {selected && userId && (
        <RequestModal
          mentor={selected}
          menteeId={userId as Id<"learnhub_users">}
          canRequest={canRequest}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    padding: "6px 10px",
    borderRadius: 999,
    background: active ? "rgba(249,115,22,0.18)" : CARD,
    border: `1px solid ${active ? ORANGE : BORDER2}`,
    color: active ? ORANGE : MUTED,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function MentorCard({
  mentor,
  accent,
  onOpen,
  disabled,
}: {
  mentor: Mentor;
  accent: string;
  onOpen: () => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: disabled ? "default" : "pointer",
        transition: "transform 120ms ease, border-color 120ms ease",
        opacity: mentor.hasCapacity ? 1 : 0.7,
      }}
      onClick={onOpen}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = BORDER;
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: accent, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }} />
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            color: "#0a0d1e",
            flexShrink: 0,
          }}
        >
          {initials(mentor.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, color: TEXT, fontSize: 14, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {mentor.name}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {mentor.designation ?? "DICT Mentor"}
            {mentor.regionalOffice ? ` · ${mentor.regionalOffice}` : ""}
          </p>
        </div>
      </div>

      {mentor.bio && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "rgba(220,225,240,0.85)",
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {mentor.bio}
        </p>
      )}

      {mentor.expertiseTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {mentor.expertiseTags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 10.5,
                color: TEXT,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER2}`,
                padding: "3px 7px",
                borderRadius: 999,
              }}
            >
              {t}
            </span>
          ))}
          {mentor.expertiseTags.length > 4 && (
            <span style={{ fontSize: 10.5, color: DIM, padding: "3px 7px" }}>
              +{mentor.expertiseTags.length - 4} more
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: mentor.hasCapacity ? GREEN : "#ef4444", fontWeight: 600 }}>
          {mentor.maxMentees == null
            ? `${mentor.activeMenteeCount} mentees`
            : mentor.hasCapacity
            ? `${mentor.activeMenteeCount}/${mentor.maxMentees} mentees · open`
            : `Full · ${mentor.maxMentees}/${mentor.maxMentees}`}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          disabled={disabled}
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 999,
            background: disabled ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${ORANGE}, #ef4444)`,
            color: disabled ? DIM : "#fff",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          View profile →
        </button>
      </div>
    </div>
  );
}

function RequestModal({
  mentor,
  menteeId,
  canRequest,
  onClose,
}: {
  mentor: Mentor;
  menteeId: Id<"learnhub_users">;
  canRequest: boolean;
  onClose: () => void;
}) {
  const existing = useQuery(api.learnhub_mentors.getMentorshipRequest, {
    menteeId,
    mentorId: mentor._id,
  });
  const requestMentorship = useMutation(api.learnhub_mentors.requestMentorship);
  const [note, setNote] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const blockingState = existing?.status === "requested" || existing?.status === "active";

  const addGoal = () => {
    const g = goalDraft.trim();
    if (!g) return;
    if (goals.length >= 5) return;
    setGoals((prev) => Array.from(new Set([...prev, g])));
    setGoalDraft("");
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await requestMentorship({
        menteeId,
        mentorId: mentor._id,
        requestNote: note,
        goals,
      });
      setSent(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Strip leading "CODE: " prefix from our thrown errors for cleaner UI.
      setError(msg.replace(/^[A-Z_]+:\s*/, ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,7,15,0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(16px, env(safe-area-inset-bottom)) 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 540,
          background: `linear-gradient(180deg, ${CARD2}, ${CARD})`,
          border: `1px solid ${BORDER2}`,
          borderRadius: 18,
          padding: "clamp(20px, 5vw, 28px)",
          color: TEXT,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${BORDER2}`,
            color: MUTED,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${ORANGE}, #ef4444)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18,
              color: "#0a0d1e",
            }}
          >
            {initials(mentor.name)}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{mentor.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>
              {mentor.designation ?? "DICT Mentor"}
              {mentor.regionalOffice ? ` · ${mentor.regionalOffice}` : ""}
              {mentor.province ? ` · ${mentor.province}` : ""}
            </p>
          </div>
        </div>

        {mentor.bio && (
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(220,225,240,0.85)", lineHeight: 1.5 }}>
            {mentor.bio}
          </p>
        )}

        {mentor.expertiseTags.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 }}>Expertise</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {mentor.expertiseTags.map((t) => (
                <span key={t} style={chipStyle(false)}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {!canRequest && (
          <div
            style={{
              padding: 12,
              background: "rgba(56,189,248,0.08)",
              border: `1px solid rgba(56,189,248,0.3)`,
              borderRadius: 10,
              fontSize: 12.5,
              color: SKY,
              marginBottom: 12,
            }}
          >
            Only students and org partners can request mentorship.
          </div>
        )}

        {existing && blockingState && (
          <div
            style={{
              padding: 12,
              background: existing.status === "active" ? "rgba(34,197,94,0.08)" : "rgba(251,191,36,0.08)",
              border: `1px solid ${existing.status === "active" ? "rgba(34,197,94,0.3)" : "rgba(251,191,36,0.3)"}`,
              borderRadius: 10,
              fontSize: 12.5,
              color: existing.status === "active" ? GREEN : "#fbbf24",
              marginBottom: 12,
            }}
          >
            {existing.status === "active"
              ? `You and ${mentor.name} are already in an active mentorship.`
              : `You have a pending request with ${mentor.name}. They'll respond soon.`}
          </div>
        )}

        {sent && (
          <div
            style={{
              padding: 14,
              background: "rgba(34,197,94,0.1)",
              border: `1px solid rgba(34,197,94,0.35)`,
              borderRadius: 12,
              color: GREEN,
              fontSize: 13.5,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Request sent. {mentor.name} will get back to you soon.
          </div>
        )}

        {canRequest && !blockingState && !sent && (
          <>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ display: "block", fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                Your intro to {mentor.name.split(" ")[0]}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Hi! I'm working on… and I'd love your help with…"
                rows={4}
                maxLength={800}
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${BORDER2}`,
                  borderRadius: 10,
                  padding: 12,
                  color: TEXT,
                  fontSize: 13,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <span style={{ display: "block", fontSize: 10.5, color: DIM, marginTop: 4 }}>
                {note.trim().length}/800 · 10 chars minimum
              </span>
            </label>

            <div style={{ marginBottom: 14 }}>
              <span style={{ display: "block", fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                Goals (up to 5, optional)
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGoal();
                    }
                  }}
                  placeholder="e.g. Ship my first React app"
                  maxLength={120}
                  style={{
                    flex: 1,
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${BORDER2}`,
                    borderRadius: 10,
                    padding: "9px 12px",
                    color: TEXT,
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={addGoal}
                  disabled={!goalDraft.trim() || goals.length >= 5}
                  style={{
                    padding: "9px 14px",
                    background: "rgba(99,102,241,0.18)",
                    border: `1px solid rgba(99,102,241,0.5)`,
                    color: INDIGO,
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Add
                </button>
              </div>
              {goals.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {goals.map((g) => (
                    <span
                      key={g}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11.5,
                        background: "rgba(99,102,241,0.14)",
                        border: `1px solid rgba(99,102,241,0.35)`,
                        color: INDIGO,
                        padding: "4px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {g}
                      <button
                        onClick={() => setGoals((prev) => prev.filter((x) => x !== g))}
                        style={{ background: "transparent", border: "none", color: INDIGO, cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}
                        aria-label={`Remove goal ${g}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  padding: 10,
                  background: "rgba(239,68,68,0.1)",
                  border: `1px solid rgba(239,68,68,0.4)`,
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: "#fca5a5",
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || note.trim().length < 10}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: submitting || note.trim().length < 10 ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${ORANGE}, #ef4444)`,
                color: submitting || note.trim().length < 10 ? DIM : "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting || note.trim().length < 10 ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Sending…" : `Send mentorship request`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function MentorsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: MUTED, fontSize: 13 }}>Loading…</div>
        </div>
      }
    >
      <MentorsPageInner />
    </Suspense>
  );
}
