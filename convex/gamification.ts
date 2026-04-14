import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/** Award bonus XP to an intern account */
export const awardXp = mutation({
  args: {
    accountId: v.id("internAccounts"),
    xp: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Account not found");
    
    const newXp = account.xp + args.xp;
    const newLevel = Math.floor(1 + Math.sqrt(newXp / 100)); // Simple level formula
    
    // Check for new achievements
    const achievements = [...account.achievements];
    
    if (newLevel >= 5 && !achievements.includes("level_5")) {
      achievements.push("level_5");
    }
    if (newLevel >= 10 && !achievements.includes("level_10")) {
      achievements.push("level_10");
    }
    if (newLevel >= 20 && !achievements.includes("level_20")) {
      achievements.push("level_20");
    }
    
    await ctx.db.patch(args.accountId, {
      xp: newXp,
      level: newLevel,
      achievements,
      lastActivityAt: Date.now(),
    });
    
    return { success: true, newXp, newLevel, achievements };
  },
});

/** Create a session for an intern */
export const createSession = mutation({
  args: {
    internId: v.id("interns"),
    timeIn: v.string(),
    progressNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("internAccounts")
      .withIndex("by_intern", (q) => q.eq("internId", args.internId))
      .first();
    
    if (!account) throw new Error("Account not found for this intern");
    
    const sessionId = await ctx.db.insert("internSessions", {
      internId: args.internId,
      accountId: account._id,
      timeIn: args.timeIn,
      progressNote: args.progressNote,
      createdAt: Date.now(),
    });
    
    return sessionId;
  },
});

/** End a session and calculate XP */
export const endSession = mutation({
  args: {
    sessionId: v.id("internSessions"),
    timeOut: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    
    const timeInDate = new Date(session.timeIn);
    const timeOutDate = new Date(args.timeOut);
    const hoursLogged = (timeOutDate.getTime() - timeInDate.getTime()) / (1000 * 60 * 60);
    
    // Award XP based on hours (10 XP per hour)
    const xpEarned = Math.floor(hoursLogged * 10);
    
    await ctx.db.patch(args.sessionId, {
      timeOut: args.timeOut,
      hoursLogged: Math.round(hoursLogged * 100) / 100,
      xpEarned,
    });
    
    // Update account XP
    const account = await ctx.db.get(session.accountId);
    if (account) {
      const newXp = account.xp + xpEarned;
      const newLevel = Math.floor(1 + Math.sqrt(newXp / 100));
      
      await ctx.db.patch(session.accountId, {
        xp: newXp,
        level: newLevel,
        lastActivityAt: Date.now(),
      });
    }
    
    return { success: true, hoursLogged, xpEarned };
  },
});
