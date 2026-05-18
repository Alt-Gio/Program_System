"use client";

/**
 * Route-level error boundary for /learnhub/progress.
 * Mirrors /learnhub/org/error.tsx — most-common failure is the Convex
 * "function not found" when the new learnhub_progress module hasn't
 * propagated to the backend yet.
 */

import { useEffect } from "react";

const CYAN = "#00d4ff";
const PINK = "#ec4899";

export default function ProgressError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[LearnHub /progress] route error:", error);
  }, [error]);

  const msg = error?.message ?? "";
  const isMissingFunction =
    msg.includes("Could not find public function") ||
    msg.includes("not found in deployment");

  return (
    <div style={{ color: "#fff", background: "#06060f", minHeight: "100%", padding: 28, fontFamily: "'Inter', sans-serif" }}>
      <div style={{
        margin: "30px auto", maxWidth: 580, padding: 28, borderRadius: 18,
        background: "linear-gradient(180deg, rgba(0,212,255,0.06), rgba(255,255,255,0.02))",
        border: `1px solid ${CYAN}44`,
      }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>🚧</div>
        <h2 style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {isMissingFunction ? "Progress console deployment lagging" : "Progress console hit an error"}
        </h2>
        <p style={{ margin: "8px 0 16px", color: "rgba(255,255,255,0.7)", fontSize: 13.5, lineHeight: 1.55 }}>
          {isMissingFunction ? (
            <>
              The Convex backend doesn&rsquo;t yet have <code style={{ color: CYAN }}>learnhub_progress</code>
              {" "}registered. Re-run <code>npx convex deploy</code> against the same
              backend the app uses (check <code>NEXT_PUBLIC_CONVEX_URL</code> vs your
              deploy script&rsquo;s <code>--url</code>).
            </>
          ) : (
            <>Something went wrong loading this page. Check the browser console for details.</>
          )}
        </p>
        <div style={{
          padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.07)",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: PINK,
          wordBreak: "break-word", marginBottom: 14,
        }}>
          {msg.slice(0, 280) || "(no message)"}
        </div>
        <button type="button" onClick={() => reset()} style={{
          padding: "9px 16px", borderRadius: 10, background: CYAN, color: "#06060f",
          border: 0, fontWeight: 700, fontSize: 13, cursor: "pointer", marginRight: 8,
        }}>Try again</button>
        <a href="/learnhub/feed" style={{
          padding: "9px 16px", borderRadius: 10, background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontWeight: 600,
          textDecoration: "none", display: "inline-block",
        }}>Back to feed →</a>
      </div>
    </div>
  );
}
