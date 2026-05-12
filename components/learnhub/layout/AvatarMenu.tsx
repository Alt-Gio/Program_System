"use client";

/**
 * Facebook-style avatar dropdown for the LearnHub TopNav.
 *
 * Click the avatar → opens a panel anchored under the topnav with the user's
 * name + email + role, a few profile shortcuts, and a sign-out action. The
 * sign-out path clears the LearnHub session cookie, signs out of the embedded
 * Firebase client (so RTDB presence / Firestore subscriptions detach), wipes
 * the cached session in `useLearnhubSession`, then redirects to /learnhub/login.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User, Settings, Shield } from "lucide-react";
import { useLearnhubSession, clearLearnhubSessionCache } from "@/lib/learnhub/hooks";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  org_partner: "Org Partner",
  admin: "Admin",
};

export function AvatarMenu() {
  const router = useRouter();
  const { session } = useLearnhubSession();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // 1. Clear server cookies (LearnHub session + pending profile).
      await fetch("/api/learnhub/auth/session", { method: "DELETE" }).catch(() => {});
      // 2. Detach Firebase realtime subscriptions if the SDK loaded.
      try {
        const mod = await import("@/lib/learnhub/firebase/config");
        const { signOut } = await import("firebase/auth");
        await signOut(mod.firebaseAuth);
      } catch {
        /* Firebase optional — ignore if not configured. */
      }
      // 3. Drop the in-memory session cache so the next mount refetches.
      clearLearnhubSessionCache();
    } finally {
      // Hard navigate so every client cache (Convex provider, swr, etc.) resets.
      window.location.href = "/learnhub/login";
    }
  };

  const name = session?.name ?? "Guest";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  const avatarSrc =
    session?.avatarUrl ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=FF6B35&textColor=ffffff`;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        className={`lh-topnav-avatar${open ? " is-open" : ""}`}
        title={session?.name ?? "Account menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
      >
        <img
          src={avatarSrc}
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 288,
            maxWidth: "calc(100vw - 24px)",
            background: "var(--lh-surface-1, #131626)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            padding: 10,
            zIndex: 110,
            fontFamily: "var(--font-dm-sans, system-ui)",
          }}
        >
          {/* Header card */}
          <Link
            href="/learnhub/profile"
            onClick={() => setOpen(false)}
            role="menuitem"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(91,108,255,0.08)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "#1a1d30",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e8eaff",
                fontWeight: 700,
              }}
            >
              <img
                src={avatarSrc}
                alt=""
                width={44}
                height={44}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.parentElement as HTMLElement).textContent = initials;
                }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--lh-text-1, #e8eaff)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--lh-text-3, #9ba3cc)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={session?.email}
              >
                {session?.email ?? ""}
              </div>
              {session?.role && (
                <div
                  style={{
                    marginTop: 4,
                    display: "inline-block",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(91,108,255,0.18)",
                    color: "#a3b3ff",
                    border: "1px solid rgba(91,108,255,0.35)",
                  }}
                >
                  {ROLE_LABEL[session.role] ?? session.role}
                </div>
              )}
            </div>
          </Link>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 4px" }} />

          <MenuLink href="/learnhub/profile" icon={<User size={16} />} label="View profile" onSelect={() => setOpen(false)} />
          <MenuLink href="/learnhub/settings" icon={<Settings size={16} />} label="Settings & privacy" onSelect={() => setOpen(false)} />
          {(session?.role === "mentor" || session?.role === "admin") && (
            <MenuLink href="/learnhub/admin/mentors" icon={<Shield size={16} />} label="Mentor tools" onSelect={() => setOpen(false)} />
          )}

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 4px" }} />

          {!confirming ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming(true)}
              style={menuButtonStyle("#ff8a93")}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          ) : (
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <p style={{ fontSize: 12, color: "#fca5a5", margin: 0 }}>
                Sign out of LearnHub on this device?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={signingOut}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--lh-text-2, #c2c8e2)",
                    fontSize: 12,
                    cursor: signingOut ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "#ef4444",
                    border: "1px solid #ef4444",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: signingOut ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {signingOut ? (
                    <>
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          height: 12,
                          border: "2px solid rgba(255,255,255,0.4)",
                          borderTopColor: "#fff",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                          display: "inline-block",
                        }}
                      />
                      Signing out…
                    </>
                  ) : (
                    "Sign out"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onSelect,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 10,
        color: "var(--lh-text-2, #c2c8e2)",
        fontSize: 13,
        textDecoration: "none",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      <span style={{ color: "var(--lh-text-3, #9ba3cc)", display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function menuButtonStyle(color: string): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 10,
    background: "transparent",
    border: 0,
    color,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
  };
}
