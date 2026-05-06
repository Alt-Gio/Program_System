import { mutation } from "./_generated/server";

async function hashSupervisorPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "DICT_R5_SUPERVISOR_SALT_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export const resetTestSupervisor = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find and delete existing test supervisor
    const existing = await ctx.db
      .query("supervisors")
      .filter((q) => q.eq(q.field("email"), "test.supervisor@example.com"))
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
      
      // Also delete any sessions for this supervisor
      const sessions = await ctx.db
        .query("supervisorSessions")
        .filter((q) => q.eq(q.field("supervisorId"), existing._id))
        .collect();
      
      for (const session of sessions) {
        await ctx.db.delete(session._id);
      }
    }

    // Create new supervisor with correct status
    const supervisorId = await ctx.db.insert("supervisors", {
      fullName: "Juan Dela Cruz",
      email: "test.supervisor@example.com",
      department: "Digital Transformation Center",
      phone: "+63 917 654 3210",
      passwordHash: await hashSupervisorPassword("supervisor123"),
      role: "SUPERVISOR",
      status: "active",
      createdAt: now,
      lastLoginAt: now,
    });

    return {
      success: true,
      message: "Test supervisor account reset successfully!",
      supervisorId,
      credentials: {
        email: "test.supervisor@example.com",
        password: "supervisor123",
        loginUrl: "/login"
      }
    };
  },
});
