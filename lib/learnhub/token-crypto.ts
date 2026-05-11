// AES-256-GCM encryption for OAuth tokens stored in Convex.
//
// Format of the encrypted payload:
//   base64(iv) "." base64(ciphertext || authTag)
//
// The key is read from LH_TOKEN_ENCRYPTION_KEY (32 raw bytes, base64-encoded).
// Generate one with:  openssl rand -base64 32
//
// We intentionally use node:crypto rather than Web Crypto so this can run
// in Next.js Node-runtime routes without a polyfill. Convex actions never
// need to decrypt — only the Next.js routes that build the Calendar client do.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.LH_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "LH_TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.local."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `LH_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`
    );
  }
  return key;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${Buffer.concat([ciphertext, tag]).toString("base64")}`;
}

export function decryptToken(payload: string): string {
  const [ivB64, bodyB64] = payload.split(".");
  if (!ivB64 || !bodyB64) throw new Error("Malformed encrypted token payload");
  const iv = Buffer.from(ivB64, "base64");
  const body = Buffer.from(bodyB64, "base64");
  if (body.length < TAG_BYTES) throw new Error("Encrypted token payload too short");
  const ciphertext = body.subarray(0, body.length - TAG_BYTES);
  const tag = body.subarray(body.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
