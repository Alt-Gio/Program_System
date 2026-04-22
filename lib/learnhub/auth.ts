// LearnHub session helpers — uses Web Crypto API (works in Node.js + Edge)
// Cookie name: learnhub_session (HTTP-only, isolated from dict-session)
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)

export interface LearnHubSession {
  sub: string; // Convex learnhub_users._id
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: "student" | "mentor" | "org_partner";
  iat: number;
  exp: number;
}

export interface PendingProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}

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

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payload: object, secret: string): Promise<string> {
  const key = await getKey(secret);
  const data = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return `${data}.${b64url(sig)}`;
}

async function verifyPayload<T>(
  token: string,
  secret: string
): Promise<T | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const data = token.slice(0, dot);
    const sigStr = token.slice(dot + 1);
    const key = await getKey(secret);
    const sig = b64urlDecode(sigStr);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig,
      new TextEncoder().encode(data)
    );
    if (!valid) return null;
    const padded = data.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    return JSON.parse(atob(pad ? padded + "=".repeat(4 - pad) : padded)) as T;
  } catch {
    return null;
  }
}

export async function createSession(
  payload: Omit<LearnHubSession, "iat" | "exp">
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    { ...payload, iat: now, exp: now + 30 * 24 * 60 * 60 },
    process.env.LEARNHUB_SESSION_SECRET!
  );
}

export async function verifySession(
  token: string
): Promise<LearnHubSession | null> {
  const session = await verifyPayload<LearnHubSession>(
    token,
    process.env.LEARNHUB_SESSION_SECRET!
  );
  if (!session) return null;
  if (session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

export async function createPendingProfile(
  profile: PendingProfile
): Promise<string> {
  return signPayload(profile, process.env.LEARNHUB_SESSION_SECRET!);
}

export async function verifyPendingProfile(
  token: string
): Promise<PendingProfile | null> {
  return verifyPayload<PendingProfile>(
    token,
    process.env.LEARNHUB_SESSION_SECRET!
  );
}

export const SESSION_COOKIE = "learnhub_session";
export const PENDING_COOKIE = "learnhub_pending";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
