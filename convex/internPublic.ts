import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─── Public Intern Logbook API ─────────────────────────────────────────────
// No authentication required – these are kiosk-style public endpoints.
// ──────────────────────────────────────────────────────────────────────────

/** All active interns + today's attendance snapshot (public) */
export const getActiveInterns = query({
  args: {},
  handler: async (ctx) => {
    const interns = await ctx.db
      .query("interns")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();

    const today = new Date().toISOString().slice(0, 10);

    return Promise.all(
      interns
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map(async (intern) => {
          const att = await ctx.db
            .query("internAttendance")
            .withIndex("by_intern_date", (q) =>
              q.eq("internId", intern._id).eq("date", today)
            )
            .first();

          return {
            id:            intern._id,
            fullName:      intern.fullName,
            school:        intern.school,
            course:        intern.course,
            department:    intern.department    ?? null,
            photoUrl:      intern.photoUrl      ?? null,
            totalHours:    intern.totalHours,
            requiredHours: intern.requiredHours,
            today: att
              ? {
                  id:         att._id,
                  timeIn:     att.timeIn      ?? null,
                  timeOut:    att.timeOut     ?? null,
                  hours:      att.hours       ?? null,
                  lunchStart: att.lunchStart  ?? null,
                  lunchEnd:   att.lunchEnd    ?? null,
                }
              : null,
          };
        })
    );
  },
});

function nowTimeStr() {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const pad   = (n: number) => String(n).padStart(2, "0");
  return `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
}

/** Start lunch break for an intern */
export const startLunch = mutation({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    const intern = await ctx.db.get(args.internId);
    if (!intern) throw new Error("Intern not found");

    const today = new Date().toISOString().slice(0, 10);
    const att   = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern_date", (q) =>
        q.eq("internId", args.internId).eq("date", today)
      )
      .first();

    if (!att || !att.timeIn || att.timeOut)
      throw new Error("No active session to take lunch from");
    if (att.lunchStart && !att.lunchEnd)
      throw new Error(`${intern.fullName} is already on lunch`);

    const ts = nowTimeStr();
    await ctx.db.patch(att._id, { lunchStart: ts, lunchEnd: undefined });
    return { lunchStart: ts, internName: intern.fullName };
  },
});

/** End lunch break and resume the work session */
export const endLunch = mutation({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    const intern = await ctx.db.get(args.internId);
    if (!intern) throw new Error("Intern not found");

    const today = new Date().toISOString().slice(0, 10);
    const att   = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern_date", (q) =>
        q.eq("internId", args.internId).eq("date", today)
      )
      .first();

    if (!att || !att.lunchStart || att.lunchEnd)
      throw new Error(`${intern.fullName} is not currently on lunch`);

    const ts = nowTimeStr();
    await ctx.db.patch(att._id, { lunchEnd: ts });
    return { lunchEnd: ts, internName: intern.fullName };
  },
});
