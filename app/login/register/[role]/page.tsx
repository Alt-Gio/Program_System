"use client";

import { Suspense, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { ROLES, type RoleKey } from "@/components/login/roles";
import { RoleIcon } from "@/components/login/RoleIcon";

type RegisterableRole = "intern" | "supervisor";
const VALID: RegisterableRole[] = ["intern", "supervisor"];

function RegisterContent({ role }: { role: RegisterableRole }) {
  const router = useRouter();
  const meta = ROLES[role as RoleKey];
  const accent = role === "intern" ? "#10b981" : "#0ea5e9";

  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        ["--login-accent" as any]: accent,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background:
          "radial-gradient(ellipse 60% 40% at 50% 30%, " + accent + "22 0%, transparent 70%), #05060f",
      }}
    >
      <div className="fade-up" style={{ width: "100%", maxWidth: 440 }}>
        <div
          style={{
            background: "linear-gradient(180deg, rgba(20, 22, 40, 0.95), rgba(10, 12, 25, 0.95))",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 20,
            padding: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, color: accent }}>
            <RoleIcon icon={meta.icon} size={36} />
            <div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: accent }}>
                {meta.short.toUpperCase()} · REGISTRATION
              </div>
              <h1 className="serif" style={{ fontSize: 24, color: "#e8eaf4", margin: "4px 0 0", lineHeight: 1.15 }}>
                One final step
              </h1>
            </div>
          </div>

          <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", lineHeight: 1.6, margin: "0 0 22px" }}>
            Your Google account has been verified. Please confirm your full name to complete registration.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fca5a5",
                  background: "rgba(244, 63, 94, 0.10)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                }}
              >
                {error}
                {error.includes("expired") && (
                  <>
                    {" "}
                    <a href="/login" style={{ color: "#93c5fd", textDecoration: "underline" }}>
                      Sign in again
                    </a>
                  </>
                )}
              </div>
            )}

            <div>
              <label className="mono" style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.14em", marginBottom: 6 }}>
                FULL NAME
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan dela Cruz"
                disabled={loading}
                autoFocus
                style={{
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
                }}
              />
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                Enter your name as it appears on official documents.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !fullName.trim()}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                cursor: loading ? "wait" : "pointer",
                fontWeight: 700,
                fontSize: 14,
                background: accent,
                color: "#0a0d1e",
                opacity: loading || !fullName.trim() ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {loading ? "Creating account…" : `Create ${meta.short} Account`}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 18 }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: accent, textDecoration: "none" }}>
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
