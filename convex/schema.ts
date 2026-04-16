import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================
// DICT Region V – Program Management System
// Convex Schema v1.0
// ============================================================

export default defineSchema({

  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  /** System users with role-based access */
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    fullName: v.string(),
    role: v.string(), // "admin", "user", "viewer"
    googleEmail: v.optional(v.string()), // For Google Sheets sync access
    isActive: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  /** Active user sessions */
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // ----------------------------------------------------------
  // REFERENCE TABLES
  // ----------------------------------------------------------

  /** All provinces in Region V (Bicol) */
  provinces: defineTable({
    name: v.string(),
    code: v.string(),
    region: v.string(),
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    isActive: v.boolean(),
  }).index("by_code", ["code"]),

  /** LGUs / Municipalities per province */
  lgus: defineTable({
    provinceId: v.id("provinces"),
    name: v.string(),
    type: v.string(),
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    isActive: v.boolean(),
  })
    .index("by_province", ["provinceId"])
    .index("by_name", ["name"]),

  /** DICT personnel registry */
  personnel: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    position: v.string(),
    division: v.string(),
    email: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_division", ["division"]),

  // ----------------------------------------------------------
  // PROJECT / PROGRAM DEFINITIONS
  // ----------------------------------------------------------

  projects: defineTable({
    code: v.string(),
    name: v.string(),
    shortName: v.string(),
    description: v.string(),
    division: v.string(),
    projectType: v.string(),
    targetSectors: v.array(v.string()),
    modeOptions: v.array(v.string()),
    requirementNote: v.optional(v.string()),
    fyTarget: v.optional(v.object({
      fy: v.string(),
      metric: v.string(),
      value: v.number(),
    })),
    color: v.string(),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
    driveId: v.optional(v.string()),
  }).index("by_code", ["code"]),

  /** Sub-projects nested under main projects */
  subProjects: defineTable({
    parentProjectId: v.id("projects"),
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_parent", ["parentProjectId"]),

  // ----------------------------------------------------------
  // ACTIVITIES (core tracking table)
  // ----------------------------------------------------------

  activities: defineTable({
    projectId: v.id("projects"),
    subProjectId: v.optional(v.id("subProjects")),
    provinceId: v.id("provinces"),
    lguId: v.optional(v.id("lgus")),
    barangay: v.optional(v.string()),
    month: v.number(),
    year: v.number(),

    activityTitle: v.string(),
    venue: v.string(),
    partnerOrganizations: v.array(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    modeOfConduct: v.string(),

    personnelIds: v.array(v.id("personnel")),
    personnelRaw: v.optional(v.string()),

    participants: v.object({
      nga: v.object({ male: v.number(), female: v.number() }),
      lgu: v.object({ male: v.number(), female: v.number() }),
      suc: v.object({ male: v.number(), female: v.number() }),
      others: v.object({
        male: v.number(),
        female: v.number(),
        label: v.optional(v.string()),
      }),
    }),

    images: v.optional(v.array(v.object({
      url: v.string(),
      driveId: v.optional(v.string()),
      caption: v.optional(v.string()),
      uploadedAt: v.number(),
    }))),

    status: v.string(),
    afterActivityReport: v.optional(v.string()),
    fbPostingLink: v.optional(v.string()),
    rawPhotosLink: v.optional(v.string()),
    testimonialsLink: v.optional(v.string()),
    driveFolderLink: v.optional(v.string()),
    remarks: v.optional(v.string()),
    extraFields: v.optional(v.string()),

    createdBy: v.string(),
    updatedBy: v.optional(v.string()),
    importedFrom: v.optional(v.string()),
    importedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_province", ["provinceId"])
    .index("by_project_province", ["projectId", "provinceId"])
    .index("by_year_month", ["year", "month"])
    .index("by_project_year", ["projectId", "year"])
    .index("by_status", ["status"])
    .index("by_subproject", ["subProjectId"]),

  // ----------------------------------------------------------
  // PROJECT-SPECIFIC SUPPLEMENTAL TABLES
  // ----------------------------------------------------------

  wifiSites: defineTable({
    provinceId: v.id("provinces"),
    lguId: v.id("lgus"),
    siteName: v.string(),
    siteType: v.string(),
    coordinates: v.object({ lat: v.number(), lng: v.number() }),
    status: v.string(),
    installationDate: v.optional(v.string()),
    fy: v.string(),
  })
    .index("by_province", ["provinceId"])
    .index("by_status", ["status"]),

  govnetSites: defineTable({
    provinceId: v.id("provinces"),
    lguId: v.optional(v.id("lgus")),
    siteName: v.string(),
    siteType: v.string(),
    connectionType: v.string(),
    status: v.string(),
    maintainedSince: v.optional(v.string()),
    fy: v.string(),
  }).index("by_province", ["provinceId"]),

  elguSystems: defineTable({
    provinceId: v.id("provinces"),
    lguId: v.id("lgus"),
    systemName: v.string(),
    status: v.string(),
    deployedDate: v.optional(v.string()),
    fy: v.string(),
  }).index("by_lgu", ["lguId"]),

  simDistributions: defineTable({
    projectId: v.id("projects"),
    activityId: v.optional(v.id("activities")),
    provinceId: v.id("provinces"),
    lguId: v.id("lgus"),
    schoolName: v.string(),
    barangay: v.string(),
    simCount: v.number(),
    distributionDate: v.string(),
    fy: v.string(),
    status: v.string(),
  }).index("by_project_province", ["projectId", "provinceId"]),

  pnpkiApplications: defineTable({
    provinceId: v.id("provinces"),
    applicantName: v.string(),
    applicantOrg: v.string(),
    applicationType: v.string(),
    submittedDate: v.string(),
    processedDate: v.optional(v.string()),
    status: v.string(),
    fy: v.string(),
  }).index("by_province", ["provinceId"]),

  trainingPrograms: defineTable({
    projectId: v.id("projects"),
    activityId: v.optional(v.id("activities")),
    programName: v.string(),
    provinceId: v.id("provinces"),
    trainingType: v.string(),
    noOfTrainees: v.number(),
    completedDate: v.optional(v.string()),
    fy: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_province", ["provinceId"]),

  // ----------------------------------------------------------
  // REPORTING & EXPORT
  // ----------------------------------------------------------

  reports: defineTable({
    title: v.string(),
    projectId: v.optional(v.id("projects")),
    provinceId: v.optional(v.id("provinces")),
    periodFrom: v.string(),
    periodTo: v.string(),
    fy: v.string(),
    format: v.string(),
    status: v.string(),
    fileUrl: v.optional(v.string()),
    sheetsUrl: v.optional(v.string()),
    generatedBy: v.string(),
    generatedAt: v.number(),
    filters: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_fy", ["fy"]),

  sheetsSyncLog: defineTable({
    projectId: v.id("projects"),
    sheetId: v.string(),
    sheetName: v.string(),
    syncDirection: v.string(),
    rowsAffected: v.number(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    syncedAt: v.number(),
    syncedBy: v.string(),
  }).index("by_project", ["projectId"]),

  // ----------------------------------------------------------
  // CONFIGURATION
  // ----------------------------------------------------------

  appConfig: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_key", ["key"]),

  /** Connected Google Sheets per program — primary data source config */
  sheetsConnections: defineTable({
    projectId: v.id("projects"),
    sheetId: v.string(),
    sheetUrl: v.string(),
    sheetName: v.string(),
    webhookSecret: v.string(),
    syncEnabled: v.boolean(),
    columnMap: v.optional(v.string()),
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.string()),
    lastSyncRowCount: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    autoSyncInterval: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_sheet_id", ["sheetId"]),

  /** Highlight fields configuration per project — UI customizable */
  projectHighlightFields: defineTable({
    projectCode: v.string(),
    fields: v.array(v.object({
      key: v.string(),
      label: v.string(),
      icon: v.optional(v.string()),
      format: v.string(),
      source: v.string(),
      enabled: v.boolean(),
      order: v.number(),
    })),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_project_code", ["projectCode"]),

  // ----------------------------------------------------------
  // DTC LOGBOOK SYSTEM
  // ----------------------------------------------------------

  /** DTC visitor logbook entries */
  dtcLogs: defineTable({
    fullName: v.string(),
    agency: v.string(),
    purpose: v.string(),
    equipmentUsed: v.array(v.string()),
    pcId: v.optional(v.id("dtcPcs")),
    photoDataUrl: v.optional(v.string()),
    plannedDurationHours: v.number(),
    serviceType: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    timeIn: v.string(),
    timeOut: v.optional(v.string()),
    satisfactionRating: v.optional(v.number()),
    remarks: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_timeIn", ["timeIn"])
    .index("by_pcId", ["pcId"])
    .index("by_createdAt", ["createdAt"]),

  /** DTC computer workstations */
  dtcPcs: defineTable({
    name: v.string(),
    ipAddress: v.string(),
    location: v.optional(v.string()),
    status: v.string(),
    lastSeen: v.optional(v.string()),
    icon: v.optional(v.string()),
    gridCol: v.optional(v.number()),
    gridRow: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_status", ["status"])
    .index("by_ipAddress", ["ipAddress"]),

  /** DTC settings */
  dtcSettings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_key", ["key"]),

  /** DTC announcements */
  dtcAnnouncements: defineTable({
    title: v.string(),
    body: v.string(),
    type: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
  }).index("by_isActive", ["isActive"]),

  /** OTP verification codes */
  otpCodes: defineTable({
    contact: v.string(),
    contactType: v.string(),
    code: v.string(),
    purpose: v.string(),
    expiresAt: v.number(),
    verified: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_contact", ["contact"])
    .index("by_expiresAt", ["expiresAt"]),

  // ----------------------------------------------------------
  // INTERN MANAGEMENT SYSTEM
  // ----------------------------------------------------------

  /** Interns / OJT trainees */
  interns: defineTable({
    fullName: v.string(),
    school: v.string(),
    course: v.string(),
    department: v.optional(v.string()),
    supervisor: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    requiredHours: v.number(),
    totalHours: v.number(),
    status: v.string(), // ACTIVE, COMPLETED, INACTIVE, ON_LEAVE
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
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
    supervisorId: v.optional(v.id("supervisors")),
    photoStorageId: v.optional(v.string()),
    doc2x2StorageId: v.optional(v.string()),
    docResumeStorageId: v.optional(v.string()),
    docApplicationStorageId: v.optional(v.string()),
    docEndorsementStorageId: v.optional(v.string()),
    docMedicalStorageId: v.optional(v.string()),
    docWfhStorageId: v.optional(v.string()),
    docWorkPlanStorageId: v.optional(v.string()),
    docNdaStorageId: v.optional(v.string()),
    docNotesStorageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_school", ["school"])
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  /** Intern attendance records */
  internAttendance: defineTable({
    internId: v.id("interns"),
    date: v.string(),
    timeIn: v.optional(v.string()),
    timeOut: v.optional(v.string()),
    hours: v.optional(v.number()),
    status: v.string(), // PRESENT, ABSENT, HALF_DAY, LEAVE, HOLIDAY
    notes: v.optional(v.string()),
    sessionCount: v.optional(v.number()),
    checkInLat: v.optional(v.number()),
    checkInLng: v.optional(v.number()),
    checkInAccuracy: v.optional(v.number()),
    checkInAddress: v.optional(v.string()),
    checkInVerified: v.optional(v.boolean()),
    checkOutLat: v.optional(v.number()),
    checkOutLng: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_intern", ["internId"])
    .index("by_date", ["date"])
    .index("by_intern_date", ["internId", "date"]),

  /** GPS geofence zones where interns are allowed to check in */
  officeGeoFence: defineTable({
    name: v.string(),
    lat: v.number(),
    lng: v.number(),
    radiusMeters: v.number(),
    isActive: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_active", ["isActive"]),

  /** Tasks assigned to interns */
  internTasks: defineTable({
    internId: v.id("interns"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    priority: v.string(), // LOW, MEDIUM, HIGH, URGENT
    dueDate: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    progressNotes: v.optional(v.array(v.object({ note: v.string(), createdAt: v.number() }))),
    completionNote: v.optional(v.string()),
    proofStorageIds: v.optional(v.array(v.string())),
    submittedAt: v.optional(v.number()),
    supervisorNotified: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_intern", ["internId"])
    .index("by_status", ["status"])
    .index("by_intern_status", ["internId", "status"]),

  /** Documents uploaded for interns */
  internDocuments: defineTable({
    internId: v.id("interns"),
    name: v.string(),
    type: v.string(),
    url: v.string(),
    tags: v.optional(v.array(v.string())),
    uploadedBy: v.optional(v.string()),
    syncedToSheets: v.optional(v.boolean()),
    syncedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_intern", ["internId"])
    .index("by_createdAt", ["createdAt"]),

  /** Gamification accounts for interns */
  internAccounts: defineTable({
    internId: v.id("interns"),
    level: v.number(),
    xp: v.number(),
    health: v.number(),
    streak: v.number(),
    achievements: v.array(v.string()),
    lastActivityAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_intern", ["internId"]),

  /** Gamification sessions for interns */
  internSessions: defineTable({
    internId: v.id("interns"),
    accountId: v.id("internAccounts"),
    timeIn: v.string(),
    timeOut: v.optional(v.string()),
    hoursLogged: v.optional(v.number()),
    progressNote: v.optional(v.string()),
    xpEarned: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_intern", ["internId"])
    .index("by_account", ["accountId"])
    .index("by_createdAt", ["createdAt"]),

  // ----------------------------------------------------------
  // SUPERVISOR & INTERN AUTH
  // ----------------------------------------------------------

  /** Supervisors who manage interns */
  supervisors: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
    department: v.optional(v.string()),
    role: v.string(), // "supervisor", "head_supervisor"
    status: v.string(), // "active", "inactive"
    invitedBy: v.optional(v.string()),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  /** Invite tokens for supervisor self-registration */
  supervisorInvites: defineTable({
    email: v.string(),
    token: v.string(),
    createdBy: v.string(),
    used: v.boolean(),
    usedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  /** Auth sessions for supervisors */
  supervisorSessions: defineTable({
    supervisorId: v.id("supervisors"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_supervisor", ["supervisorId"]),

  /** Login credentials for intern accounts */
  internLogins: defineTable({
    internId: v.id("interns"),
    email: v.string(),
    passwordHash: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_intern", ["internId"]),

  /** Auth sessions for intern logins */
  internLoginSessions: defineTable({
    internLoginId: v.id("internLogins"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_login", ["internLoginId"]),

  /** Daily habits for interns to track */
  internHabits: defineTable({
    internId: v.id("interns"),
    title: v.string(),
    emoji: v.string(),
    frequency: v.string(), // DAILY, WEEKDAYS
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_intern", ["internId"]),

  /** Log of completed habits per day */
  internHabitLogs: defineTable({
    internId: v.id("interns"),
    habitId: v.id("internHabits"),
    date: v.string(), // YYYY-MM-DD
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
  })
    .index("by_intern", ["internId"])
    .index("by_intern_date", ["internId", "date"])
    .index("by_habit_date", ["habitId", "date"]),

  /** Daily accomplishment journal entries */
  internDailyLogs: defineTable({
    internId: v.id("interns"),
    date: v.string(), // YYYY-MM-DD
    accomplishments: v.optional(v.string()),
    mood: v.optional(v.string()), // GREAT, GOOD, OKAY, ROUGH
    learnings: v.optional(v.string()),
    challenges: v.optional(v.string()),
    tomorrowPlan: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_intern", ["internId"])
    .index("by_intern_date", ["internId", "date"]),

  /** Personal goals set by interns */
  internGoals: defineTable({
    internId: v.id("interns"),
    title: v.string(),
    description: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    isCompleted: v.boolean(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_intern", ["internId"]),

  /** Group projects created by supervisors for intern collaboration */
  internProjects: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    supervisorId: v.id("supervisors"),
    status: v.string(), // ACTIVE, COMPLETED, PAUSED, CANCELLED
    dueDate: v.optional(v.string()),
    priority: v.string(), // LOW, MEDIUM, HIGH, URGENT
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_supervisor", ["supervisorId"])
    .index("by_status", ["status"]),

  /** Intern members within group projects */
  internProjectMembers: defineTable({
    projectId: v.id("internProjects"),
    internId: v.id("interns"),
    role: v.string(), // LEAD, MEMBER
    joinedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_intern", ["internId"])
    .index("by_project_intern", ["projectId", "internId"]),

  /** Direct messages between supervisor and intern */
  supervisorMessages: defineTable({
    supervisorId: v.id("supervisors"),
    internId: v.id("interns"),
    senderType: v.string(), // "supervisor" | "intern"
    message: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_supervisor_intern", ["supervisorId", "internId"])
    .index("by_intern", ["internId"])
    .index("by_supervisor", ["supervisorId"]),

  /** Google Sheets to Convex ID mapping for interns */
  internSheetMapping: defineTable({
    sheetsInternId: v.string(),
    convexInternId: v.id("interns"),
    email: v.optional(v.string()),
    fullName: v.string(),
    createdAt: v.number(),
    lastSyncAt: v.optional(v.number()),
  })
    .index("by_sheets_id", ["sheetsInternId"])
    .index("by_convex_id", ["convexInternId"])
    .index("by_email", ["email"]),
});
