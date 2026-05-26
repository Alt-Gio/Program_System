"use client";

/**
 * Route-level error boundary for /learnhub/org and its sub-pages.
 *
 * The most common failure here is "Could not find public function for
 * 'learnhub_org:getOrgSummary'" â€” surfaced when the Convex backend hasn't
 * yet received the new module after a deploy. The previous behaviour was
 * an unhandled Server Error that blanked the page. Now we show a clear
 * "deployment lagging" panel with a Retry button.
 */

import { useEffect } from "react";

const PINK = "#ec4899";
const ORANGE = "#f97316";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[LearnHub /org] route error:", error);
  }, [error]);

  const msg = error?.message ?? "";
  const isMissingFunction =
    msg.includes("Could not find public function") ||
    msg.includes("not found in deployment");

  return (
    <div
      style={{
        color: "#fff",
        background: "var(--lh-bg)",
        minHeight: "100%",
        padding: 28,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          margin: "30px auto",
          maxWidth: 580,
          padding: 28,
          borderRadius: 18,
          background: "linear-gradient(180deg, rgba(249,115,22,0.08), rgba(255,255,255,0.02))",
          border: `1px solid ${ORANGE}44`,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 6 }}>ðŸš§</div>
        <h2 style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {isMissingFunction ? "Org Console deployment lagging" : "Org Console hit an error"}
        </h2>
        <p
          style={{
            margin: "8px 0 16px",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
        >
          {isMissingFunction ? (
            <>
              The Convex backend doesn&rsquo;t yet have <code style={{ color: ORANGE }}>learnhub_org</code>
              {" "}registered. This usually means <code>npx convex deploy</code> hasn&rsquo;t pushed
              the new module to the deployment this app talks to.{" "}
              <strong>Re-run your deploy script</strong> and ensure the{" "}
              <code>--url</code> + <code>--admin-key</code> point at the same Convex
              backend that <code>NEXT_PUBLIC_CONVEX_URL</code> resolves to.
            </>
          ) : (
            <>
              Something went wrong loading this page. The error has been logged to the
              browser console; the most common cause is a transient Convex disconnect.
            </>
          )}
        </p>
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.07)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: PINK,
            wordBreak: "break-word",
            marginBottom: 14,
          }}
        >
          {msg.slice(0, 280) || "(no message)"}
        </div>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "9px 16px",
            borderRadius: 10,
            background: ORANGE,
            color: "var(--lh-bg)",
            border: 0,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            marginRight: 8,
          }}
        >
          Try again
        </button>
        <a
          href="/learnhub/feed"
          style={{
            padding: "9px 16px",
            borderRadius: 10,
            background: "var(--lh-border)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Back to feed â†’
        </a>
      </div>
    </div>
  );
}
