"use client";

import { format } from "date-fns";

interface OpportunityMetadata {
  title?: string;
  workType?: "remote" | "hybrid" | "onsite";
  payType?: "volunteer" | "stipend" | "paid";
  payAmount?: string;
  slots?: number;
  deadline?: number;
  duration?: string;
  requiredCerts?: string[];
}

const WORK_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  remote: { label: "Remote", color: "#22d3a0" },
  hybrid: { label: "Hybrid", color: "#ff8c42" },
  onsite: { label: "On-site", color: "#5b6cff" },
};

const PAY_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  volunteer: { label: "Volunteer", color: "var(--lh-text-2)" },
  stipend: { label: "Stipend", color: "#ff8c42" },
  paid: { label: "Paid", color: "#22d3a0" },
};

export function OpportunityPost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as OpportunityMetadata;

  const workType = m.workType ? WORK_TYPE_LABEL[m.workType] : null;
  const payType = m.payType ? PAY_TYPE_LABEL[m.payType] : null;
  const isExpired = m.deadline !== undefined && m.deadline < Date.now();

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--lh-input-bg)",
        border: "1px solid rgba(255,140,66,0.25)",
      }}
    >
      {/* Top bar */}
      <div
        className="px-4 py-2 flex items-center gap-2"
        style={{ background: "rgba(255,140,66,0.06)", borderBottom: "1px solid rgba(255,140,66,0.12)" }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
          <rect x="2" y="7" width="20" height="14" rx="2" stroke="#ff8c42" strokeWidth="1.8" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#ff8c42" strokeWidth="1.8" />
        </svg>
        <span
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: "#ff8c42", fontFamily: "var(--font-sora)" }}
        >
          Work Opportunity
        </span>
      </div>

      <div className="px-4 py-3">
        {/* Title */}
        <p
          className="text-base font-bold"
          style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}
        >
          {m.title ?? "Work Opportunity"}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-2">
          {workType && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: workType.color + "15",
                color: workType.color,
                border: `1px solid ${workType.color}30`,
              }}
            >
              {workType.label}
            </span>
          )}
          {payType && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: payType.color + "15",
                color: payType.color,
                border: `1px solid ${payType.color}30`,
              }}
            >
              {payType.label}
              {m.payAmount && ` · ${m.payAmount}`}
            </span>
          )}
          {m.duration && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "var(--lh-text-2)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {m.duration}
            </span>
          )}
          {m.slots !== undefined && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "var(--lh-text-2)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {m.slots} slot{m.slots !== 1 ? "s" : ""} open
            </span>
          )}
        </div>

        {/* Required certs */}
        {m.requiredCerts && m.requiredCerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs" style={{ color: "var(--lh-text-3)" }}>
              Requires:
            </span>
            {m.requiredCerts.map((cert) => (
              <span
                key={cert}
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(91,108,255,0.1)",
                  color: "#7c8bff",
                }}
              >
                {cert}
              </span>
            ))}
          </div>
        )}

        {/* Deadline */}
        {m.deadline && (
          <p className="text-xs mt-2" style={{ color: isExpired ? "#ff5f6d" : "var(--lh-text-2)" }}>
            {isExpired
              ? "Application closed"
              : `Apply by ${format(m.deadline, "MMM d, yyyy")}`}
          </p>
        )}
      </div>

      {/* CTA */}
      <div
        className="px-4 pb-4"
      >
        <button
          disabled={isExpired}
          className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-40"
          style={{
            background: isExpired ? "rgba(255,255,255,0.04)" : "#ff8c42",
            color: isExpired ? "var(--lh-text-2)" : "#fff",
            fontFamily: "var(--font-sora)",
            cursor: isExpired ? "not-allowed" : "pointer",
          }}
        >
          {isExpired ? "Applications Closed" : "Apply Now →"}
        </button>
      </div>
    </div>
  );
}
