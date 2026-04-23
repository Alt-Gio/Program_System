/**
 * DICT Google OAuth — pending profile cookie helpers.
 *
 * After Google OAuth for intern/supervisor, if no existing account is found
 * we store the Google profile in a short-lived signed cookie so the
 * registration page can complete the signup without re-doing OAuth.
 *
 * Uses the same HMAC-SHA256 signing strategy as lib/learnhub/auth.ts.
 */

export interface DictPendingProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
  intendedRole: "intern" | "supervisor";
}

export const DICT_PENDING_COOKIE = "dict_pending_google";
export const DICT_PENDING_MAX_AGE = 10 * 60; // 10 minutes

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const withPad = pad ? padded + "=".repeat(4 - pad) : padded;
  return Uint8Array.from(atob(withPad), (c) => c.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.DICT_OAUTH_SECRET ?? process.env.LEARNHUB_SESSION_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createDictPendingCookie(profile: DictPendingProfile): Promise<string> {
  const key = await getKey();
  const data = b64url(new TextEncoder().encode(JSON.stringify(profile)).buffer as ArrayBuffer);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifyDictPendingCookie(token: string): Promise<DictPendingProfile | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const data = token.slice(0, dot);
    const sigStr = token.slice(dot + 1);
    const key = await getKey();
    const sig = b64urlDecode(sigStr);
    const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    const decoded = b64urlDecode(data);
    return JSON.parse(new TextDecoder().decode(decoded)) as DictPendingProfile;
  } catch {
    return null;
  }
}
