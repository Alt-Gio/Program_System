"use client";
import { Suspense } from "react";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

const CERT_TYPES = ["Tech4ED", "SPARK", "DWIA", "Project CLICK"] as const;

type WorkType = "remote" | "hybrid" | "onsite";
type PayType = "volunteer" | "stipend" | "paid";
type EligibilityMode = "open" | "guided" | "strict";

function splitTokens(value: string) {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function PostOpportunityPageInner() {
  const router = useRouter();
  const { userId, role, loading: sessionLoading } = useLearnhubSession();
  const user = useQuery(api.learnhub_users.getUser, userId ? { id: userId as Id<"learnhub_users"> } : "skip");
  const createOpportunity = useMutation(api.learnhub_work.createOpportunity);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workType, setWorkType] = useState<WorkType>("remote");
  const [payType, setPayType] = useState<PayType>("paid");
  const [payAmount, setPayAmount] = useState("");
  const [slots, setSlots] = useState(1);
  const [duration, setDuration] = useState("");
  const [deadline, setDeadline] = useState("");
  const [requiredCertTypes, setRequiredCertTypes] = useState<string[]>([]);
  const [minXp, setMinXp] = useState(0);
  const [requiredSkills, setRequiredSkills] = useState("");
  const [preferredSkills, setPreferredSkills] = useState("");
  const [eligibilityMode, setEligibilityMode] = useState<EligibilityMode>("guided");
  const [reviewInstructions, setReviewInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (sessionLoading || (userId && user === undefined)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: "#131626" }} />
      </div>
    );
  }

  const canPost = role === "org_partner" || role === "admin" || (user?.role === "mentor" && user.mentorStatus === "verified");
  if (!canPost) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Verified creators only</h1>
        <p className="text-sm mt-2 mb-4" style={{ color: "#9ba3cc" }}>
          Posting opportunities is restricted to admins, verified mentors, and org partner accounts.
        </p>
        <Link href="/learnhub/work" className="text-sm font-semibold" style={{ color: "#7c8bff" }}>
          ← Back to Opportunities
        </Link>
      </div>
    );
  }

  const toggleCert = (cert: string) => {
    setRequiredCertTypes((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (!title.trim()) return setError("Title is required.");
    if (!description.trim()) return setError("Description is required.");
    if (!duration.trim()) return setError("Duration is required.");
    if (!deadline) return setError("Deadline is required.");
    const deadlineMs = new Date(deadline).getTime();
    if (Number.isNaN(deadlineMs)) return setError("Deadline is invalid.");
    if (deadlineMs < Date.now()) return setError("Deadline must be in the future.");
    if (slots < 1) return setError("Slots must be at least 1.");
    if (minXp < 0) return setError("Minimum XP cannot be negative.");
    if (!userId) return setError("Session expired. Please reload.");

    const requiredSkillList = splitTokens(requiredSkills);
    const preferredSkillList = splitTokens(preferredSkills);

    setSubmitting(true);
    try {
      await createOpportunity({
        actorId: userId as Id<"learnhub_users">,
        title: title.trim(),
        description: description.trim(),
        requiredCertTypes,
        workType,
        payType,
        payAmount: payAmount.trim() || undefined,
        slots,
        deadline: deadlineMs,
        duration: duration.trim(),
        minXp: minXp || undefined,
        requiredSkills: requiredSkillList.length ? requiredSkillList : undefined,
        preferredSkills: preferredSkillList.length ? preferredSkillList : undefined,
        eligibilityMode,
        reviewInstructions: reviewInstructions.trim() || undefined,
      });
      router.push("/learnhub/work/manage");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 lh-work-page">
      <Link href="/learnhub/work" className="text-xs font-semibold mb-3 inline-block" style={{ color: "#7c8bff" }}>
        ← Back to Opportunities
      </Link>

      <h1 className="text-xl font-bold mt-2 mb-1" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
        Post an Opportunity
      </h1>
      <p className="text-sm mb-6" style={{ color: "#9ba3cc" }}>
        Create a matched work pathway with clear requirements, review rules, and eligibility scoring.
      </p>

      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "#131626", border: "1px solid rgba(91,108,255,0.2)" }}>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Remote IT Support Specialist" style={inputStyle} />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What will the student be doing? Who's the team? What's the impact?"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Work type">
            <select value={workType} onChange={(e) => setWorkType(e.target.value as WorkType)} style={inputStyle}>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </Field>

          <Field label="Pay type">
            <select value={payType} onChange={(e) => setPayType(e.target.value as PayType)} style={inputStyle}>
              <option value="paid">Paid</option>
              <option value="stipend">Stipend</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </Field>
        </div>

        {payType !== "volunteer" && (
          <Field label="Pay amount (optional)">
            <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="₱18,000/mo" style={inputStyle} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Slots">
            <input type="number" min={1} value={slots} onChange={(e) => setSlots(Math.max(1, Number(e.target.value)))} style={inputStyle} />
          </Field>

          <Field label="Duration">
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="6 months" style={inputStyle} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Application deadline">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Minimum XP">
            <input type="number" min={0} value={minXp} onChange={(e) => setMinXp(Math.max(0, Number(e.target.value)))} style={inputStyle} />
          </Field>
        </div>

        <Field label="Eligibility mode">
          <select value={eligibilityMode} onChange={(e) => setEligibilityMode(e.target.value as EligibilityMode)} style={inputStyle}>
            <option value="open">Open — accept all applications</option>
            <option value="guided">Guided — allow borderline reasoning</option>
            <option value="strict">Strict — block weak matches unless referred</option>
          </select>
        </Field>

        <Field label="Required expertise tags (comma separated)">
          <input value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="IT support, troubleshooting, data entry" style={inputStyle} />
        </Field>

        <Field label="Preferred expertise tags (comma separated)">
          <input value={preferredSkills} onChange={(e) => setPreferredSkills(e.target.value)} placeholder="Canva, facilitation, records management" style={inputStyle} />
        </Field>

        <Field label="Required certificates (optional)">
          <div className="flex flex-wrap gap-2">
            {CERT_TYPES.map((cert) => {
              const active = requiredCertTypes.includes(cert);
              return (
                <button
                  key={cert}
                  type="button"
                  onClick={() => toggleCert(cert)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{
                    background: active ? "rgba(91,108,255,0.18)" : "transparent",
                    border: active ? "1px solid #5b6cff" : "1px solid rgba(255,255,255,0.1)",
                    color: active ? "#7c8bff" : "#e8eaff",
                  }}
                >
                  {cert}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Reviewer instructions (optional)">
          <textarea value={reviewInstructions} onChange={(e) => setReviewInstructions(e.target.value)} rows={3} placeholder="What should reviewers look for in borderline applications?" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>

        {error && <p className="text-sm" style={{ color: "#ff5f6d" }}>{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <Link href="/learnhub/work" className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ color: "#9ba3cc" }}>
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
            style={{ background: "#ff8c42", color: "#fff", fontFamily: "var(--font-sora)" }}
          >
            {submitting ? "Posting…" : "Post Opportunity →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "#9ba3cc" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d0f1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#e8eaff",
  fontSize: 13,
  outline: "none",
};

export default function PostOpportunityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <PostOpportunityPageInner />
    </Suspense>
  )
}