"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";

type RegisterableRole = "intern" | "supervisor";
const VALID: RegisterableRole[] = ["intern", "supervisor"];

const ROLE_META: Record<RegisterableRole, { label: string; icon: string; accent: string; landing: string; description: string }> = {
  intern: {
    label: "Intern",
    icon: "🎓",
    accent: "#6366f1",
    landing: "/intern-portal",
    description: "Complete your OJT / practicum registration",
  },
  supervisor: {
    label: "Supervisor",
    icon: "👩‍💼",
    accent: "#10b981",
    landing: "/supervisor",
    description: "Complete your supervisor account setup",
  },
};

function RegisterContent({ role }: { role: RegisterableRole }) {
  const router = useRouter();
  const meta = ROLE_META[role];

  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // We cannot read httpOnly cookies client-side, but if there is no pending cookie
  // the API will reject the request gracefully. Show a nice error in that case.
  useEffect(() => {
    setFullName(""); // Reset on mount
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Please enter your full name."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      router.push(meta.landing);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse 50% 40% at 50% 30%, ${meta.accent}18 0%, transparent 70%)` }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${meta.accent}dd, ${meta.accent}88)`, fontSize: 24, marginBottom: 16, boxShadow: `0 8px 24px ${meta.accent}30` }}>
            {meta.icon}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: "0 0 4px" }}>
            Complete Registration
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{meta.description}</p>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(12px)" }}>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: meta.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {meta.label} · DICT Region V
            </span>
          </div>

          <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px", lineHeight: 1.6 }}>
            Your Google account has been verified. Please confirm your full name to complete registration.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                {error}
                {error.includes("expired") && (
                  <span> <a href={`/login/${role}`} style={{ color: "#93c5fd", textDecoration: "underline" }}>Sign in again</a></span>
                )}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan dela Cruz"
                disabled={loading}
                autoFocus
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                Enter your name as it appears on official documents.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !fullName.trim()}
              style={{ padding: "13px 20px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: meta.accent, color: "#fff", opacity: loading || !fullName.trim() ? 0.6 : 1, transition: "opacity 0.15s" }}
            >
              {loading ? "Creating account…" : `Create ${meta.label} Account`}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 20 }}>
          Already have an account?{" "}
          <a href={`/login/${role}`} style={{ color: meta.accent, textDecoration: "none" }}>
            Sign in here
          </a>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage({ params }: { params: { role: string } }) {
  const role = params.role as RegisterableRole;
  if (!VALID.includes(role)) notFound();

  return (
    <Suspense>
      <RegisterContent role={role} />
    </Suspense>
  );
}
