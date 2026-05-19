"use client";

/**
 * /learnhub/admin/cert-ingest — admin/coordinator-only page to manage
 * the Gmail certificate auto-ingest.
 *
 * Wires three things end-to-end:
 *   1. Trusted sender email — stored in `learnhub_cert_email_config`.
 *   2. Gmail connection — runs the OAuth flow via /api/learnhub/gmail/connect.
 *      The token row gets the `gmail.readonly` scope on top of any
 *      Calendar scopes the admin already has.
 *   3. Manual poll trigger — calls `triggerManualPoll` so an admin can
 *      sanity-check ingestion without waiting for the 15-min cron.
 */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, CheckCircle2, Info, Mail, Play, RefreshCw, ShieldAlert, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const ORANGE = "#f97316";
const GREEN = "#22d3a0";
const SKY = "#38bdf8";
const RED = "#ef4444";

type PollResult =
  | { status: "ok"; scanned?: number; ingested?: number; skipped?: number }
  | { status: "no_config" | "not_connected" | "error"; message?: string };

export default function AdminCertIngestPage() {
  return (
    <Suspense fallback={<div style={{ padding: 28, color: "#9ba3cc" }}>Loading…</div>}>
      <AdminCertIngestInner />
    </Suspense>
  );
}

function AdminCertIngestInner() {
  const { userId, role, loading } = useLearnhubSession();
  const sp = useSearchParams();
  const router = useRouter();
  const uid = userId ? (userId as Id<"learnhub_users">) : null;

  const config = useQuery(api.learnhub_cert_ingest.getConfig, {});
  const setConfig = useMutation(api.learnhub_cert_ingest.setConfig);
  const disableConfig = useMutation(api.learnhub_cert_ingest.disableConfig);
  const trigger = useAction(api.learnhub_cert_ingest_node.triggerManualPoll);

  const [sender, setSender] = useState("");
  const [programType, setProgramType] = useState("");
  const [saving, setSaving] = useState(false);
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Hydrate form fields once the config loads (only on the first arrival;
  // we don't want re-renders to clobber what the admin is typing).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || config === undefined) return;
    if (config) {
      setSender(config.senderEmail);
      setProgramType(config.programType ?? "");
    }
    setHydrated(true);
  }, [config, hydrated]);

  // Surface ?gmail=connected / ?gmail=error returned from the OAuth callback.
  useEffect(() => {
    const g = sp.get("gmail");
    if (!g) return;
    if (g === "connected") setFlash({ tone: "ok", text: "Gmail connected. The poll will pick up new messages within 15 minutes." });
    else setFlash({ tone: "err", text: `Gmail connect failed (${sp.get("reason") ?? "unknown"}).` });
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.delete("gmail"); params.delete("reason"); params.delete("detail");
    router.replace(params.toString() ? `?${params}` : "?", { scroll: false });
  }, [sp, router]);

  if (loading) return <div style={{ padding: 28, color: "#9ba3cc" }}>Loading…</div>;
  if (!uid || (role !== "admin" && role !== "coordinator")) {
    return (
      <div style={{ padding: 28, color: "#e8eaff", maxWidth: 540 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: RED }}>
          <ShieldAlert size={16} /> Admins / coordinators only
        </div>
        <p style={{ margin: "8px 0 0", color: "#9ba3cc", fontSize: 13 }}>
          This page lets a coordinator configure the trusted sender and connect a Gmail mailbox for automatic certificate ingest.
        </p>
        <Link href="/learnhub/feed" style={{ color: SKY, marginTop: 12, display: "inline-block" }}>← Back to feed</Link>
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    try {
      await setConfig({
        actorId: uid,
        senderEmail: sender.trim(),
        programType: programType.trim() || undefined,
      });
      setFlash({ tone: "ok", text: "Saved." });
    } catch (e) {
      setFlash({ tone: "err", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const onDisable = async () => {
    if (!confirm("Disable auto-ingest? The cron will stop scanning until you save a new sender.")) return;
    await disableConfig({ actorId: uid });
    setFlash({ tone: "ok", text: "Auto-ingest disabled." });
  };

  const onPoll = async () => {
    setPolling(true);
    setPollResult(null);
    try {
      const result = await trigger({ actorId: uid });
      setPollResult(result as PollResult);
    } catch (e) {
      setPollResult({ status: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setPolling(false);
    }
  };

  return (
    <div style={{
      padding: "24px 20px", color: "#e8eaff",
      fontFamily: "var(--font-dm-sans, 'Inter', sans-serif)", maxWidth: 720, margin: "0 auto",
    }}>
      <Link href="/learnhub/org" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: "rgba(255,255,255,0.6)", letterSpacing: 1.2, textTransform: "uppercase",
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
        textDecoration: "none",
      }}>
        <ArrowLeft size={14} /> Back to Org Console
      </Link>

      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)" }}>
        Certificate auto-ingest
      </h1>
      <p style={{ margin: "4px 0 14px", fontSize: 13, color: "#9ba3cc", lineHeight: 1.55 }}>
        When the trusted sender emails a learner with an image or PDF attachment, the system creates a certificate record automatically and surfaces the attachment on /learnhub/certificates. Cron runs every 15 minutes; you can also poll manually below.
      </p>

      {flash && (
        <div style={{
          marginBottom: 14, padding: "10px 14px", borderRadius: 10,
          background: flash.tone === "ok" ? `${GREEN}14` : `${RED}14`,
          border: `1px solid ${flash.tone === "ok" ? `${GREEN}55` : `${RED}55`}`,
          color: flash.tone === "ok" ? GREEN : RED, fontSize: 12.5,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {flash.tone === "ok" ? <CheckCircle2 size={14} /> : <X size={14} />}
          {flash.text}
        </div>
      )}

      {/* Config form */}
      <section style={{
        padding: 18, borderRadius: 14,
        background: "rgba(255,255,255,0.02)", border: `1px solid ${ORANGE}30`,
        marginBottom: 16,
      }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 13, color: ORANGE, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800 }}>
          Trusted sender
        </h2>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "#9ba3cc", letterSpacing: 0.4 }}>Sender email</span>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="certificates@dict.gov.ph"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "#9ba3cc", letterSpacing: 0.4 }}>Program type (optional)</span>
          <input
            value={programType}
            onChange={(e) => setProgramType(e.target.value)}
            placeholder="SPARK / DWIA / Tech4ED"
            style={inputStyle}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <button onClick={onSave} disabled={saving || !sender.trim()} style={{
            padding: "9px 16px", borderRadius: 10, border: 0,
            background: `linear-gradient(135deg, ${ORANGE}, #ea580c)`,
            color: "white", fontWeight: 700, fontSize: 12.5, cursor: saving ? "wait" : "pointer",
          }}>{saving ? "Saving…" : config ? "Update sender" : "Save sender"}</button>
          {config && (
            <button onClick={onDisable} style={{
              padding: "9px 14px", borderRadius: 10,
              background: "transparent", border: `1px solid ${RED}55`, color: RED,
              cursor: "pointer", fontSize: 12.5, fontWeight: 700,
            }}>Disable ingest</button>
          )}
        </div>
      </section>

      {/* Gmail connection */}
      <section style={{
        padding: 18, borderRadius: 14,
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(56,189,248,0.25)",
        marginBottom: 16,
      }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 13, color: SKY, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Mail size={13} /> Gmail mailbox
        </h2>
        <p style={{ fontSize: 12.5, color: "#9ba3cc", margin: "0 0 12px", lineHeight: 1.55 }}>
          The poll runs against <strong style={{ color: "#e8eaff" }}>{config?.enabledByName ?? "—"}</strong>{" "}
          <span style={{ color: "#5c6490" }}>({config?.enabledByEmail ?? "no Gmail connected yet"})</span>. Click below to connect (or reconnect) the Gmail account whose inbox should be scanned.
        </p>
        <a href={`/api/learnhub/gmail/connect?returnTo=${encodeURIComponent("/learnhub/admin/cert-ingest")}`} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 16px", borderRadius: 10,
          background: `linear-gradient(135deg, ${SKY}, #0ea5e9)`,
          color: "white", fontWeight: 700, fontSize: 12.5, textDecoration: "none",
        }}>
          <Mail size={13} /> {config?.enabledByEmail ? "Reconnect Gmail" : "Connect Gmail"}
        </a>
      </section>

      {/* Poll runner */}
      <section style={{
        padding: 18, borderRadius: 14,
        background: "rgba(255,255,255,0.02)", border: `1px solid ${GREEN}33`,
        marginBottom: 16,
      }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 13, color: GREEN, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Play size={13} /> Poll now
        </h2>
        <p style={{ fontSize: 12.5, color: "#9ba3cc", margin: "0 0 12px", lineHeight: 1.55 }}>
          Manually trigger a poll to verify the wiring. The cron does this on its own every 15 minutes.
          {config?.lastPolledAt && (
            <> Last polled <strong>{new Date(config.lastPolledAt).toLocaleString()}</strong>.</>
          )}
        </p>
        <button onClick={onPoll} disabled={polling || !config} style={{
          padding: "9px 16px", borderRadius: 10, border: 0,
          background: polling ? "rgba(34,211,160,0.3)" : GREEN,
          color: "#06070f", fontWeight: 700, fontSize: 12.5, cursor: polling ? "wait" : "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <RefreshCw size={13} /> {polling ? "Polling…" : "Run poll now"}
        </button>
        {pollResult && (
          <div style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 10, fontSize: 12,
            background: pollResult.status === "ok" ? `${GREEN}10` : `${RED}10`,
            border: `1px solid ${pollResult.status === "ok" ? `${GREEN}55` : `${RED}55`}`,
            color: pollResult.status === "ok" ? GREEN : RED, lineHeight: 1.5,
          }}>
            {pollResult.status === "ok" && (
              <>scanned {pollResult.scanned ?? 0} · ingested {pollResult.ingested ?? 0} · skipped {pollResult.skipped ?? 0}</>
            )}
            {pollResult.status === "no_config" && "No active config — save a sender first."}
            {pollResult.status === "not_connected" && (pollResult.message ?? "Gmail not connected — click Connect Gmail above.")}
            {pollResult.status === "error" && (pollResult.message ?? "Unknown error.")}
          </div>
        )}
      </section>

      <p style={{
        marginTop: 16, fontSize: 11.5, color: "#5c6490", lineHeight: 1.55,
        display: "inline-flex", alignItems: "flex-start", gap: 6,
      }}>
        <Info size={12} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          Dedup is keyed on Gmail messageId, so re-runs are safe. The poll only scans messages newer than 14 days — older certs need to be re-mailed if they were missed during an outage.
        </span>
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)",
  color: "#fff", fontSize: 13, outline: "none", marginTop: 6,
};
