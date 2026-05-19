"use client";

/**
 * Mentor self-service profile editor. Closes the loop on the
 * self-onboarding → verification → marketplace-discovery pipeline:
 *   • A mentor can update what learners see (bio, designation, expertise,
 *     capacity, availability).
 *   • An unverified mentor can submit a verification doc URL here without
 *     needing an admin to send an invite.
 *
 * Reuses INTEREST_CATEGORIES for the expertise picker so the vocabulary
 * stays aligned with how learners discover mentors via interest match.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import {
  INTEREST_CATEGORIES,
  normalizeInterest,
} from "@/lib/learnhub/interests";
import { ORG_CONFIG } from "@/lib/learnhub/org-config";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_EXPERTISE = 8;

export default function MentorProfilePage() {
  const { userId, role, loading } = useLearnhubSession();
  const uid = userId ? (userId as Id<"learnhub_users">) : null;
  const me = useQuery(api.learnhub_users.getUser, uid ? { id: uid } : "skip");
  const updateProfile = useMutation(api.learnhub_users.updateProfile);
  const submitVerification = useMutation(api.learnhub_mentors.submitVerification);

  const [bio, setBio] = useState("");
  const [designation, setDesignation] = useState("");
  const [availability, setAvailability] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [maxMentees, setMaxMentees] = useState<number>(5);
  const [docUrl, setDocUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [submittingDoc, setSubmittingDoc] = useState(false);
  const [docSubmittedAt, setDocSubmittedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!me || hydrated) return;
    setBio(me.bio ?? "");
    setDesignation(me.designation ?? "");
    setAvailability(me.availability ?? "");
    setExpertise(me.expertiseTags ?? []);
    setMaxMentees(me.maxMentees ?? 5);
    setHydrated(true);
  }, [me, hydrated]);

  const verifiedChip = useMemo(() => {
    const s = me?.mentorStatus ?? null;
    if (s === "verified")
      return { label: "Verified", bg: "rgba(34,197,94,0.14)", fg: "#22c55e" };
    if (s === "pending_verification")
      return { label: "Pending review", bg: "rgba(251,191,36,0.14)", fg: "#fbbf24" };
    if (s === "rejected")
      return { label: "Verification rejected", bg: "rgba(239,68,68,0.14)", fg: "#fca5a5" };
    if (s === "suspended")
      return { label: "Suspended", bg: "rgba(239,68,68,0.14)", fg: "#fca5a5" };
    return { label: "Awaiting submission", bg: "rgba(56,189,248,0.14)", fg: "#38bdf8" };
  }, [me?.mentorStatus]);

  const toggleTag = (tag: string) => {
    setExpertise((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_EXPERTISE) return prev;
      return [...prev, tag];
    });
  };

  const addCustom = () => {
    const raw = customDraft.trim();
    if (!raw || raw.length > 48) return;
    const norm = normalizeInterest(raw);
    if (!norm) return;
    if (expertise.some((t) => normalizeInterest(t) === norm)) {
      setCustomDraft("");
      return;
    }
    if (expertise.length >= MAX_EXPERTISE) return;
    setExpertise((prev) => [...prev, raw]);
    setCustomDraft("");
  };

  const handleSave = async () => {
    if (!uid) return;
    setError(null);
    setSaving(true);
    try {
      await updateProfile({
        id: uid,
        bio: bio.trim(),
        designation: designation.trim(),
        availability: availability.trim(),
        expertiseTags: expertise,
        maxMentees: Math.max(1, Math.min(20, Math.round(maxMentees))),
      });
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDoc = async () => {
    if (!uid) return;
    const url = docUrl.trim();
    if (!url) return;
    setError(null);
    setSubmittingDoc(true);
    try {
      await submitVerification({
        mentorId: uid,
        verificationDocUrl: url,
        designation: designation.trim() || undefined,
      });
      setDocSubmittedAt(Date.now());
      setDocUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmittingDoc(false);
    }
  };

  if (loading || me === undefined) {
    return (
      <div className="px-4 py-10" style={{ color: "#9ba3cc" }}>
        Loading…
      </div>
    );
  }

  if (!uid || role !== "mentor") {
    return (
      <div className="px-4 py-10 max-w-xl mx-auto text-center" style={{ color: "#e8eaff" }}>
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-lg font-bold">Mentor profile editor</p>
        <p className="text-sm mt-2" style={{ color: "#9ba3cc" }}>
          You need to be signed in as a mentor to access this page.
        </p>
        <Link href="/learnhub/mentors" className="text-sm font-semibold mt-3 inline-block" style={{ color: "#7c8bff" }}>
          ← Browse mentors
        </Link>
      </div>
    );
  }

  const isVerified = me?.mentorStatus === "verified";

  return (
    <div
      className="px-4 py-6 max-w-2xl mx-auto"
      style={{ color: "#e8eaff", fontFamily: "var(--font-dm-sans, 'Inter', sans-serif)" }}
    >
      <div className="mb-5">
        <p
          className="text-xs font-medium tracking-widest uppercase"
          style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}
        >
          Mentor profile
        </p>
        <h1
          className="text-2xl font-bold mt-1"
          style={{ color: "#e8eaff", fontFamily: "var(--font-sora)", letterSpacing: "-0.02em" }}
        >
          What learners see about you
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-bold"
            style={{ background: verifiedChip.bg, color: verifiedChip.fg }}
          >
            {verifiedChip.label}
          </span>
          {isVerified && (
            <span className="text-xs" style={{ color: "#9ba3cc" }}>
              You're discoverable on /learnhub/mentors.
            </span>
          )}
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs mb-4"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      <Section title="Identity">
        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="One paragraph on what you help with, your background, and how you like to mentor."
            rows={4}
            maxLength={800}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e8eaff",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          <p className="text-[10px] mt-1" style={{ color: "#5c6490" }}>
            {bio.length}/800
          </p>
        </Field>
        <Field label="Designation">
          <input
            type="text"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Senior Nurse, Carpentry Foreman, Project Manager"
            maxLength={120}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}
          />
        </Field>
        <Field label="Availability">
          <input
            type="text"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="e.g. Weekday evenings, async only, Saturdays 9–11am"
            maxLength={120}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}
          />
        </Field>
      </Section>

      <Section title="Expertise">
        <p className="text-xs mb-3" style={{ color: "#9ba3cc" }}>
          Pick up to {MAX_EXPERTISE} tags across any field. Learners with overlapping interests will see you on the marketplace.
        </p>
        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
          {Object.entries(INTEREST_CATEGORIES).map(([cat, tags]) => (
            <div key={cat}>
              <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#5c6490" }}>
                {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = expertise.includes(tag);
                  const atCap = !active && expertise.length >= MAX_EXPERTISE;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      disabled={atCap}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
                      style={{
                        background: active ? "rgba(91,108,255,0.18)" : "rgba(255,255,255,0.04)",
                        border: active ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.08)",
                        color: active ? "#7c8bff" : "#e8eaff",
                        cursor: atCap ? "not-allowed" : "pointer",
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add a custom expertise (e.g. Veterinary Medicine)"
            maxLength={48}
            className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customDraft.trim() || expertise.length >= MAX_EXPERTISE}
            className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40"
            style={{
              background: "rgba(91,108,255,0.18)",
              border: "1px solid rgba(91,108,255,0.5)",
              color: "#7c8bff",
            }}
          >
            Add
          </button>
        </div>
      </Section>

      <Section title="Capacity">
        <Field label={`Max mentees (1–20) — ${maxMentees}`}>
          <input
            type="range"
            min={1}
            max={20}
            value={maxMentees}
            onChange={(e) => setMaxMentees(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "#5b6cff" }}
          />
          <p className="text-[11px] mt-1" style={{ color: "#9ba3cc" }}>
            Currently engaged: {me?.currentMenteeCount ?? 0}. New requests are blocked when this cap is hit.
          </p>
        </Field>
      </Section>

      {!isVerified && (
        <Section title="Verification">
          <p className="text-xs mb-3" style={{ color: "#9ba3cc" }}>
            Attach a link to a document (resume, professional license, training certificate)
            so {ORG_CONFIG.orgName} {ORG_CONFIG.mentorAuthorityLabel} can verify your background.
            You'll get a notification when the review completes.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://drive.google.com/… or any public link"
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }}
            />
            <button
              type="button"
              onClick={handleSubmitDoc}
              disabled={submittingDoc || !docUrl.trim()}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #5b6cff, #6366f1)",
                color: "#fff",
                border: "none",
              }}
            >
              {submittingDoc ? "Submitting…" : "Submit for review"}
            </button>
          </div>
          {docSubmittedAt && (
            <p className="text-xs mt-2" style={{ color: "#22c55e" }}>
              ✓ Submitted. {ORG_CONFIG.mentorAuthorityLabel.charAt(0).toUpperCase() + ORG_CONFIG.mentorAuthorityLabel.slice(1)} will review shortly.
            </p>
          )}
        </Section>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #f97316, #ef4444)",
            color: "#fff",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedAt && <span className="text-xs" style={{ color: "#22c55e" }}>✓ Saved</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="mb-5 p-4 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h2
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: "#7c8bff", fontFamily: "var(--font-sora)" }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1.5" style={{ color: "#9ba3cc" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
