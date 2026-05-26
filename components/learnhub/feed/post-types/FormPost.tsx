"use client";

import { format, formatDistanceToNow } from "date-fns";

interface FormMetadata {
  formUrl?: string;
  formTitle?: string;
  responseCount?: number;
  closingAt?: number;
}

export function FormPost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as FormMetadata;

  if (!m.formUrl) return null;

  const isClosed = m.closingAt !== undefined && m.closingAt < Date.now();

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--lh-input-bg)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Form icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(91,108,255,0.1)" }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="#5b6cff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="14 2 14 8 20 8"
              stroke="#5b6cff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="8"
              y1="13"
              x2="16"
              y2="13"
              stroke="#5b6cff"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line
              x1="8"
              y1="17"
              x2="13"
              y2="17"
              stroke="#5b6cff"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}
          >
            {m.formTitle ?? "Google Form"}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {m.responseCount !== undefined && (
              <span className="text-xs" style={{ color: "var(--lh-text-2)" }}>
                {m.responseCount} responses
              </span>
            )}
            {m.closingAt && (
              <span
                className="text-xs"
                style={{ color: isClosed ? "#ff5f6d" : "#ff8c42" }}
              >
                {isClosed
                  ? `Closed ${formatDistanceToNow(m.closingAt, { addSuffix: true })}`
                  : `Closes ${format(m.closingAt, "MMM d")}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {isClosed ? (
          <div
            className="w-full rounded-xl py-2.5 text-sm font-medium text-center"
            style={{
              background: "rgba(255,95,109,0.08)",
              color: "#ff5f6d",
              border: "1px solid rgba(255,95,109,0.2)",
              fontFamily: "var(--font-sora)",
            }}
          >
            Form Closed
          </div>
        ) : (
          <a
            href={m.formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
          >
            Fill Out Form →
          </a>
        )}
      </div>
    </div>
  );
}
