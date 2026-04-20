/**
 * Server-side DICT session helpers.
 *
 * All DICT auth (admin, manager, supervisor, intern) flows through one
 * Convex-backed session cookie named `dict-session`. This module is the
 * single place that reads it — API routes and server components call
 * getSession() / requireRole().
 */
import { cookies } from "next/headers";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const SESSION_COOKIE = "dict-session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type Role = "intern" | "supervisor" | "manager" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  googleEmail?: string;
};

/** Read the session token from the cookie jar. Null if absent. */
export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/** Resolve the current user, or null if no valid session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const user = await fetchQuery(api.auth.getCurrentUser, { token });
  if (!user) return null;
  return {
    id: user.id as unknown as string,
    email: user.email,
    fullName: user.fullName,
    role: user.role as Role,
    googleEmail: user.googleEmail,
  };
}

/** Throw if the current user isn't one of the allowed roles. */
export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("Not authenticated");
    (err as any).status = 401;
    throw err;
  }
  if (!allowed.includes(user.role)) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }
  return user;
}

/** Convenience helper: is this user allowed to access the intern portal? */
export function canAccessInternPortal(role: Role): boolean {
  return role === "intern" || role === "supervisor";
}

/** Convenience helper: is this user allowed to access admin sections? */
export function canAccessAdminArea(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Cookie options shared between signin/signout routes. */
export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
