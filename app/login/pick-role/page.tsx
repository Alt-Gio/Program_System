"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ROLES, type RoleKey } from "@/components/login/roles";
import { RoleIcon } from "@/components/login/RoleIcon";

const ACCENT_BY_ROLE: Record<string, string> = {
  student: "#f97316",
  mentor: "#6b8dff",
  intern: "#10b981",
  supervisor: "#0ea5e9",
  manager: "#3b82f6",
  admin: "#f43f5e",
  org_partner: "#06b6d4",
};

const PORTAL_BY_ROLE: Record<string, string> = {
  student: "ILCDB LearnHub",
  mentor: "ILCDB LearnHub Mentor",
  intern: "DICT Intern Portal",
  supervisor: "DICT Supervisor",
  manager: "DICT Admin Area",
  admin: "DTC Admin",
  org_partner: "ILCDB LearnHub",
};

function PickRoleContent() {
  const params = useSearchParams();
  const dictRole = params.get("dictRole");
  const lhRole = params.get("lhRole");
  const wantsDictRole = params.get("wantsDictRole");
  const googleName = params.get("googleName");
  const googleEmail = params.get("googleEmail");

  const entries: { key: string; meta: typeof ROLES[RoleKey] | null; href: string; accent: string; portal: string; isNewDictRole: boolean }[] = [];

  function push(key: string | null, isNewDictRole = false) {
    if (!key) return;
    const meta = (ROLES as Record<string, typeof ROLES[RoleKey] | undefined>)[key] ?? null;
    const href = isNewDictRole
      ? `/login/register/${key}`
      : meta?.landing ?? "/login";
    entries.push({
      key,
      meta,
      href,
      accent: ACCENT_BY_ROLE[key] ?? "#6366f1",
      portal: PORTAL_BY_ROLE[key] ?? key,
      isNewDictRole,
    });
  }

  push(dictRole);
  push(lhRole);
  if (wantsDictRole && !entries.find((e) => e.key === wantsDictRole)) {
    push(wantsDictRole, !dictRole);
  }

  return (
    <main
      style={{
        ["--login-accent" as any]: "#6366f1",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background:
          "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(99, 102, 241, 0.18) 0%, transparent 70%), #05060f",
      }}
    >
      <div className="fade-up" style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.22em", color: "#a5b4fc", marginBottom: 6 }}>
            MULTI-PORTAL ACCOUNT
          </div>
          <h1 className="serif" style={{ fontSize: 32, color: "#e8eaf4", margin: "0 0 6px", lineHeight: 1.1 }}>
            Choose your <em style={{ color: "#a5b4fc" }}>portal</em>
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.55)", margin: 0 }}>
            {googleName ? `Welcome, ${googleName}` : "Your Google account is linked to multiple portals"}
          </p>
          {googleEmail && (
            <p className="mono" style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.3)", margin: "4px 0 0", letterSpacing: "0.06em" }}>
              {googleEmail}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map(({ key, meta, href, accent, portal, isNewDictRole }) => (
            <a
              key={key}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 18px",
                borderRadius: 14,
                border: `1px solid ${accent}44`,
                background: `${accent}0d`,
                textDecoration: "none",
                color: "#e8eaf4",
                transition: "background 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${accent}1f`;
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${accent}0d`;
                (e.currentTarget as HTMLElement).style.transform = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${accent}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accent,
                  flexShrink: 0,
                }}
              >
                {meta ? <RoleIcon icon={meta.icon} size={24} /> : null}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{meta?.short ?? key}</div>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "rgba(255, 255, 255, 0.45)", marginTop: 2 }}>
                  {portal.toUpperCase()}
                  {isNewDictRole && " · CLICK TO COMPLETE REGISTRATION"}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: accent }} aria-hidden="true">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </a>
          ))}
        </div>

        {entries.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.5)", padding: 32, fontSize: 13 }}>
            No active roles found.{" "}
            <a href="/login" style={{ color: "#a5b4fc", textDecoration: "none" }}>
              Return to sign-in
            </a>
          </div>
        )}

        <p className="mono" style={{ textAlign: "center", fontSize: 10, color: "rgba(255, 255, 255, 0.3)", marginTop: 24, letterSpacing: "0.14em" }}>
          SESSIONS ARE ISOLATED PER PORTAL · DICT REGION V
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
