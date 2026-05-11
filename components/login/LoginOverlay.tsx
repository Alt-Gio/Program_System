"use client";

import { useEffect } from "react";
import type { RoleMeta } from "./roles";
import { RoleIcon } from "./RoleIcon";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { PasswordForm } from "./PasswordForm";

interface Props {
  role: RoleMeta;
  callbackUrl?: string | null;
  oauthError?: string | null;
  oauthErrorDetail?: string | null;
  onClose: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied:    "Google sign-in was cancelled or denied. Please try again.",
  oauth_failed:    "Google sign-in was cancelled or failed. Please try again.",
  config_missing:  "The server is missing OAuth configuration. Please contact support.",
  token_exchange:  "We couldn't complete the Google handshake. Try signing in again.",
  profile_fetch:   "Google didn't return a usable profile. Please try again.",
  convex_query:    "We couldn't reach the database to verify your account. Please retry.",
  session_create:  "Sign-in succeeded but we couldn't create your session. Please retry.",
  server_error:    "Something went wrong on our side. Please try again.",
};

export function LoginOverlay({ role, callbackUrl, oauthError, oauthErrorDetail, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(5, 6, 15, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="fade-up"
        style={{
          width: "100%",
          maxWidth: 440,
          background: "linear-gradient(180deg, rgba(20, 22, 40, 0.95), rgba(10, 12, 25, 0.95))",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 20,
          padding: 32,
          position: "relative",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
          ["--login-accent" as any]: roleAccent(role),
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, color: roleAccent(role) }}>
          <RoleIcon icon={role.icon} size={36} />
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: roleAccent(role) }}>
              {role.short.toUpperCase()} · SIGN IN
            </div>
            <h2 className="serif" style={{ fontSize: 26, color: "#e8eaf4", margin: "4px 0 0", lineHeight: 1.1 }}>
              Welcome back
            </h2>
          </div>
        </div>

        {oauthError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 12,
              color: "#fca5a5",
              background: "rgba(244, 63, 94, 0.10)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span>{ERROR_MESSAGES[oauthError] ?? "Something went wrong. Please try again."}</span>
            {oauthErrorDetail && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  color: "rgba(252, 165, 165, 0.7)",
                  wordBreak: "break-word",
                }}
              >
                {oauthError}: {oauthErrorDetail}
              </span>
            )}
          </div>
        )}

        {role.authType === "google" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.6 }}>
              {role.description}
            </p>
            <GoogleAuthButton role={role} callbackUrl={callbackUrl} solid />
            <p className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center", letterSpacing: "0.1em" }}>
              RESTRICTED TO @DICT.GOV.PH AND APPROVED EDU DOMAINS
            </p>
          </div>
        ) : (
          <PasswordForm role={role} callbackUrl={callbackUrl} />
        )}

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          <span>Need help?</span>
          <span style={{ display: "flex", gap: 14 }}>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Support</a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
          </span>
        </div>
      </div>
    </div>
  );
}

// Translate oklch role hue to an rgba-ish string usable as CSS accent.
// We use the role's `soft` + a hard-coded hex fallback derived from the hue.
function roleAccent(role: RoleMeta): string {
  switch (role.key) {
    case "student": return "#f97316";
    case "mentor":  return "#6b8dff";
    case "intern":  return "#10b981";
    case "supervisor": return "#0ea5e9";
    case "admin":   return "#f43f5e";
    case "manager": return "#3b82f6";
  }
}
