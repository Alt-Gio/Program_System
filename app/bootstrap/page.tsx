"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function BootstrapPage() {
  const bootstrapAdmin = useMutation(api.auth.bootstrapFirstAdmin);

  const [form, setForm] = useState({
    email: "admin@dict.gov.ph",
    password: "Admin12345!",
    fullName: "DICT Admin",
  });
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setLoading(true);
    try {
      await bootstrapAdmin({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
      });
      setResult({ ok: true, msg: `Admin account created for ${form.email}. You can now sign in at /signin.` });
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message ?? "Unknown error" });
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#1e293b", borderRadius: 16, padding: 32, color: "#f1f5f9" }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🔑 Bootstrap Admin</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 24 }}>
          One-time setup — only works when <code>users</code> table is empty.
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>Password (min 8 chars)</label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={8}
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 14, fontFamily: "monospace", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 8, padding: "12px 0", borderRadius: 10, background: loading ? "#334155" : "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Creating…" : "Create Admin Account"}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 18, padding: "12px 16px", borderRadius: 10, background: result.ok ? "#052e16" : "#450a0a", border: `1px solid ${result.ok ? "#16a34a" : "#dc2626"}`, fontSize: 13, color: result.ok ? "#86efac" : "#fca5a5" }}>
            {result.msg}
            {result.ok && (
              <div style={{ marginTop: 10 }}>
                <a href="/signin" style={{ color: "#60a5fa", fontWeight: 600 }}>→ Go to Sign In</a>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: "#475569", borderTop: "1px solid #1e293b", paddingTop: 16 }}>
          ⚠️ Delete or protect this page after creating the admin account.
        </div>
      </div>
    </div>
  );
}
