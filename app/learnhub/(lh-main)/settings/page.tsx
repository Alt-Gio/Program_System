"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

type ConvexUserId = Parameters<ReturnType<typeof useMutation<typeof api.learnhub_users.updateNotifPrefs>>>[0]["userId"];
type EmailDigest = "daily" | "weekly" | "never";

export default function SettingsPage() {
  const { userId } = useLearnhubSession();
  const sp = useSearchParams();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailDigest, setEmailDigest] = useState<EmailDigest>("weekly");
  const [quietFrom, setQuietFrom] = useState("");
  const [quietTo, setQuietTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [calToast, setCalToast] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const updatePrefs = useMutation(api.learnhub_users.updateNotifPrefs);

  const calCreds = useQuery(
    api.learnhub_google_credentials.getForUser,
    userId ? { userId: userId as Id<"learnhub_users"> } : "skip"
  );

  // Toast on round-trip from /api/learnhub/calendar/connect/callback
  useEffect(() => {
    const status = sp.get("calendar");
    if (status === "connected") setCalToast("Google Calendar connected ✓");
    else if (status === "error") setCalToast(`Connect failed: ${sp.get("reason") ?? "unknown"}`);
    if (status) {
      const t = setTimeout(() => setCalToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [sp]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/learnhub/calendar/disconnect", { method: "POST" });
      setCalToast("Google Calendar disconnected");
      setTimeout(() => setCalToast(null), 4000);
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    setPushSupported("Notification" in window && "serviceWorker" in navigator);
  }, []);

  const requestPushPermission = async () => {
    if (!pushSupported) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setPushEnabled(true);
      fetch("/api/learnhub/auth/firebase-token", { method: "POST" }).catch(() => {});
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await updatePrefs({
        userId: userId as ConvexUserId,
        pushEnabled,
        emailDigest,
        quietHoursFrom: quietFrom || undefined,
        quietHoursTo: quietTo || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-sm font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{title}</p>
      {children}
    </div>
  );

  const Toggle = ({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm" style={{ color: "#e8eaff" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>{sub}</p>}
      </div>
      <button onClick={() => onChange(!checked)} className="w-11 h-6 rounded-full relative transition-colors shrink-0" style={{ background: checked ? "#5b6cff" : "rgba(255,255,255,0.12)" }}>
        <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full" style={{ background: "#fff", left: checked ? "calc(100% - 1.375rem)" : "0.125rem" }} />
      </button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>Manage your LearnHub preferences</p>
      </div>

      {calToast && (
        <div
          className="rounded-xl px-4 py-2 mb-4 text-sm"
          style={{
            background: calToast.startsWith("Connect failed") ? "rgba(255,95,109,0.1)" : "rgba(34,211,160,0.1)",
            color: calToast.startsWith("Connect failed") ? "#ff5f6d" : "#22d3a0",
            border: `1px solid ${calToast.startsWith("Connect failed") ? "rgba(255,95,109,0.3)" : "rgba(34,211,160,0.3)"}`,
          }}
        >
          {calToast}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Section title="Integrations">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm" style={{ color: "#e8eaff" }}>Google Calendar &amp; Meet</p>
              <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>
                {calCreds === undefined
                  ? "Loading…"
                  : calCreds === null
                  ? "Connect to auto-generate Meet links and see your real calendar."
                  : `Connected · ${calCreds.scopes.filter((s) => s.includes("calendar")).length} calendar scopes`}
              </p>
            </div>
            {calCreds === null ? (
              <a
                href="/api/learnhub/calendar/connect"
                className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
                style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}
              >
                Connect
              </a>
            ) : calCreds ? (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0 disabled:opacity-50"
                style={{ background: "rgba(255,95,109,0.1)", color: "#ff5f6d", border: "1px solid rgba(255,95,109,0.3)" }}
              >
                {disconnecting ? "…" : "Disconnect"}
              </button>
            ) : null}
          </div>
        </Section>

        <Section title="Push Notifications">
          <Toggle checked={pushEnabled} onChange={(v) => { if (v) requestPushPermission(); else setPushEnabled(false); }} label="Enable push notifications" sub="Receive alerts for new posts, mentions, and opportunities" />
          {!pushSupported && <p className="text-xs" style={{ color: "#ff8c42" }}>Push notifications are not supported in your browser.</p>}
        </Section>

        <Section title="Email Digest">
          <p className="text-sm" style={{ color: "#9ba3cc" }}>How often would you like a summary email?</p>
          <div className="flex gap-2 flex-wrap">
            {(["daily", "weekly", "never"] as EmailDigest[]).map((opt) => (
              <button key={opt} onClick={() => setEmailDigest(opt)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize" style={{ background: emailDigest === opt ? "rgba(91,108,255,0.15)" : "rgba(255,255,255,0.04)", color: emailDigest === opt ? "#7c8bff" : "#9ba3cc", border: emailDigest === opt ? "1px solid rgba(91,108,255,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                {opt}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Quiet Hours">
          <p className="text-xs" style={{ color: "#9ba3cc" }}>No push notifications will be sent during this window.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "#5c6490" }}>From</label>
              <input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }} />
            </div>
            <span className="text-sm" style={{ color: "#5c6490", marginTop: 16 }}>→</span>
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "#5c6490" }}>To</label>
              <input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaff" }} />
            </div>
          </div>
        </Section>

        <button onClick={handleSave} disabled={saving || !userId} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40" style={{ background: saved ? "#22d3a0" : "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
