import { defineTable } from "convex/server";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

// ============================================================
// FACE RECOGNITION ATTENDANCE
// Spread into convex/schema.ts via `...faceRecognitionTables`.
// New table only — does NOT touch existing auth/attendance tables.
//
// Source of truth for face embeddings lives in the Python face
// server's local SQLite DB (on-disk, per-container). Convex stores
// only the attendance EVENTS — who was recognized, when, with what
// confidence — so the web UI has a realtime subscription to them.
// ============================================================

export const faceRecognitionTables = {
  face_attendance: defineTable({
    /** The registered person's ID (opaque string from the face server — usually a user_accounts._id). */
    userId:     v.string(),
    /** Display name snapshotted at recognition time — denormalised for cheap listings. */
    name:       v.string(),
    /** Cosine similarity score 0..1 — higher = better match. */
    confidence: v.number(),
    /** First event of the day is time_in, second is time_out. */
    action:     v.union(v.literal("time_in"), v.literal("time_out")),
    /** Which camera/station recognized the face (e.g. "entrance", "lobby"). */
    cameraId:   v.string(),
    /** ISO-8601 timestamp from the Python server (authoritative clock). */
    timestamp:  v.string(),
    /** YYYY-MM-DD derived from `timestamp` — lets us use an index for date-range queries. */
    date:       v.string(),
  })
    .index("by_date",        ["date"])
    .index("by_user",        ["userId"])
    .index("by_user_date",   ["userId", "date"]),
};

// ------------------------------------------------------------
// MUTATIONS
// ------------------------------------------------------------

/**
 * Shared business rule used by the public `markAttendance` mutation AND
 * the httpAction in convex/http.ts. Kept as a plain async helper so both
 * paths apply the same idempotency guarantees.
 *
 * Rules:
 *  - First event of the day for a user  → insert as "time_in"
 *  - Second event of the day            → insert as "time_out"
 *  - Any further event                  → skipped (already timed out)
 *
 * The incoming `action` from the caller is ADVISORY only; the authoritative
 * action is recomputed here based on what's already in the DB for that user
 * today. This is what makes retries (from the Python sync queue) safe.
 */
async function markAttendanceInternal(
  ctx: MutationCtx,
  args: {
    userId:     string;
    name:       string;
    confidence: number;
    cameraId:   string;
    timestamp:  string;
  },
): Promise<
  | { inserted: true;  action: "time_in" | "time_out"; date: string }
  | { inserted: false; reason: string }
> {
  // Derive YYYY-MM-DD from the provided ISO timestamp. If it's malformed
  // we fall back to server time in UTC — still better than failing loudly.
  const rawDate = args.timestamp.split("T")[0];
  const today   = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : new Date().toISOString().split("T")[0];

  // Read this user's events for the day using the compound index.
  const todays = await ctx.db
    .query("face_attendance")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", today),
    )
    .collect();

  // If the last event is already a time_out, ignore further events today.
  if (todays.some((r) => r.action === "time_out")) {
    return { inserted: false, reason: "already_timed_out_today" };
  }

  const action: "time_in" | "time_out" =
    todays.length === 0 ? "time_in" : "time_out";

  await ctx.db.insert("face_attendance", {
    userId:     args.userId,
    name:       args.name,
    confidence: args.confidence,
    action,
    cameraId:   args.cameraId,
    timestamp:  args.timestamp,
    date:       today,
  });

  return { inserted: true, action, date: today };
}

/**
 * Public mutation — callable from the web app (rare; normally the Python
 * server posts via `POST /face/attendance` httpAction) or from Convex tests.
 */
export const markAttendance = mutation({
  args: {
    userId:     v.string(),
    name:       v.string(),
    confidence: v.number(),
    // Action is accepted for protocol compatibility but is re-derived server-side.
    action:     v.optional(v.string()),
    cameraId:   v.string(),
    timestamp:  v.string(),
  },
  handler: async (ctx, { userId, name, confidence, cameraId, timestamp }) => {
    return markAttendanceInternal(ctx, {
      userId, name, confidence, cameraId, timestamp,
    });
  },
});

/**
 * Internal mutation — called by the `/face/attendance` httpAction in
 * convex/http.ts after it validates the shared-token header.
 */
export const markAttendanceInternalAction = internalMutation({
  args: {
    userId:     v.string(),
    name:       v.string(),
    confidence: v.number(),
    cameraId:   v.string(),
    timestamp:  v.string(),
  },
  handler: async (ctx, args) => markAttendanceInternal(ctx, args),
});

/** A re-scan this long after time-in is treated as the person LEAVING (time_out).
 *  Repeated scans within the window are no-ops, so the kiosk's 30s greet cooldown
 *  can't flip someone from Present to Out. */
const OUT_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Browser-callable "mark present" for the kiosk. Unlike `markAttendance`
 * (every 2nd event of the day becomes time_out), this is idempotent for the
 * common case of being seen repeatedly while present:
 *
 *   - no events today              → insert "time_in"  (Present)
 *   - last is "time_in",  < 4h ago → no write          (still Present)
 *   - last is "time_in",  ≥ 4h ago → insert "time_out" (leaving / Out)
 *   - last is "time_out"           → no write          (already done for today)
 *
 * Safe to call on every recognition; the kiosk additionally throttles to once
 * per person per 30s.
 */
export const markPresence = mutation({
  args: {
    userId:     v.string(),
    name:       v.string(),
    confidence: v.optional(v.number()),
    cameraId:   v.optional(v.string()),
    timestamp:  v.optional(v.string()),
  },
  handler: async (
    ctx,
    { userId, name, confidence, cameraId, timestamp },
  ): Promise<
    | { action: "time_in" | "time_out"; status: "present" | "out" }
    | { action: null; status: "present" | "out"; skipped: string }
  > => {
    const ts      = timestamp ?? new Date().toISOString();
    const rawDate = ts.split("T")[0];
    const today   = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Date().toISOString().split("T")[0];

    const todays = await ctx.db
      .query("face_attendance")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", today),
      )
      .collect();

    const insert = async (action: "time_in" | "time_out") => {
      await ctx.db.insert("face_attendance", {
        userId,
        name,
        confidence: confidence ?? 1,
        action,
        cameraId:   cameraId ?? "kiosk",
        timestamp:  ts,
        date:       today,
      });
    };

    if (todays.length === 0) {
      await insert("time_in");
      return { action: "time_in", status: "present" };
    }

    // Latest event of the day.
    const last = todays.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));

    if (last.action === "time_out") {
      return { action: null, status: "out", skipped: "already_out" };
    }

    // last.action === "time_in"
    const elapsed = Date.now() - Date.parse(last.timestamp);
    if (Number.isFinite(elapsed) && elapsed >= OUT_THRESHOLD_MS) {
      await insert("time_out");
      return { action: "time_out", status: "out" };
    }
    return { action: null, status: "present", skipped: "already_present" };
  },
});

// ------------------------------------------------------------
// QUERIES
// ------------------------------------------------------------

/** Today's attendance — newest first. Used by the overview page. */
export const getTodayAttendance = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    return ctx.db
      .query("face_attendance")
      .withIndex("by_date", (q) => q.eq("date", today))
      .order("desc")
      .collect();
  },
});

/**
 * Attendance between two dates (inclusive), newest first.
 * Uses the `by_date` range scan — efficient for any table size.
 */
export const getAttendanceRange = query({
  args: {
    from: v.string(), // YYYY-MM-DD
    to:   v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, { from, to }) => {
    return ctx.db
      .query("face_attendance")
      .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
      .order("desc")
      .collect();
  },
});

/**
 * Who is currently IN (has a time_in today but no matching time_out yet).
 * Collected once, bucketed in memory — O(N) in today's events, which is
 * always bounded and small.
 */
export const getCurrentlyPresent = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const logs  = await ctx.db
      .query("face_attendance")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    // Map each user to their latest event of the day.
    const latest = new Map<string, {
      action: "time_in" | "time_out";
      name:   string;
      timestamp: string;
      cameraId:  string;
    }>();

    for (const log of logs) {
      const prev = latest.get(log.userId);
      // Keep the chronologically-latest record.
      if (!prev || log.timestamp > prev.timestamp) {
        latest.set(log.userId, {
          action:    log.action,
          name:      log.name,
          timestamp: log.timestamp,
          cameraId:  log.cameraId,
        });
      }
    }

    return Array.from(latest.entries())
      .filter(([, v]) => v.action === "time_in")
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },
});

/** Lookup for a single user's attendance history — used by detail pages. */
export const getUserAttendance = query({
  args: {
    userId: v.string(),
    limit:  v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("face_attendance")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 100);
  },
});
