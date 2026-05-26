"use client";

interface CertMetadata {
  certTitle?: string;
  programType?: string;
  issuedByName?: string;
  verificationId?: string;
}

export function CertificatePost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as CertMetadata;

  const shareToLinkedIn = () => {
    const certUrl = `${window.location.origin}/learnhub/verify/${m.verificationId}`;
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl)}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(91,108,255,0.08) 0%, rgba(34,211,160,0.06) 100%)",
        border: "1px solid rgba(91,108,255,0.3)",
      }}
    >
      {/* Celebration header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(91,108,255,0.15)" }}
      >
        <span className="text-lg">🎓</span>
        <span
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: "#7c8bff", fontFamily: "var(--font-sora)" }}
        >
          Certificate Earned
        </span>
        <span className="text-lg">✨</span>
      </div>

      <div className="px-4 py-4">
        {/* Cert card visual */}
        <div
          className="rounded-xl p-4 mb-3 flex flex-col items-center text-center"
          style={{
            background: "rgba(13,15,26,0.6)",
            border: "1px solid rgba(91,108,255,0.2)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
            style={{ background: "rgba(91,108,255,0.15)" }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" stroke="#5b6cff" strokeWidth="1.8" />
              <path
                d="M8 12l3 3 5-5"
                stroke="#22d3a0"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p
            className="text-sm font-bold"
            style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}
          >
            {m.certTitle ?? "ILCDB Certificate"}
          </p>

          {m.programType && (
            <span
              className="mt-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(91,108,255,0.15)",
                color: "#7c8bff",
              }}
            >
              {m.programType}
            </span>
          )}

          {m.issuedByName && (
            <p className="text-xs mt-2" style={{ color: "var(--lh-text-2)" }}>
              Issued by{" "}
              <span style={{ color: "var(--lh-text)" }}>{m.issuedByName}</span>
            </p>
          )}

          {m.verificationId && (
            <p
              className="text-[10px] mt-1 font-mono"
              style={{ color: "var(--lh-text-3)" }}
            >
              {m.verificationId}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {m.verificationId && (
            <a
              href={`/learnhub/verify/${m.verificationId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-all"
              style={{
                background: "rgba(91,108,255,0.1)",
                color: "#7c8bff",
                border: "1px solid rgba(91,108,255,0.25)",
                fontFamily: "var(--font-sora)",
              }}
            >
              Verify
            </a>
          )}
          <button
            onClick={shareToLinkedIn}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-all"
            style={{
              background: "#0077b5",
              color: "#fff",
              fontFamily: "var(--font-sora)",
            }}
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Share on LinkedIn
          </button>
        </div>
      </div>
    </div>
  );
}
