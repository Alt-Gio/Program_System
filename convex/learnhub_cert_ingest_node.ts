"use node";

/**
 * Node-runtime half of cert-ingest. Convex splits actions that use Node
 * APIs (`node:crypto`, `Blob`) into their own file with this directive.
 *
 * V8-runtime queries/mutations live in `convex/learnhub_cert_ingest.ts`;
 * this file exports only actions that:
 *   • call out to Gmail REST,
 *   • decrypt/encrypt OAuth tokens with AES-GCM,
 *   • upload attachments to Convex _storage.
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { GenericActionCtx } from "convex/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";

type ActionCtx = GenericActionCtx<DataModel>;

// ── Crypto helpers (mirror lib/learnhub/token-crypto) ───────────────────

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function cryptoKey(): Buffer {
  const raw = process.env.LH_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("LH_TOKEN_ENCRYPTION_KEY not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("LH_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

function decryptToken(payload: string): string {
  const [ivB64, bodyB64] = payload.split(".");
  if (!ivB64 || !bodyB64) throw new Error("Malformed encrypted token payload");
  const iv = Buffer.from(ivB64, "base64");
  const body = Buffer.from(bodyB64, "base64");
  if (body.length < TAG_BYTES) throw new Error("Encrypted token payload too short");
  const ciphertext = body.subarray(0, body.length - TAG_BYTES);
  const tag = body.subarray(body.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, cryptoKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function encryptToken(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, cryptoKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${Buffer.concat([ciphertext, tag]).toString("base64")}`;
}

// ── Gmail REST helpers ──────────────────────────────────────────────────

type GmailMessage = {
  id?: string;
  internalDate?: string;
  payload?: GmailPart;
};
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name?: string; value?: string }>;
  body?: { attachmentId?: string; data?: string };
  parts?: GmailPart[];
};

async function gmailFetch<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.LEARNHUB_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.LEARNHUB_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("LEARNHUB_GOOGLE_CLIENT_ID/_SECRET not set");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`refresh ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

function parseEmailList(header: string | null | undefined): string[] {
  if (!header) return [];
  const out: string[] = [];
  for (const part of header.split(",")) {
    const m = part.match(/<\s*([^>\s]+@[^>\s]+)\s*>/);
    const direct = part.trim().match(/^[^\s<>]+@[^\s<>]+$/);
    const addr = (m?.[1] ?? direct?.[0] ?? "").trim().toLowerCase();
    if (addr) out.push(addr);
  }
  return Array.from(new Set(out));
}

function base64UrlToBytes(b64: string): Uint8Array {
  const fixed = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = fixed.length % 4 === 0 ? fixed : fixed + "=".repeat(4 - (fixed.length % 4));
  return Buffer.from(pad, "base64");
}

// ── Poll action ─────────────────────────────────────────────────────────

type IngestSummary = {
  status: "ok" | "no_config" | "not_connected" | "error";
  scanned?: number;
  ingested?: number;
  skipped?: number;
  message?: string;
};

export const pollGmail = internalAction({
  args: {},
  handler: async (ctx): Promise<IngestSummary> => {
    const config = await ctx.runQuery(internal.learnhub_cert_ingest._getActiveConfig, {});
    if (!config) return { status: "no_config" };

    const enablingUser: Doc<"learnhub_users"> | null = await ctx.runQuery(
      api.learnhub_users.getUser,
      { id: config.enabledByUserId },
    );
    if (!enablingUser) return { status: "error", message: "enablingUser_missing" };

    const creds: Doc<"learnhub_google_credentials"> | null = await ctx.runQuery(
      internal.learnhub_cert_ingest._getCreds,
      { userId: config.enabledByUserId },
    );
    if (!creds) return { status: "not_connected" };
    if (!creds.scopes.includes("https://www.googleapis.com/auth/gmail.readonly")) {
      return { status: "not_connected", message: "gmail.readonly scope missing — reconnect via /api/learnhub/gmail/connect" };
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(creds.accessTokenEnc);
    } catch (err) {
      return { status: "error", message: `decrypt_failed: ${err instanceof Error ? err.message : String(err)}` };
    }

    if (creds.expiresAt < Date.now() + 60_000) {
      try {
        const refreshTok = decryptToken(creds.refreshTokenEnc);
        const fresh = await refreshAccessToken(refreshTok);
        accessToken = fresh.access_token;
        await ctx.runMutation(internal.learnhub_cert_ingest._patchCredsAccess, {
          userId: config.enabledByUserId,
          accessTokenEnc: encryptToken(accessToken),
          expiresAt: Date.now() + fresh.expires_in * 1000,
        });
      } catch (err) {
        return { status: "error", message: `refresh: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    const q = encodeURIComponent(`from:${config.senderEmail} has:attachment newer_than:14d`);
    let listResp: { messages?: Array<{ id?: string }>; resultSizeEstimate?: number };
    try {
      listResp = await gmailFetch(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=50`,
      );
    } catch (err) {
      return { status: "error", message: err instanceof Error ? err.message : String(err) };
    }
    const ids = (listResp.messages ?? []).map((m) => m.id).filter((x): x is string => !!x);

    let ingested = 0;
    let skipped = 0;
    for (const id of ids) {
      try {
        const r = await ingestOneMessage(ctx, accessToken, id, config, enablingUser);
        ingested += r.ingested;
        if (r.skipped) skipped += 1;
      } catch (err) {
        console.error("[cert_ingest] message", id, err);
      }
    }

    await ctx.runMutation(internal.learnhub_cert_ingest._patchConfigCursor, {
      configId: config._id,
      lastPolledAt: Date.now(),
      historyId: listResp.resultSizeEstimate?.toString(),
    });

    return { status: "ok", scanned: ids.length, ingested, skipped };
  },
});

async function ingestOneMessage(
  ctx: ActionCtx,
  accessToken: string,
  messageId: string,
  config: Doc<"learnhub_cert_email_config">,
  enablingUser: Doc<"learnhub_users">,
): Promise<{ ingested: number; skipped: boolean; reason?: string }> {
  const existing = await ctx.runQuery(internal.learnhub_cert_ingest._findCertByMessage, {
    messageId,
  });
  if (existing) return { ingested: 0, skipped: true, reason: "duplicate" };

  const msg = await gmailFetch<GmailMessage>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
  );
  if (!msg.payload) return { ingested: 0, skipped: true, reason: "no_payload" };

  const headers = Object.fromEntries(
    (msg.payload.headers ?? []).map((h) => [
      (h.name ?? "").toLowerCase(),
      h.value ?? "",
    ]),
  );
  const subject = headers.subject ?? "Certificate";
  const fromHeader = headers.from ?? config.senderEmail;
  const senderEmail = parseEmailList(fromHeader)[0] ?? config.senderEmail;
  const receivedAt = parseInt(msg.internalDate ?? `${Date.now()}`, 10);

  const recipients = [
    ...parseEmailList(headers.to),
    ...parseEmailList(headers.cc),
    ...parseEmailList(headers.bcc),
  ].filter((e) => e && e !== senderEmail);
  if (recipients.length === 0) {
    return { ingested: 0, skipped: true, reason: "no_recipient" };
  }

  const attachments: GmailPart[] = [];
  function walk(part: GmailPart | undefined) {
    if (!part) return;
    const mime = (part.mimeType ?? "").toLowerCase();
    const hasAttachmentId = !!part.body?.attachmentId;
    const isAttachable = mime.startsWith("image/") || mime === "application/pdf";
    if (isAttachable && hasAttachmentId) attachments.push(part);
    for (const child of part.parts ?? []) walk(child);
  }
  walk(msg.payload);

  if (attachments.length === 0) {
    return { ingested: 0, skipped: true, reason: "no_attachment" };
  }

  let ingestedCount = 0;
  for (const att of attachments) {
    const attId = att.body?.attachmentId;
    if (!attId) continue;
    const data = await gmailFetch<{ data?: string }>(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attId}`,
    );
    if (!data.data) continue;
    const bytes = base64UrlToBytes(data.data);
    const buf = new Uint8Array(bytes.byteLength);
    buf.set(bytes);
    const blob = new Blob([buf.buffer], { type: att.mimeType ?? "application/octet-stream" });
    const storageId = await ctx.storage.store(blob);

    for (const recipient of recipients) {
      await ctx.runMutation(internal.learnhub_cert_ingest._insertIngestedCert, {
        studentEmail: recipient,
        courseTitle: subject.slice(0, 120),
        programType: config.programType ?? "Auto-Ingested",
        issuedBy: enablingUser._id,
        issuedByName: enablingUser.name,
        imageStorageId: storageId,
        originalAttachmentName: att.filename ?? undefined,
        sourceEmail: {
          messageId,
          senderEmail,
          subject: subject.slice(0, 240),
          receivedAt,
        },
      });
      ingestedCount += 1;
    }
  }

  return { ingested: ingestedCount, skipped: false };
}

export const triggerManualPoll = action({
  args: { actorId: v.id("learnhub_users") },
  handler: async (ctx, args): Promise<IngestSummary> => {
    const actor: Doc<"learnhub_users"> | null = await ctx.runQuery(
      api.learnhub_users.getUser,
      { id: args.actorId },
    );
    if (!actor) throw new Error("Actor not found");
    if (actor.role !== "admin" && actor.role !== "coordinator") {
      throw new Error("FORBIDDEN: admin/coordinator-only");
    }
    return await ctx.runAction(internal.learnhub_cert_ingest_node.pollGmail, {});
  },
});
