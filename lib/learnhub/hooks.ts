"use client";

import { useState, useEffect } from "react";
import type { Id } from "@/convex/_generated/dataModel";

interface LearnhubSession {
  sub: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: "student" | "mentor" | "org_partner" | "admin";
}

interface UseLearnhubSessionResult {
  session: LearnhubSession | null;
  userId: Id<"learnhub_users"> | null;
  role: LearnhubSession["role"] | null;
  loading: boolean;
  isMentor: boolean;
  isAdmin: boolean;
}

let cachedSession: LearnhubSession | null = null;
let cachePromise: Promise<LearnhubSession | null> | null = null;

// Called by the sign-out flow so the next mount/fetch sees the cleared state
// instead of replaying the stale in-memory copy.
export function clearLearnhubSessionCache() {
  cachedSession = null;
  cachePromise = null;
}

async function fetchSession(): Promise<LearnhubSession | null> {
  if (cachedSession) return cachedSession;
  if (cachePromise) return cachePromise;
  cachePromise = fetch("/api/learnhub/auth/session")
    .then((r) => r.json())
    .then((data) => {
      if (data.type === "session") {
        cachedSession = data.session as LearnhubSession;
        return cachedSession;
      }
      return null;
    })
    .catch(() => null);
  return cachePromise;
}

export function useLearnhubSession(): UseLearnhubSessionResult {
  const [session, setSession] = useState<LearnhubSession | null>(cachedSession);
  const [loading, setLoading] = useState(!cachedSession);

  useEffect(() => {
    if (cachedSession) { setSession(cachedSession); setLoading(false); return; }
    fetchSession().then((s) => { setSession(s); setLoading(false); });
  }, []);

  return {
    session,
    userId: session ? (session.sub as Id<"learnhub_users">) : null,
    role: session?.role ?? null,
    loading,
    isMentor: session?.role === "mentor" || session?.role === "admin",
    isAdmin: session?.role === "admin",
  };
}
