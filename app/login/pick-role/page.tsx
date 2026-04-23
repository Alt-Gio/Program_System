"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const ROLE_META: Record<string, { label: string; icon: string; accent: string; portal: string; href: string }> = {
  intern:     { label: "Intern",             icon: "🎓", accent: "#6366f1", portal: "DICT Intern Portal",   href: "/intern-portal" },
  supervisor: { label: "Supervisor",         icon: "👩‍💼", accent: "#10b981", portal: "DICT Supervisor",      href: "/supervisor" },
  manager:    { label: "Manager",            icon: "📋", accent: "#8b5cf6", portal: "DICT Admin Area",       href: "/dashboard" },
  admin:      { label: "Administrator",      icon: "🛡️", accent: "#ef4444", portal: "DTC Admin",             href: "/dtc-admin" },
  student:    { label: "Student",            icon: "📚", accent: "#3b82f6", portal: "ILCDB LearnHub",        href: "/learnhub/feed" },
  mentor:     { label: "Mentor",             icon: "🌟", accent: "#f59e0b", portal: "ILCDB LearnHub Mentor", href: "/learnhub/feed" },
  org_partner: { label: "Org Partner",       icon: "🤝", accent: "#06b6d4", portal: "ILCDB LearnHub",        href: "/learnhub/feed" },
};

function PickRoleContent() {
  const params = useSearchParams();
  const dictRole = params.get("dictRole");
  const lhRole = params.get("lhRole");
  const wantsDictRole = params.get("wantsDictRole");
  const googleName = params.get("googleName");
  const googleEmail = params.get("googleEmail");

  const roles: { key: string; meta: typeof ROLE_META[string] }[] = [];
  if (dictRole && ROLE_META[dictRole]) roles.push({ key: dictRole, meta: ROLE_META[dictRole] });
  if (lhRole && ROLE_META[lhRole]) roles.push({ key: lhRole, meta: ROLE_META[lhRole] });
  if (wantsDictRole && ROLE_META[wantsDictRole] && !roles.find((r) => r.key === wantsDictRole)) {
    roles.push({ key: wantsDictRole, meta: ROLE_META[wantsDictRole] });
  }

  const isNewAccount = !!wantsDictRole && !dictRole;

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 40% at 50% 30%, rgba(99,102,241,0.15) 0%, transparent 70%)" }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", fontSize: 24, marginBottom: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.3)" }}>
            🔀
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>
            {isNewAccount ? "Add Another Role" : "Choose your Portal"}
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            {googleName ? `Welcome, ${googleName}` : "Your Google account is linked to multiple portals"}
          </p>
          {googleEmail && <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0" }}>{googleEmail}</p>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {roles.map(({ key, meta }) => {
            const isLearnHub = key === "mentor" || key === "student" || key === "org_partner";
            const isNewDictRole = key === wantsDictRole && isNewAccount;

            return (
              <a
                key={key}
                href={isNewDictRole ? `/login/register/${key}` : meta.href}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 16, border: `1px solid ${meta.accent}40`, background: `${meta.accent}0d`, textDecoration: "none", transition: "all 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${meta.accent}1a`; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${meta.accent}0d`; (e.currentTarget as HTMLElement).style.transform = "none"; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${meta.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {meta.portal}
                    {isLearnHub && " · ILCDB"}
                    {isNewDictRole && " · Click to complete registration"}
                  </div>
                </div>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ color: meta.accent }}>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </a>
            );
          })}
        </div>

        {roles.length === 0 && (
          <div style={{ textAlign: "center", color: "#64748b", padding: 32, fontSize: 14 }}>
            No active roles found.{" "}
            <a href="/login/intern" style={{ color: "#6366f1", textDecoration: "none" }}>Return to login</a>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 28 }}>
          Your sessions are isolated per portal · DICT Region V
        </p>
      </div>
    </main>
  );
}

export default function PickRolePage() {
  return (
    <Suspense>
      <PickRoleContent />
    </Suspense>
  );
}
