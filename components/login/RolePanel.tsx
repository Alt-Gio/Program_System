"use client";

import type { RoleMeta } from "./roles";
import { RoleIcon } from "./RoleIcon";

interface Props {
  role: RoleMeta;
  side: "left" | "right";
  onSelect: () => void;
  classified?: boolean;
}

// Single half of a carousel slide. The whole panel is clickable;
// inner CTA button forwards clicks to the same handler for affordance.
export function RolePanel({ role, side, onSelect, classified }: Props) {
  const accent = accentHex(role);

  return (
    <div
      className="role-panel fade-up"
      data-side={side}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 64px",
        position: "relative",
        cursor: "pointer",
        background: `radial-gradient(ellipse 70% 60% at ${side === "left" ? "30%" : "70%"} 50%, ${role.soft} 0%, transparent 65%)`,
        transition: "flex-grow 0.4s ease, opacity 0.3s ease",
      }}
    >
      {/* Icon */}
      <div
        style={{
          color: accent,
          opacity: 0.9,
          marginBottom: 24,
          filter: `drop-shadow(0 0 12px ${accent}40)`,
        }}
      >
        <RoleIcon icon={role.icon} size={44} />
      </div>

      {/* Role pill */}
      <div
        className="mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 999,
          background: classified ? "rgba(244, 63, 94, 0.12)" : "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${classified ? "rgba(244, 63, 94, 0.4)" : "rgba(255,255,255,0.1)"}`,
          fontSize: 10,
          letterSpacing: "0.18em",
          color: accent,
          marginBottom: 22,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: accent,
            animation: "pulseDot 2s ease-in-out infinite",
          }}
        />
        {role.label}
      </div>

      {/* Headline */}
      <h2
        className="serif"
        style={{
          fontSize: "clamp(42px, 5vw, 64px)",
          fontWeight: 400,
          color: "#f4f5fa",
          lineHeight: 1.05,
          textAlign: "center",
          margin: 0,
        }}
      >
        {role.headline}
        <br />
        <span style={{ color: accent, fontStyle: "italic" }}>{role.headlineAccent}</span>
      </h2>

      {/* Description */}
      <p
        style={{
          fontSize: 14,
          color: "rgba(255, 255, 255, 0.55)",
          maxWidth: 340,
          textAlign: "center",
          margin: "20px 0 28px",
          lineHeight: 1.55,
        }}
      >
        {role.description}
      </p>

      {/* CTA */}
      <button
        type="button"
        className="role-cta"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 22px",
          borderRadius: 999,
          background:
            role.authType === "google" && !classified
              ? "rgba(255,255,255,0.04)"
              : "rgba(10, 12, 25, 0.6)",
          border: `1px solid ${classified ? "rgba(244, 63, 94, 0.3)" : "rgba(255,255,255,0.12)"}`,
          color: "#e8eaf4",
          fontSize: 13,
          fontWeight: 600,
          transition: "all 0.15s ease",
        }}
      >
        {role.authType === "google" ? (
          <>Continue with Google</>
        ) : (
          <>Sign in securely</>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Credential type footnote */}
      <span
        className="mono"
        style={{
          marginTop: 18,
          fontSize: 10,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        © {role.authType === "google" ? "Google OAuth 2.0" : "Encrypted Credentials"}
      </span>
    </div>
  );
}

function accentHex(role: RoleMeta): string {
  switch (role.key) {
    case "student": return "#f97316";
    case "mentor":  return "#6b8dff";
    case "intern":  return "#10b981";
    case "supervisor": return "#0ea5e9";
    case "admin":   return "#f43f5e";
    case "manager": return "#3b82f6";
  }
}
