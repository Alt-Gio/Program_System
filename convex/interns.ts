import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================
// QUERIES
// ============================================================

/** Get all interns with their related data */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const interns = await ctx.db.query("interns").order("desc").collect();
    
    const result = await Promise.all(
      interns.map(async (intern) => {
        const attendance = await ctx.db
          .query("internAttendance")
          .withIndex("by_intern", (q) => q.eq("internId", intern._id))
          .collect();
        
        const tasks = await ctx.db
          .query("internTasks")
          .withIndex("by_intern", (q) => q.eq("internId", intern._id))
          .collect();
        
        const documents = await ctx.db
          .query("internDocuments")
          .withIndex("by_intern", (q) => q.eq("internId", intern._id))
          .collect();
        
        return {
          id: intern._id,
          fullName: intern.fullName,
          school: intern.school,
          course: intern.course,
          department: intern.department ?? null,
          supervisor: intern.supervisor ?? null,
          supervisorId: intern.supervisorId ?? null,
          startDate: intern.startDate,
          endDate: intern.endDate,
          requiredHours: intern.requiredHours,
          totalHours: intern.totalHours,
          status: intern.status,
          email: intern.email ?? null,
          phone: intern.phone ?? null,
          photoUrl: intern.photoUrl ?? null,
          notes: intern.notes ?? null,
          createdAt: new Date(intern.createdAt).toISOString(),
          attendance: attendance.map((a) => ({
            id: a._id,
            internId: a.internId,
            date: a.date,
            timeIn: a.timeIn ?? null,
            timeOut: a.timeOut ?? null,
            hours: a.hours ?? null,
            status: a.status,
            notes: a.notes ?? null,
            sessionCount: a.sessionCount ?? undefined,
            checkInMethod: a.checkInMethod ?? null,
            faceConfidence: a.faceConfidence ?? null,
          })),
          tasks: tasks.map((t) => ({
            id: t._id,
            internId: t.internId,
            title: t.title,
            description: t.description ?? null,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate ?? null,
            completedAt: t.completedAt ?? null,
            createdAt: new Date(t.createdAt).toISOString(),
          })),
          documents: documents.map((d) => ({
            id: d._id,
            internId: d.internId,
            name: d.name,
            type: d.type,
            url: d.url,
            tags: d.tags ?? [],
            uploadedBy: d.uploadedBy ?? null,
            syncedToSheets: d.syncedToSheets ?? false,
            syncedAt: d.syncedAt ?? undefined,
            createdAt: new Date(d.createdAt).toISOString(),
          })),
        };
      })
    );
    
    return result;
  },
});

/** Get a single intern by ID */
export const getById = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    const intern = await ctx.db.get(args.internId);
    if (!intern) return null;
    
    const attendance = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern", (q) => q.eq("internId", intern._id))
      .collect();
    
    const tasks = await ctx.db
      .query("internTasks")
      .withIndex("by_intern", (q) => q.eq("internId", intern._id))
      .collect();
    
    const documents = await ctx.db
      .query("internDocuments")
      .withIndex("by_intern", (q) => q.eq("internId", intern._id))
      .collect();
    
    const account = await ctx.db
      .query("internAccounts")
      .withIndex("by_intern", (q) => q.eq("internId", intern._id))
      .first();
    
    let recentSessions: any[] = [];
    if (account) {
      const sessions = await ctx.db
        .query("internSessions")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .order("desc")
        .take(10);
      
      recentSessions = sessions.map((s) => ({
        id: s._id,
        timeIn: s.timeIn,
        timeOut: s.timeOut ?? undefined,
        hoursLogged: s.hoursLogged ?? undefined,
        progressNote: s.progressNote ?? undefined,
      }));
    }
    
    return {
      id: intern._id,
      fullName: intern.fullName,
      school: intern.school,
      course: intern.course,
      department: intern.department ?? null,
      supervisor: intern.supervisor ?? null,
      startDate: intern.startDate,
      endDate: intern.endDate,
      requiredHours: intern.requiredHours,
      totalHours: intern.totalHours,
      status: intern.status,
      email: intern.email ?? null,
      phone: intern.phone ?? null,
      photoUrl: intern.photoUrl ?? null,
      notes: intern.notes ?? null,
      createdAt: new Date(intern.createdAt).toISOString(),
      completedTasks: tasks.filter((t) => t.status === "COMPLETED").length,
      account: account
        ? {
            id: account._id,
            level: account.level,
            xp: account.xp,
            health: account.health,
            streak: account.streak,
            achievements: account.achievements,
          }
        : null,
      tasks: tasks.map((t) => ({
        id: t._id,
        internId: t.internId,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ?? null,
        completedAt: t.completedAt ?? null,
        createdAt: new Date(t.createdAt).toISOString(),
      })),
      recentSessions,
      attendance: attendance.map((a) => ({
        id: a._id,
        internId: a.internId,
        date: a.date,
        timeIn: a.timeIn ?? null,
        timeOut: a.timeOut ?? null,
        hours: a.hours ?? null,
        status: a.status,
        notes: a.notes ?? null,
        sessionCount: a.sessionCount ?? undefined,
      })),
      documents: documents.map((d) => ({
        id: d._id,
        internId: d.internId,
        name: d.name,
        type: d.type,
        url: d.url,
        tags: d.tags ?? [],
        uploadedBy: d.uploadedBy ?? null,
        syncedToSheets: d.syncedToSheets ?? false,
        syncedAt: d.syncedAt ?? undefined,
        createdAt: new Date(d.createdAt).toISOString(),
      })),
    };
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/** Create a new intern */
export const create = mutation({
  args: {
    fullName: v.string(),
    school: v.string(),
    course: v.string(),
    department: v.optional(v.string()),
    supervisor: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    requiredHours: v.number(),
    status: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    photoStorageId: v.optional(v.string()),
    notes: v.optional(v.string()),
    sex: v.optional(v.string()),
    age: v.optional(v.number()),
    civilStatus: v.optional(v.string()),
    isIndigenous: v.optional(v.boolean()),
    isPWD: v.optional(v.boolean()),
    isSoloParent: v.optional(v.boolean()),
    officeAssignment: v.optional(v.string()),
    onboardingDate: v.optional(v.number()),
    estimatedCompletion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const internId = await ctx.db.insert("interns", {
      fullName: args.fullName,
      school: args.school,
      course: args.course,
      department: args.department,
      supervisor: args.supervisor,
      startDate: args.startDate,
      endDate: args.endDate,
      requiredHours: args.requiredHours,
      totalHours: 0,
      status: args.status ?? "ACTIVE",
      email: args.email,
      phone: args.phone,
      photoUrl: args.photoUrl,
      photoStorageId: args.photoStorageId,
      notes: args.notes,
      sex: args.sex,
      age: args.age,
      civilStatus: args.civilStatus,
      isIndigenous: args.isIndigenous,
      isPWD: args.isPWD,
      isSoloParent: args.isSoloParent,
      officeAssignment: args.officeAssignment,
      onboardingDate: args.onboardingDate,
      estimatedCompletion: args.estimatedCompletion,
      createdAt: now,
      updatedAt: now,
    });
    
    // Create gamification account
    await ctx.db.insert("internAccounts", {
      internId,
      level: 1,
      xp: 0,
      health: 100,
      streak: 0,
      achievements: [],
      createdAt: now,
    });
    
    return internId;
  },
});

/** Update an intern */
export const update = mutation({
  args: {
    internId: v.id("interns"),
    fullName: v.optional(v.string()),
    school: v.optional(v.string()),
    course: v.optional(v.string()),
    department: v.optional(v.string()),
    supervisor: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    requiredHours: v.optional(v.number()),
    status: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    photoStorageId: v.optional(v.string()),
    notes: v.optional(v.string()),
    sex: v.optional(v.string()),
    age: v.optional(v.number()),
    civilStatus: v.optional(v.string()),
    isIndigenous: v.optional(v.boolean()),
    isPWD: v.optional(v.boolean()),
    isSoloParent: v.optional(v.boolean()),
    officeAssignment: v.optional(v.string()),
    onboardingDate: v.optional(v.number()),
    estimatedCompletion: v.optional(v.number()),
    doc2x2StorageId: v.optional(v.string()),
    docResumeStorageId: v.optional(v.string()),
    docApplicationStorageId: v.optional(v.string()),
    docEndorsementStorageId: v.optional(v.string()),
    docMedicalStorageId: v.optional(v.string()),
    docWfhStorageId: v.optional(v.string()),
    docWorkPlanStorageId: v.optional(v.string()),
    docNdaStorageId: v.optional(v.string()),
    docNotesStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { internId, ...updates } = args;
    
    await ctx.db.patch(internId, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return internId;
  },
});

/** Delete an intern and all related data */
export const remove = mutation({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    // Delete attendance
    const attendance = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern", (q) => q.eq("internId", args.internId))
      .collect();
    for (const record of attendance) {
      await ctx.db.delete(record._id);
    }
    
    // Delete tasks
    const tasks = await ctx.db
      .query("internTasks")
      .withIndex("by_intern", (q) => q.eq("internId", args.internId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }
    
    // Delete documents
    const documents = await ctx.db
      .query("internDocuments")
      .withIndex("by_intern", (q) => q.eq("internId", args.internId))
      .collect();
    for (const doc of documents) {
      await ctx.db.delete(doc._id);
    }
    
    // Delete account and sessions
    const account = await ctx.db
      .query("internAccounts")
      .withIndex("by_intern", (q) => q.eq("internId", args.internId))
      .first();
    if (account) {
      const sessions = await ctx.db
        .query("internSessions")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .collect();
      for (const session of sessions) {
        await ctx.db.delete(session._id);
      }
      await ctx.db.delete(account._id);
    }
    
    // Delete intern
    await ctx.db.delete(args.internId);
    
    return { success: true };
  },
});

/** Add attendance record */
export const addAttendance = mutation({
  args: {
    internId: v.id("interns"),
    date: v.string(),
    timeIn: v.optional(v.string()),
    timeOut: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { internId, ...data } = args;
    
    // Calculate hours if both timeIn and timeOut are provided
    let hours: number | undefined;
    if (data.timeIn && data.timeOut) {
      const timeInDate = new Date(data.timeIn);
      const timeOutDate = new Date(data.timeOut);
      hours = (timeOutDate.getTime() - timeInDate.getTime()) / (1000 * 60 * 60);
      hours = Math.round(hours * 100) / 100; // Round to 2 decimals
    }
    
    const attendanceId = await ctx.db.insert("internAttendance", {
      internId,
      date: data.date,
      timeIn: data.timeIn,
      timeOut: data.timeOut,
      hours,
      status: data.status,
      notes: data.notes,
      createdAt: Date.now(),
    });
    
    // Update total hours
    if (hours) {
      const intern = await ctx.db.get(internId);
      if (intern) {
        await ctx.db.patch(internId, {
          totalHours: intern.totalHours + hours,
          updatedAt: Date.now(),
        });
      }
    }
    
    return attendanceId;
  },
});

/** Delete attendance record */
export const deleteAttendance = mutation({
  args: {
    internId: v.id("interns"),
    recordId: v.id("internAttendance"),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.recordId);
    if (!record) throw new Error("Attendance record not found");
    
    // Subtract hours from total
    if (record.hours) {
      const intern = await ctx.db.get(args.internId);
      if (intern) {
        await ctx.db.patch(args.internId, {
          totalHours: Math.max(0, intern.totalHours - record.hours),
          updatedAt: Date.now(),
        });
      }
    }
    
    await ctx.db.delete(args.recordId);
    return { success: true };
  },
});

/** Add task */
export const addTask = mutation({
  args: {
    internId: v.id("interns"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { internId, ...data } = args;
    
    const taskId = await ctx.db.insert("internTasks", {
      internId,
      title: data.title,
      description: data.description,
      status: "PENDING",
      priority: data.priority,
      dueDate: data.dueDate,
      createdAt: Date.now(),
    });
    
    return taskId;
  },
});

/** Update task status */
export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("internTasks"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    
    if (args.status === "COMPLETED") {
      updates.completedAt = new Date().toISOString();
    }
    
    await ctx.db.patch(args.taskId, updates);
    return { success: true };
  },
});

/** Delete task */
export const deleteTask = mutation({
  args: { taskId: v.id("internTasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.taskId);
    return { success: true };
  },
});

/** Add document */
export const addDocument = mutation({
  args: {
    internId: v.id("interns"),
    name: v.string(),
    type: v.string(),
    url: v.string(),
    uploadedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { internId, ...data } = args;
    
    const docId = await ctx.db.insert("internDocuments", {
      internId,
      name: data.name,
      type: data.type,
      url: data.url,
      uploadedBy: data.uploadedBy,
      createdAt: Date.now(),
    });
    
    return docId;
  },
});

/** Update document tags */
export const updateDocumentTags = mutation({
  args: {
    docId: v.id("internDocuments"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.docId, { tags: args.tags });
    return { success: true };
  },
});

/** Delete document */
export const deleteDocument = mutation({
  args: { docId: v.id("internDocuments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.docId);
    return { success: true };
  },
});

// ============================================================
// GOOGLE SHEETS SYNC HELPERS
// ============================================================

/** Find or create intern ID mapping from Google Sheets ID */
export const getOrCreateMapping = mutation({
  args: {
    sheetsInternId: v.string(),
    email: v.optional(v.string()),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    // Try to find existing mapping
    const existing = await ctx.db
      .query("internSheetMapping")
      .withIndex("by_sheets_id", (q) => q.eq("sheetsInternId", args.sheetsInternId))
      .first();
    
    if (existing) {
      return existing.convexInternId;
    }
    
    // Try to find intern by email if provided
    if (args.email) {
      const internByEmail = await ctx.db
        .query("interns")
        .filter((q) => q.eq(q.field("email"), args.email))
        .first();
      
      if (internByEmail) {
        // Create mapping
        await ctx.db.insert("internSheetMapping", {
          sheetsInternId: args.sheetsInternId,
          convexInternId: internByEmail._id,
          email: args.email,
          fullName: args.fullName,
          createdAt: Date.now(),
          lastSyncAt: Date.now(),
        });
        return internByEmail._id;
      }
    }
    
    // No mapping found - return null so caller can handle
    return null;
  },
});

/** Update attendance from Google Sheets sync */
export const syncAttendanceFromSheets = mutation({
  args: {
    sheetsInternId: v.string(),
    date: v.string(),
    timeIn: v.optional(v.string()),
    timeOut: v.optional(v.string()),
    hours: v.optional(v.number()),
    lateMinutes: v.optional(v.number()),
    undertimeMinutes: v.optional(v.number()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get Convex intern ID
    const mapping = await ctx.db
      .query("internSheetMapping")
      .withIndex("by_sheets_id", (q) => q.eq("sheetsInternId", args.sheetsInternId))
      .first();
    
    if (!mapping) {
      throw new Error(`No mapping found for Sheets intern ID: ${args.sheetsInternId}`);
    }
    
    const internId = mapping.convexInternId;
    
    // Check if attendance already exists for this date
    const existing = await ctx.db
      .query("internAttendance")
      .withIndex("by_intern_date", (q) => 
        q.eq("internId", internId).eq("date", args.date)
      )
      .first();
    
    const notes = [
      args.remarks,
      args.lateMinutes ? `Late: ${args.lateMinutes}m` : null,
      args.undertimeMinutes ? `UT: ${args.undertimeMinutes}m` : null,
    ].filter(Boolean).join(", ");
    
    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        timeIn: args.timeIn,
        timeOut: args.timeOut,
        hours: args.hours,
        notes: notes || undefined,
      });
      
      // Update total hours if changed
      if (args.hours && existing.hours !== args.hours) {
        const intern = await ctx.db.get(internId);
        if (intern) {
          const hoursDiff = args.hours - (existing.hours || 0);
          await ctx.db.patch(internId, {
            totalHours: intern.totalHours + hoursDiff,
            updatedAt: Date.now(),
          });
        }
      }
      
      return existing._id;
    } else {
      // Create new attendance record
      const attendanceId = await ctx.db.insert("internAttendance", {
        internId,
        date: args.date,
        timeIn: args.timeIn,
        timeOut: args.timeOut,
        hours: args.hours,
        status: "PRESENT",
        notes: notes || undefined,
        createdAt: Date.now(),
      });
      
      // Update total hours
      if (args.hours) {
        const intern = await ctx.db.get(internId);
        if (intern) {
          await ctx.db.patch(internId, {
            totalHours: intern.totalHours + args.hours,
            updatedAt: Date.now(),
          });
        }
      }
      
      return attendanceId;
    }
  },
});

/** Sync activity/task from Google Sheets */
export const syncActivityFromSheets = mutation({
  args: {
    sheetsInternId: v.string(),
    date: v.string(),
    task: v.string(),
    program: v.optional(v.string()),
    hours: v.optional(v.number()),
    output: v.optional(v.string()),
    status: v.optional(v.string()),
    rating: v.optional(v.number()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get Convex intern ID
    const mapping = await ctx.db
      .query("internSheetMapping")
      .withIndex("by_sheets_id", (q) => q.eq("sheetsInternId", args.sheetsInternId))
      .first();
    
    if (!mapping) {
      throw new Error(`No mapping found for Sheets intern ID: ${args.sheetsInternId}`);
    }
    
    const internId = mapping.convexInternId;
    
    // Build description
    const descriptionParts = [
      args.program ? `Program: ${args.program}` : null,
      args.output ? `Output: ${args.output}` : null,
      args.rating ? `Rating: ${args.rating}/5` : null,
      args.remarks,
    ].filter(Boolean);
    
    const description = descriptionParts.join("\n");
    
    // Determine priority based on rating
    let priority = "MEDIUM";
    if (args.rating) {
      if (args.rating >= 4) priority = "HIGH";
      else if (args.rating < 3) priority = "LOW";
    }
    
    // Determine task status
    let taskStatus = "PENDING";
    if (args.status === "Done" || args.status === "Completed") {
      taskStatus = "COMPLETED";
    } else if (args.status === "In Progress" || args.status === "Ongoing") {
      taskStatus = "IN_PROGRESS";
    }
    
    // Create task
    const taskId = await ctx.db.insert("internTasks", {
      internId,
      title: args.task,
      description: description || undefined,
      status: taskStatus,
      priority,
      dueDate: args.date,
      completedAt: taskStatus === "COMPLETED" ? new Date().toISOString() : undefined,
      createdAt: Date.now(),
    });
    
    // Award XP if task is completed and has a rating
    if (taskStatus === "COMPLETED" && args.rating) {
      const xpAmount = args.rating * 10; // 10 XP per rating point
      
      const account = await ctx.db
        .query("internAccounts")
        .withIndex("by_intern", (q) => q.eq("internId", internId))
        .first();
      
      if (account) {
        const newXp = account.xp + xpAmount;
        const newLevel = Math.floor(newXp / 100) + 1;
        
        await ctx.db.patch(account._id, {
          xp: newXp,
          level: newLevel,
          lastActivityAt: Date.now(),
        });
      }
    }
    
    return taskId;
  },
});

/** Register new intern (for registration form) */
export const register = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    school: v.string(),
    course: v.string(),
    department: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    requiredHours: v.number(),
    sheetsInternId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if intern already exists by email
    const existing = await ctx.db
      .query("interns")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
    
    if (existing) {
      throw new Error("An intern with this email already exists");
    }
    
    // Create intern
    const internId = await ctx.db.insert("interns", {
      fullName: args.fullName,
      school: args.school,
      course: args.course,
      department: args.department,
      startDate: args.startDate,
      endDate: args.endDate,
      requiredHours: args.requiredHours,
      totalHours: 0,
      status: "ACTIVE",
      email: args.email,
      phone: args.phone,
      createdAt: now,
      updatedAt: now,
    });
    
    // Create gamification account
    await ctx.db.insert("internAccounts", {
      internId,
      level: 1,
      xp: 0,
      health: 100,
      streak: 0,
      achievements: [],
      createdAt: now,
    });
    
    // Create mapping if Sheets ID provided
    if (args.sheetsInternId) {
      await ctx.db.insert("internSheetMapping", {
        sheetsInternId: args.sheetsInternId,
        convexInternId: internId,
        email: args.email,
        fullName: args.fullName,
        createdAt: now,
        lastSyncAt: now,
      });
    }
    
    return internId;
  },
});
