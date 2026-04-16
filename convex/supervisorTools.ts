import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ─── auth helper ──────────────────────────────────────────────
async function resolveSupervisor(ctx: any, token: string): Promise<Id<"supervisors">> {
  const session = await ctx.db
    .query("supervisorSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) throw new Error("Session expired");
  const sup = await ctx.db.get(session.supervisorId);
  if (!sup) throw new Error("Supervisor not found");
  return session.supervisorId as Id<"supervisors">;
}

// ══════════════════════════════════════════════════════════════
// TASK ASSIGNMENT
// ══════════════════════════════════════════════════════════════

export const assignTask = mutation({
  args: {
    token: v.string(),
    internId: v.id("interns"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    const intern = await ctx.db.get(args.internId);
    if (!intern) throw new Error("Intern not found");

    const id = await ctx.db.insert("internTasks", {
      internId: args.internId,
      title: args.title,
      description: args.description,
      status: "PENDING",
      priority: args.priority,
      dueDate: args.dueDate,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateTask = mutation({
  args: {
    token: v.string(),
    taskId: v.id("internTasks"),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    const { token, taskId, ...fields } = args;
    const patch: any = {};
    if (fields.status !== undefined)      patch.status = fields.status;
    if (fields.priority !== undefined)    patch.priority = fields.priority;
    if (fields.title !== undefined)       patch.title = fields.title;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.dueDate !== undefined)     patch.dueDate = fields.dueDate;
    if (fields.status === "COMPLETED")    patch.completedAt = new Date().toISOString();
    await ctx.db.patch(taskId, patch);
    return { success: true };
  },
});

export const deleteTask = mutation({
  args: { token: v.string(), taskId: v.id("internTasks") },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    await ctx.db.delete(args.taskId);
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════════════
// GROUP PROJECTS
// ══════════════════════════════════════════════════════════════

export const createProject = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.string(),
    dueDate: v.optional(v.string()),
    memberInternIds: v.array(v.id("interns")),
    leadInternId: v.optional(v.id("interns")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const supervisorId = await resolveSupervisor(ctx, args.token);
    const now = Date.now();

    const projectId = await ctx.db.insert("internProjects", {
      title: args.title,
      description: args.description,
      supervisorId,
      status: "ACTIVE",
      priority: args.priority,
      dueDate: args.dueDate,
      tags: args.tags,
      createdAt: now,
      updatedAt: now,
    });

    for (const internId of args.memberInternIds) {
      await ctx.db.insert("internProjectMembers", {
        projectId,
        internId,
        role: internId === args.leadInternId ? "LEAD" : "MEMBER",
        joinedAt: now,
      });
    }

    return projectId;
  },
});

export const updateProject = mutation({
  args: {
    token: v.string(),
    projectId: v.id("internProjects"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    const { token, projectId, ...fields } = args;
    const patch: any = { updatedAt: Date.now() };
    Object.entries(fields).forEach(([k, v]) => { if (v !== undefined) patch[k] = v; });
    await ctx.db.patch(projectId, patch);
    return { success: true };
  },
});

export const addProjectMember = mutation({
  args: {
    token: v.string(),
    projectId: v.id("internProjects"),
    internId: v.id("interns"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    const existing = await ctx.db
      .query("internProjectMembers")
      .withIndex("by_project_intern", (q: any) =>
        q.eq("projectId", args.projectId).eq("internId", args.internId)
      )
      .first();
    if (existing) return { success: true, alreadyMember: true };
    await ctx.db.insert("internProjectMembers", {
      projectId: args.projectId,
      internId: args.internId,
      role: args.role ?? "MEMBER",
      joinedAt: Date.now(),
    });
    return { success: true, alreadyMember: false };
  },
});

export const removeProjectMember = mutation({
  args: {
    token: v.string(),
    projectId: v.id("internProjects"),
    internId: v.id("interns"),
  },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    const member = await ctx.db
      .query("internProjectMembers")
      .withIndex("by_project_intern", (q: any) =>
        q.eq("projectId", args.projectId).eq("internId", args.internId)
      )
      .first();
    if (member) await ctx.db.delete(member._id);
    return { success: true };
  },
});

export const deleteProject = mutation({
  args: { token: v.string(), projectId: v.id("internProjects") },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    const members = await ctx.db
      .query("internProjectMembers")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    await ctx.db.delete(args.projectId);
    return { success: true };
  },
});

export const getProjects = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const supervisorId = await resolveSupervisor(ctx, args.token);

    const projects = await ctx.db
      .query("internProjects")
      .withIndex("by_supervisor", (q: any) => q.eq("supervisorId", supervisorId))
      .order("desc")
      .take(50);

    return await Promise.all(projects.map(async (proj: any) => {
      const memberRows = await ctx.db
        .query("internProjectMembers")
        .withIndex("by_project", (q: any) => q.eq("projectId", proj._id))
        .collect();

      const members = await Promise.all(memberRows.map(async (m: any) => {
        const intern = await ctx.db.get(m.internId as Id<"interns">) as any;
        return intern ? {
          internId: intern._id,
          fullName: intern.fullName as string,
          school: intern.school as string,
          role: m.role,
        } : null;
      }));

      return {
        id: proj._id,
        title: proj.title,
        description: proj.description ?? null,
        status: proj.status,
        priority: proj.priority,
        dueDate: proj.dueDate ?? null,
        tags: proj.tags ?? [],
        createdAt: proj.createdAt,
        members: members.filter(Boolean),
      };
    }));
  },
});

// ══════════════════════════════════════════════════════════════
// DIRECT MESSAGES
// ══════════════════════════════════════════════════════════════

export const sendMessage = mutation({
  args: {
    token: v.string(),
    internId: v.id("interns"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const supervisorId = await resolveSupervisor(ctx, args.token);
    const id = await ctx.db.insert("supervisorMessages", {
      supervisorId,
      internId: args.internId,
      senderType: "supervisor",
      message: args.message.trim(),
      createdAt: Date.now(),
    });
    return id;
  },
});

export const getMessages = query({
  args: { token: v.string(), internId: v.id("interns") },
  handler: async (ctx, args) => {
    const supervisorId = await resolveSupervisor(ctx, args.token);
    const msgs = await ctx.db
      .query("supervisorMessages")
      .withIndex("by_supervisor_intern", (q: any) =>
        q.eq("supervisorId", supervisorId).eq("internId", args.internId)
      )
      .order("asc")
      .take(200);
    return msgs;
  },
});

export const markMessagesRead = mutation({
  args: { token: v.string(), internId: v.id("interns") },
  handler: async (ctx, args) => {
    const supervisorId = await resolveSupervisor(ctx, args.token);
    const unread = await ctx.db
      .query("supervisorMessages")
      .withIndex("by_supervisor_intern", (q: any) =>
        q.eq("supervisorId", supervisorId).eq("internId", args.internId)
      )
      .collect();
    const now = Date.now();
    for (const m of unread) {
      if (!m.readAt && m.senderType === "intern") {
        await ctx.db.patch(m._id, { readAt: now });
      }
    }
    return { success: true };
  },
});

export const getUnreadCounts = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const supervisorId = await resolveSupervisor(ctx, args.token);
    const allMsgs = await ctx.db
      .query("supervisorMessages")
      .withIndex("by_supervisor", (q: any) => q.eq("supervisorId", supervisorId))
      .collect();
    const counts: Record<string, number> = {};
    for (const m of allMsgs) {
      if (m.senderType === "intern" && !m.readAt) {
        const key = m.internId as string;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  },
});

// Intern-side: reply to supervisor message
export const internReplyMessage = mutation({
  args: {
    internToken: v.string(),
    supervisorId: v.id("supervisors"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // resolve intern from internLogin session
    const session = await ctx.db
      .query("internLoginSessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.internToken))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Session expired");
    const loginRecord = await ctx.db.get(session.internLoginId);
    if (!loginRecord || !loginRecord.isActive) throw new Error("Account inactive");

    await ctx.db.insert("supervisorMessages", {
      supervisorId: args.supervisorId,
      internId: loginRecord.internId as Id<"interns">,
      senderType: "intern",
      message: args.message.trim(),
      createdAt: Date.now(),
    });
    return { success: true };
  },
});

export const getInternMessages = query({
  args: { internToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("internLoginSessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.internToken))
      .first();
    if (!session || session.expiresAt < Date.now()) return [];
    const loginRecord = await ctx.db.get(session.internLoginId);
    if (!loginRecord) return [];

    const msgs = await ctx.db
      .query("supervisorMessages")
      .withIndex("by_intern", (q: any) => q.eq("internId", loginRecord.internId))
      .order("asc")
      .take(200);

    return await Promise.all(msgs.map(async (m: any) => {
      const sup = await ctx.db.get(m.supervisorId as Id<"supervisors">) as any;
      return {
        ...m,
        supervisorName: (sup?.fullName as string | undefined) ?? "Supervisor",
      };
    }));
  },
});

// ══════════════════════════════════════════════════════════════
// GEOFENCE MANAGEMENT
// ══════════════════════════════════════════════════════════════

export const getGeoFences = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("officeGeoFence")
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .collect();
  },
});

export const getAllGeoFences = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    return await ctx.db.query("officeGeoFence").collect();
  },
});

export const createGeoFence = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    lat: v.number(),
    lng: v.number(),
    radiusMeters: v.number(),
  },
  handler: async (ctx, args) => {
    const supervisorId = await resolveSupervisor(ctx, args.token);
    const sup = await ctx.db.get(supervisorId) as any;
    const id = await ctx.db.insert("officeGeoFence", {
      name: args.name,
      lat: args.lat,
      lng: args.lng,
      radiusMeters: args.radiusMeters,
      isActive: true,
      createdBy: sup?.fullName ?? "Supervisor",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateGeoFence = mutation({
  args: {
    token: v.string(),
    fenceId: v.id("officeGeoFence"),
    name: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    radiusMeters: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    const { token, fenceId, ...fields } = args;
    const patch: any = {};
    Object.entries(fields).forEach(([k, v]) => { if (v !== undefined) patch[k] = v; });
    await ctx.db.patch(fenceId, patch);
    return { success: true };
  },
});

export const deleteGeoFence = mutation({
  args: { token: v.string(), fenceId: v.id("officeGeoFence") },
  handler: async (ctx, args) => {
    await resolveSupervisor(ctx, args.token);
    await ctx.db.delete(args.fenceId);
    return { success: true };
  },
});
