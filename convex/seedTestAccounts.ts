import { v } from "convex/values";
import { mutation } from "./_generated/server";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "DICT_R5_INTERN_SALT_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashSupervisorPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "DICT_R5_SUPERVISOR_SALT_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export const createTestIntern = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    
    // Check if test intern already exists
    const existing = await ctx.db
      .query("interns")
      .filter((q) => q.eq(q.field("email"), "test.intern@example.com"))
      .first();
    
    if (existing) {
      return { 
        success: false, 
        message: "Test intern already exists",
        email: "test.intern@example.com",
        password: "intern123"
      };
    }

    // Create intern record
    const internId = await ctx.db.insert("interns", {
      fullName: "Maria Santos",
      school: "Bicol University",
      course: "BS Information Technology",
      department: "Digital Transformation Center",
      supervisor: "Juan Dela Cruz",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 30 days ago
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 60 days from now
      requiredHours: 200,
      totalHours: 45.5,
      status: "ACTIVE",
      email: "test.intern@example.com",
      phone: "+63 912 345 6789",
      photoUrl: undefined,
      notes: "Test intern account for demo purposes",
      createdAt: now,
      updatedAt: now,
    });

    // Create login credentials
    const passwordHash = await hashPassword("intern123");
    const loginId = await ctx.db.insert("internLogins", {
      internId,
      email: "test.intern@example.com",
      passwordHash,
      isActive: true,
      createdAt: now,
      lastLoginAt: now,
    });

    // Add some sample attendance records
    const attendanceDates: Array<{ date: string; hours: number | undefined }> = [
      { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), hours: 8 },
      { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), hours: 7.5 },
      { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), hours: 8 },
      { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), hours: 8 },
      { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), hours: 6 },
      { date: today, hours: undefined }, // Today - checked in but not out yet
    ];

    for (const { date, hours } of attendanceDates) {
      const isToday = date === today;
      await ctx.db.insert("internAttendance", {
        internId,
        date,
        timeIn: `${date}T08:00:00.000Z`,
        timeOut: isToday ? undefined : `${date}T${hours === 8 ? "17:00" : hours === 7.5 ? "16:30" : "15:00"}:00.000Z`,
        hours: isToday ? undefined : hours,
        status: "PRESENT",
        notes: undefined,
        sessionCount: 1,
        createdAt: new Date(date + "T08:00:00.000Z").getTime(),
      });
    }

    // Add sample tasks
    const tasks = [
      { title: "Complete orientation training", status: "COMPLETED", priority: "HIGH", dueDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Set up development environment", status: "COMPLETED", priority: "HIGH", dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Review project documentation", status: "COMPLETED", priority: "MEDIUM", dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Build sample dashboard component", status: "IN_PROGRESS", priority: "HIGH", dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Write unit tests for API endpoints", status: "PENDING", priority: "MEDIUM", dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Prepare final presentation", status: "PENDING", priority: "LOW", dueDate: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
    ];

    for (const task of tasks) {
      await ctx.db.insert("internTasks", {
        internId,
        title: task.title,
        description: undefined,
        status: task.status as any,
        priority: task.priority as any,
        dueDate: task.dueDate,
        completedAt: task.status === "COMPLETED" ? new Date(now - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        createdAt: now - Math.random() * 20 * 24 * 60 * 60 * 1000,
      });
    }

    // Add sample habits
    const habits = [
      { emoji: "⏰", title: "Check in on time", frequency: "WEEKDAYS" },
      { emoji: "📝", title: "Log daily progress", frequency: "DAILY" },
      { emoji: "📚", title: "Learn something new", frequency: "DAILY" },
      { emoji: "💬", title: "Communicate with supervisor", frequency: "WEEKDAYS" },
    ];

    for (const habit of habits) {
      const habitId = await ctx.db.insert("internHabits", {
        internId,
        title: habit.title,
        emoji: habit.emoji,
        frequency: habit.frequency,
        isActive: true,
        createdAt: now,
      });

      // Add habit logs for the past 7 days
      for (let i = 0; i < 7; i++) {
        const logDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const completed = Math.random() > 0.3; // 70% completion rate
        if (completed) {
          await ctx.db.insert("internHabitLogs", {
            internId,
            habitId,
            date: logDate,
            completed: true,
            completedAt: new Date(logDate + "T10:00:00.000Z").getTime(),
          });
        }
      }
    }

    // Add sample journal entries
    const journalEntries = [
      {
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        mood: "GOOD",
        accomplishments: "Completed the dashboard component wireframe. Fixed 3 bugs in the authentication flow.",
        learnings: "Learned about React Server Components and how they improve performance.",
        challenges: "Struggled with TypeScript generics, but got help from my supervisor.",
        tomorrowPlan: "Start implementing the API integration. Write tests for the new components.",
      },
      {
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        mood: "GREAT",
        accomplishments: "Successfully integrated the API. All tests passing. Presented progress to the team.",
        learnings: "Discovered best practices for error handling in async operations.",
        challenges: "None today - everything went smoothly!",
        tomorrowPlan: "Review code with senior developer. Start on the next feature.",
      },
    ];

    for (const entry of journalEntries) {
      await ctx.db.insert("internDailyLogs", {
        internId,
        date: entry.date,
        accomplishments: entry.accomplishments,
        mood: entry.mood,
        learnings: entry.learnings,
        challenges: entry.challenges,
        tomorrowPlan: entry.tomorrowPlan,
        createdAt: new Date(entry.date + "T18:00:00.000Z").getTime(),
        updatedAt: new Date(entry.date + "T18:00:00.000Z").getTime(),
      });
    }

    // Add sample goals
    const goals = [
      { title: "Master React and TypeScript", completed: false, targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Build a full-stack application", completed: false, targetDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Complete 200 OJT hours", completed: false, targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { title: "Learn Git workflow", completed: true },
    ];

    for (const goal of goals) {
      await ctx.db.insert("internGoals", {
        internId,
        title: goal.title,
        description: undefined,
        targetDate: goal.targetDate,
        isCompleted: goal.completed,
        completedAt: goal.completed ? now - Math.random() * 10 * 24 * 60 * 60 * 1000 : undefined,
        createdAt: now - Math.random() * 20 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      success: true,
      message: "Test intern account created successfully!",
      internId,
      loginId,
      credentials: {
        email: "test.intern@example.com",
        password: "intern123",
        loginUrl: "/intern/login"
      }
    };
  },
});

export const createTestSupervisor = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Check if test supervisor already exists
    const existing = await ctx.db
      .query("supervisors")
      .filter((q) => q.eq(q.field("email"), "test.supervisor@example.com"))
      .first();
    
    if (existing) {
      return { 
        success: false, 
        message: "Test supervisor already exists",
        email: "test.supervisor@example.com",
        password: "supervisor123"
      };
    }

    // Create supervisor record
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
      message: "Test supervisor account created successfully!",
      supervisorId,
      credentials: {
        email: "test.supervisor@example.com",
        password: "supervisor123",
        loginUrl: "/supervisor-auth/login"
      }
    };
  },
});

export const createBothTestAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    // Create intern
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    
    const existingIntern = await ctx.db
      .query("interns")
      .filter((q) => q.eq(q.field("email"), "test.intern@example.com"))
      .first();
    
    let internResult;
    if (existingIntern) {
      internResult = { 
        success: false, 
        message: "Test intern already exists",
        credentials: {
          email: "test.intern@example.com",
          password: "intern123",
          loginUrl: "/intern/login"
        }
      };
    } else {
      // Inline intern creation to avoid runMutation
      const internId = await ctx.db.insert("interns", {
        fullName: "Maria Santos",
        school: "Bicol University",
        course: "BS Information Technology",
        department: "Digital Transformation Center",
        supervisor: "Juan Dela Cruz",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        requiredHours: 200,
        totalHours: 45.5,
        status: "ACTIVE",
        email: "test.intern@example.com",
        phone: "+63 912 345 6789",
        photoUrl: undefined,
        notes: "Test intern account for demo purposes",
        createdAt: now,
        updatedAt: now,
      });
      
      const passwordHash = await hashPassword("intern123");
      await ctx.db.insert("internLogins", {
        internId,
        email: "test.intern@example.com",
        passwordHash,
        isActive: true,
        createdAt: now,
        lastLoginAt: now,
      });
      
      internResult = {
        success: true,
        credentials: {
          email: "test.intern@example.com",
          password: "intern123",
          loginUrl: "/intern/login"
        }
      };
    }
    
    // Create supervisor
    const existingSupervisor = await ctx.db
      .query("supervisors")
      .filter((q) => q.eq(q.field("email"), "test.supervisor@example.com"))
      .first();
    
    let supervisorResult;
    if (existingSupervisor) {
      supervisorResult = { 
        success: false, 
        message: "Test supervisor already exists",
        credentials: {
          email: "test.supervisor@example.com",
          password: "supervisor123",
          loginUrl: "/supervisor-auth/login"
        }
      };
    } else {
      await ctx.db.insert("supervisors", {
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
      
      supervisorResult = {
        success: true,
        credentials: {
          email: "test.supervisor@example.com",
          password: "supervisor123",
          loginUrl: "/supervisor-auth/login"
        }
      };
    }

    return {
      intern: internResult,
      supervisor: supervisorResult,
      summary: {
        message: "Test accounts created! Use these credentials to log in:",
        accounts: [
          {
            type: "Intern",
            email: "test.intern@example.com",
            password: "intern123",
            loginUrl: "/intern/login",
            name: "Maria Santos"
          },
          {
            type: "Supervisor",
            email: "test.supervisor@example.com",
            password: "supervisor123",
            loginUrl: "/supervisor-auth/login",
            name: "Juan Dela Cruz"
          }
        ]
      }
    };
  },
});
