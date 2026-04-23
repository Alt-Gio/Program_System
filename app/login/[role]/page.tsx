"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";

// ─── Role config ────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  intern: {
    label: "Intern",
    description: "OJT / practicum participants",
    accent: "#6366f1",
    accentBg: "rgba(99,102,241,0.12)",
    accentBorder: "rgba(99,102,241,0.35)",
    icon: "🎓",
    authType: "google",
    landing: "/intern-portal",
  },
  supervisor: {
    label: "Supervisor",
    description: "Manage interns and monitor progress",
    accent: "#10b981",
    accentBg: "rgba(16,185,129,0.12)",
    accentBorder: "rgba(16,185,129,0.35)",
    icon: "👩‍💼",
    authType: "google",
    landing: "/supervisor",
  },
  mentor: {
    label: "Mentor",
    description: "ILCDB LearnHub mentor and knowledge sharer",
    accent: "#f59e0b",
    accentBg: "rgba(245,158,11,0.12)",
    accentBorder: "rgba(245,158,11,0.35)",
    icon: "🌟",
    authType: "google",
    landing: "/learnhub/feed",
    oauthUrl: "/api/learnhub/auth/google",
  },
  student: {
    label: "Student / Participant",
    description: "ILCDB LearnHub learning participant",
    accent: "#3b82f6",
    accentBg: "rgba(59,130,246,0.12)",
    accentBorder: "rgba(59,130,246,0.35)",
    icon: "📚",
    authType: "google",
    landing: "/learnhub/feed",
    oauthUrl: "/api/learnhub/auth/google",
  },
  manager: {
    label: "Manager",
    description: "Activities, projects, and event management",
    accent: "#8b5cf6",
    accentBg: "rgba(139,92,246,0.12)",
    accentBorder: "rgba(139,92,246,0.35)",
    icon: "📋",
    authType: "password",
    landing: "/dashboard",
  },
  admin: {
    label: "Administrator",
    description: "DTC Admin — full system access",
    accent: "#ef4444",
    accentBg: "rgba(239,68,68,0.12)",
    accentBorder: "rgba(239,68,68,0.35)",
    icon: "🛡️",
    authType: "password",
    landing: "/dtc-admin",
  },
} as const;

type Role = keyof typeof ROLE_CONFIG;
const VALID_ROLES: Role[] = ["intern", "supervisor", "mentor", "student", "manager", "admin"];

// ─── Google Icon ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

// ─── Password Login Form (Admin / Manager) ────────────────────────────────

function PasswordLoginForm({ role, config }: { role: Role; config: typeof ROLE_CONFIG[Role] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      router.push((config as any).landing);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          {error}
        </div>
      )}
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@dict.gov.ph"
          disabled={loading}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Password</label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            style={{ width: "100%", padding: "10px 44px 10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
          <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13 }}>
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{ padding: "12px 20px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: (config as any).accent, color: "#fff", opacity: loading ? 0.7 : 1, transition: "opacity 0.15s" }}
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>
      <p style={{ fontSize: 11, textAlign: "center", color: "#475569" }}>
        Invite-only · Contact your administrator for access
      </p>
    </form>
  );
}

// ─── Google Login Button ─────────────────────────────────────────────────

function GoogleLoginButton({ role, config }: { role: Role; config: typeof ROLE_CONFIG[Role] }) {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? (config as any).landing ?? "";

  const oauthUrl = (config as any).oauthUrl
    ? `${(config as any).oauthUrl}?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : `/api/auth/google?role=${role}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button
        onClick={() => { window.location.href = oauthUrl; }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "13px 20px",
          borderRadius: 12,
          border: `1px solid ${(config as any).accentBorder}`,
          background: (config as any).accentBg,
          color: "#e2e8f0",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = (config as any).accentBg; }}
      >
        <GoogleIcon />
        Continue with Google
      </button>
      <p style={{ fontSize: 11, textAlign: "center", color: "#475569", lineHeight: 1.5 }}>
        {role === "intern" || role === "supervisor"
          ? "New? Your account will be created automatically."
          : "For ILCDB program participants only."}
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

function LoginContent({ role }: { role: Role }) {
  const config = ROLE_CONFIG[role];
  const params = useSearchParams();
  const oauthError = params.get("error");

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse 50% 40% at 50% 30%, ${(config as any).accent}18 0%, transparent 70%)` }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 400 }}>
        {/* DICT branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${(config as any).accent}dd, ${(config as any).accent}88)`, fontSize: 24, marginBottom: 16, boxShadow: `0 8px 24px ${(config as any).accent}30` }}>
            {config.icon}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", margin: "0 0 4px" }}>DICT Region V</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Program Management System</p>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(12px)" }}>
          {/* Role pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: (config as any).accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {config.label} Portal
            </span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: "0 0 6px" }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>
            {config.description}
          </p>

          {/* Error banner */}
          {oauthError && (
            <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 16 }}>
              {oauthError === "oauth_failed"
                ? "Google sign-in was cancelled or failed. Please try again."
                : "Something went wrong. Please try again."}
            </div>
          )}

          {/* Auth form */}
          {config.authType === "google" ? (
            <GoogleLoginButton role={role} config={config} />
          ) : (
            <PasswordLoginForm role={role} config={config} />
          )}
        </div>

        {/* Footer nav */}
        <div style={{ marginTop: 24, textAlign: "center", display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {VALID_ROLES.filter((r) => r !== role).map((r) => (
            <a
              key={r}
              href={`/login/${r}`}
              style={{ fontSize: 11, color: "#475569", textDecoration: "none", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", transition: "color 0.1s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#475569"; }}
            >
              {ROLE_CONFIG[r].icon} {ROLE_CONFIG[r].label}
            </a>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 20 }}>
          DICT Region V · Legazpi City, Bicol · {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}

export default function LoginPage({ params }: { params: { role: string } }) {
  const role = params.role as Role;
  if (!VALID_ROLES.includes(role)) notFound();

  return (
    <Suspense>
      <LoginContent role={role} />
    </Suspense>
  );
}
