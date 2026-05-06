"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoleMeta } from "./roles";

interface Props {
  role: RoleMeta;
  callbackUrl?: string | null;
}

export function PasswordForm({ role, callbackUrl }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
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
      router.push(callbackUrl || role.landing);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            color: "#fca5a5",
            background: "rgba(244, 63, 94, 0.10)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label className="mono" style={labelStyle}>EMAIL</label>
        <input
          type="email"
          autoComplete="email"
          placeholder="admin@dict.gov.ph"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="mono" style={labelStyle}>PASSWORD</label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            style={{ ...inputStyle, paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
          >
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
          <input
            type="checkbox"
            className="cbx"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ accentColor: "var(--login-accent, #f97316)" }}
          />
          Remember me
        </label>
        <a href="#" style={{ color: "var(--login-accent, #f97316)", textDecoration: "none" }}>
          Forgot password?
        </a>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "12px 18px",
          borderRadius: 10,
          border: "none",
          cursor: loading ? "wait" : "pointer",
          fontWeight: 700,
          fontSize: 14,
          background: "var(--login-accent, #f97316)",
          color: "#0a0d1e",
          opacity: loading ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "opacity 0.15s, transform 0.15s",
        }}
      >
        {loading ? (
          <>
            <span className="spin" style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#0a0d1e", borderRadius: "50%", display: "inline-block" }} />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(244, 63, 94, 0.07)",
          border: "1px solid rgba(244, 63, 94, 0.25)",
          fontSize: 11,
          color: "rgba(252, 165, 165, 0.85)",
          lineHeight: 1.5,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <LockGlyph />
        <span>
          <strong className="mono" style={{ letterSpacing: "0.08em" }}>RESTRICTED</strong> · Unauthorized access attempts are logged and reported to DICT-V Security.
        </span>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  color: "rgba(255,255,255,0.45)",
  letterSpacing: "0.14em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e8eaf4",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M16.7 16.7A10.5 10.5 0 0112 19c-6.5 0-10-7-10-7a18 18 0 014.26-5.11M9.9 5.24A10.5 10.5 0 0112 5c6.5 0 10 7 10 7a18.5 18.5 0 01-2.77 3.72" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
