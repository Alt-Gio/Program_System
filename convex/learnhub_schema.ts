import { defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================
// ILCDB LearnHub — Table Definitions (v6)
// Import and spread into convex/schema.ts via ...learnhubTables
// DO NOT define these tables in schema.ts directly.
// ============================================================

export const learnhubTables = {
  // ── Users ────────────────────────────────────────────────
  learnhub_users: defineTable({
    googleId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    coverImageUrl: v.optional(v.string()),
    role: v.union(
      v.literal("student"),
      v.literal("mentor"),
      v.literal("org_partner"),
      v.literal("admin")
    ),
    mentorStatus: v.optional(v.union(
      v.literal("pending_verification"),
      v.literal("verified"),
      v.literal("suspended"),
      v.literal("rejected")
    )),
    bio: v.optional(v.string()),
    school: v.optional(v.string()),
    organization: v.optional(v.string()),
    designation: v.optional(v.string()),
    regionalOffice: v.optional(v.string()),
    region: v.optional(v.string()),
    municipality: v.optional(v.string()),
    province: v.optional(v.string()),
    programBatch: v.optional(v.string()),
    programType: v.optional(v.string()),
    isGraduate: v.optional(v.boolean()),
    graduatedAt: v.optional(v.number()),
    gender: v.optional(v.union(
      v.literal("female"),
      v.literal("male"),
      v.literal("prefer_not_to_say")
    )),
    sector: v.optional(v.union(
      v.literal("gov_workforce"),
      v.literal("education"),
      v.literal("vulnerable"),
      v.literal("private"),
      v.literal("other")
    )),
    vulnerableGroup: v.optional(v.string()),
    isWillingToHelp: v.optional(v.boolean()),
    expertiseTags: v.optional(v.array(v.string())),
    maxMentees: v.optional(v.number()),
    currentMenteeCount: v.optional(v.number()),
    availability: v.optional(v.string()),
    xpPoints: v.number(),
    badges: v.array(v.string()),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.string(),
    followingIds: v.array(v.id("learnhub_users")),
    followerCount: v.number(),
    connectionCount: v.optional(v.number()),
    fcmTokens: v.array(v.string()),
    unreadNotifCount: v.number(),
    unreadMessageCount: v.optional(v.number()),
    notifPrefs: v.object({
      pushEnabled: v.boolean(),
      emailDigest: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("never")
      ),
      quietHoursFrom: v.optional(v.string()),
      quietHoursTo: v.optional(v.string()),
    }),
  })
    .index("by_email", ["email"])
    .index("by_googleId", ["googleId"])
    .index("by_role", ["role"])
    .index("by_program", ["programType"])
    .index("by_batch", ["programBatch"]),

  // ── Mentor Invites & Verification ────────────────────────
  learnhub_mentor_invites: defineTable({
    token: v.string(),
    invitedEmail: v.string(),
    invitedName: v.string(),
    dictDesignation: v.string(),
    regionalOffice: v.string(),
    programs: v.array(v.string()),
    expertiseTags: v.array(v.string()),
    maxMentees: v.number(),
    personalMessage: v.optional(v.string()),
    invitedBy: v.id("learnhub_users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("declined")
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    mentorUserId: v.optional(v.id("learnhub_users")),
  })
    .index("by_token", ["token"])
    .index("by_email", ["invitedEmail"])
    .index("by_status", ["status"]),

  learnhub_mentor_verifications: defineTable({
    mentorId: v.id("learnhub_users"),
    dictEmployeeId: v.optional(v.string()),
    designation: v.optional(v.string()),
    verificationDocUrl: v.optional(v.string()),
    submittedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("learnhub_users")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    rejectionReason: v.optional(v.string()),
  })
    .index("by_mentor", ["mentorId"])
    .index("by_status", ["status"]),

  // ── Connections & Mentoring ───────────────────────────────
  learnhub_connections: defineTable({
    requesterId: v.id("learnhub_users"),
    receiverId: v.id("learnhub_users"),
    status: v.union(
      v.literal("pending"),
      v.literal("connected"),
      v.literal("declined")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requester", ["requesterId"])
    .index("by_receiver", ["receiverId"]),

  learnhub_mentoring_relationships: defineTable({
    mentorId: v.id("learnhub_users"),
    menteeId: v.id("learnhub_users"),
    status: v.union(
      v.literal("requested"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("declined")
    ),
    requestNote: v.string(),
    goals: v.array(v.string()),
    meetingNotes: v.array(v.object({
      date: v.number(),
      content: v.string(),
      authorId: v.id("learnhub_users"),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_mentor", ["mentorId"])
    .index("by_mentee", ["menteeId"]),

  // ── Groups ───────────────────────────────────────────────
  learnhub_groups: defineTable({
    name: v.string(),
    description: v.string(),
    coverImageUrl: v.optional(v.string()),
    type: v.union(
      v.literal("batch"),
      v.literal("regional"),
      v.literal("program"),
      v.literal("interest"),
      v.literal("org")
    ),
    programType: v.optional(v.string()),
    batchNumber: v.optional(v.number()),
    createdBy: v.id("learnhub_users"),
    adminIds: v.array(v.id("learnhub_users")),
    memberCount: v.number(),
    isPrivate: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_program", ["programType"]),

  learnhub_group_members: defineTable({
    groupId: v.id("learnhub_groups"),
    userId: v.id("learnhub_users"),
    role: v.union(v.literal("member"), v.literal("admin")),
    joinedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"]),

  // ── Posts & Social ───────────────────────────────────────
  learnhub_posts: defineTable({
    authorId: v.id("learnhub_users"),
    groupId: v.optional(v.id("learnhub_groups")),
    type: v.union(
      v.literal("text"),
      v.literal("youtube"),
      v.literal("video"),
      v.literal("meet"),
      v.literal("drive"),
      v.literal("form"),
      v.literal("opportunity"),
      v.literal("certificate"),
      v.literal("photo"),
      v.literal("event")
    ),
    content: v.string(),
    metadata: v.any(),
    likeCount: v.number(),
    commentCount: v.number(),
    isPinned: v.boolean(),
    scheduledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_group", ["groupId"])
    .index("by_created", ["createdAt"]),

  learnhub_likes: defineTable({
    postId: v.id("learnhub_posts"),
    userId: v.id("learnhub_users"),
    createdAt: v.number(),
  }).index("by_post_user", ["postId", "userId"]),

  learnhub_comments: defineTable({
    postId: v.id("learnhub_posts"),
    authorId: v.id("learnhub_users"),
    content: v.string(),
    parentId: v.optional(v.id("learnhub_comments")),
    createdAt: v.number(),
  }).index("by_post", ["postId"]),

  // ── Events ───────────────────────────────────────────────
  learnhub_events: defineTable({
    createdBy: v.id("learnhub_users"),
    groupId: v.optional(v.id("learnhub_groups")),
    title: v.string(),
    description: v.string(),
    coverImageUrl: v.optional(v.string()),
    type: v.union(
      v.literal("meet"),
      v.literal("onsite"),
      v.literal("hybrid"),
      v.literal("webinar")
    ),
    meetLink: v.optional(v.string()),
    location: v.optional(v.string()),
    calendarEventId: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    maxSlots: v.number(),
    registrantCount: v.number(),
    registrationDeadline: v.optional(v.number()),
    recordingUrl: v.optional(v.string()),
    campaignTag: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("live"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
  })
    .index("by_creator", ["createdBy"])
    .index("by_group", ["groupId"])
    .index("by_start", ["startTime"])
    .index("by_status", ["status"]),

  learnhub_event_registrants: defineTable({
    eventId: v.id("learnhub_events"),
    userId: v.id("learnhub_users"),
    attendedMinutes: v.optional(v.number()),
    registeredAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"]),

  learnhub_photos: defineTable({
    uploadedBy: v.id("learnhub_users"),
    groupId: v.optional(v.id("learnhub_groups")),
    eventId: v.optional(v.id("learnhub_events")),
    driveFileId: v.string(),
    imageUrl: v.string(),
    caption: v.optional(v.string()),
    programType: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_event", ["eventId"]),

  // ── Certificates ─────────────────────────────────────────
  learnhub_certificates: defineTable({
    studentEmail: v.string(),
    studentId: v.optional(v.id("learnhub_users")),
    courseTitle: v.string(),
    programType: v.string(),
    issuedBy: v.id("learnhub_users"),
    issuedByName: v.string(),
    issuedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("issued"),
      v.literal("claimed")
    ),
    driveFileId: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    verificationId: v.string(),
    certType: v.union(
      v.literal("learning"),
      v.literal("work_completion"),
      v.literal("event_participation")
    ),
  })
    .index("by_email", ["studentEmail"])
    .index("by_student", ["studentId"])
    .index("by_verification", ["verificationId"]),

  // ── Learning ─────────────────────────────────────────────
  learnhub_journal: defineTable({
    userId: v.id("learnhub_users"),
    date: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    wordCount: v.number(),
    updatedAt: v.number(),
  }).index("by_user_date", ["userId", "date"]),

  learnhub_bookmarks: defineTable({
    userId: v.id("learnhub_users"),
    postId: v.id("learnhub_posts"),
    status: v.union(
      v.literal("want_to_learn"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_post", ["userId", "postId"]),

  learnhub_video_sessions: defineTable({
    userId: v.id("learnhub_users"),
    postId: v.optional(v.id("learnhub_posts")),
    videoId: v.string(),
    sourceUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    channelName: v.optional(v.string()),
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    lastPositionSec: v.number(),
    durationSec: v.optional(v.number()),
    progressPct: v.number(),
    summary: v.optional(v.string()),
    aiSummary: v.optional(v.any()),
    takeaways: v.optional(v.array(v.string())),
    visibility: v.union(
      v.literal("private"),
      v.literal("mentors"),
      v.literal("learnhub"),
      v.literal("public")
    ),
    sharedAt: v.optional(v.number()),
    driveFileId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_video", ["userId", "videoId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_visibility", ["visibility"]),

  learnhub_video_notes: defineTable({
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    timestampSec: v.number(),
    content: v.string(),
    kind: v.union(
      v.literal("note"),
      v.literal("question"),
      v.literal("bookmark"),
      v.literal("takeaway")
    ),
    label: v.optional(v.string()),
    isShared: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_session_timestamp", ["sessionId", "timestampSec"]),

  learnhub_video_timeline_events: defineTable({
    sessionId: v.id("learnhub_video_sessions"),
    userId: v.id("learnhub_users"),
    type: v.union(
      v.literal("started"),
      v.literal("progress"),
      v.literal("note"),
      v.literal("question"),
      v.literal("summary"),
      v.literal("quiz"),
      v.literal("completed"),
      v.literal("shared"),
      v.literal("exported")
    ),
    timestampSec: v.optional(v.number()),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  learnhub_goals: defineTable({
    userId: v.id("learnhub_users"),
    title: v.string(),
    description: v.optional(v.string()),
    deadline: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  learnhub_learning_paths: defineTable({
    createdBy: v.id("learnhub_users"),
    groupId: v.optional(v.id("learnhub_groups")),
    title: v.string(),
    description: v.string(),
    programType: v.string(),
    modules: v.array(v.object({
      order: v.number(),
      title: v.string(),
      postIds: v.array(v.id("learnhub_posts")),
      completionRequirements: v.object({
        watchPercent: v.optional(v.number()),
        formPassingScore: v.optional(v.number()),
      }),
    })),
    certificateTemplateId: v.optional(v.string()),
    estimatedWeeks: v.number(),
    prerequisitePathIds: v.array(v.id("learnhub_learning_paths")),
    enrollmentCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_creator", ["createdBy"])
    .index("by_program", ["programType"]),

  learnhub_path_enrollments: defineTable({
    pathId: v.id("learnhub_learning_paths"),
    studentId: v.id("learnhub_users"),
    currentModuleIndex: v.number(),
    completedModuleIndices: v.array(v.number()),
    completedAt: v.optional(v.number()),
    enrolledAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_path", ["pathId"]),

  // ── Dynamic Forms ────────────────────────────────────────
  learnhub_forms: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("learnhub_users"),
    formType: v.string(),
    isSystem: v.boolean(),
    isStepByStep: v.boolean(),
    showProgressBar: v.boolean(),
    allowMultipleSubmissions: v.boolean(),
    requireAuth: v.boolean(),
    passingScore: v.optional(v.number()),
    fields: v.array(v.object({
      id: v.string(),
      type: v.string(),
      label: v.string(),
      placeholder: v.optional(v.string()),
      helpText: v.optional(v.string()),
      required: v.boolean(),
      options: v.optional(v.array(v.string())),
      validation: v.optional(v.any()),
      conditions: v.optional(v.array(v.any())),
      points: v.optional(v.number()),
      correctAnswer: v.optional(v.string()),
    })),
    successMessage: v.optional(v.string()),
    redirectAfterSubmit: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_creator", ["createdBy"])
    .index("by_type", ["formType"]),

  learnhub_form_submissions: defineTable({
    formId: v.id("learnhub_forms"),
    submittedBy: v.optional(v.id("learnhub_users")),
    submitterEmail: v.optional(v.string()),
    responses: v.array(v.object({
      fieldId: v.string(),
      value: v.any(),
    })),
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    passed: v.optional(v.boolean()),
    timeToComplete: v.optional(v.number()),
    isPartial: v.boolean(),
    submittedAt: v.number(),
  })
    .index("by_form", ["formId"])
    .index("by_user", ["submittedBy"]),

  learnhub_assessment_results: defineTable({
    studentId: v.id("learnhub_users"),
    postId: v.id("learnhub_posts"),
    formId: v.string(),
    score: v.number(),
    maxScore: v.number(),
    passingThreshold: v.number(),
    passed: v.boolean(),
    submittedAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_post", ["postId"]),

  // ── Work Opportunities ───────────────────────────────────
  learnhub_work_opportunities: defineTable({
    orgId: v.id("learnhub_users"),
    orgName: v.string(),
    orgLogoUrl: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    requiredCertTypes: v.array(v.string()),
    workType: v.union(
      v.literal("remote"),
      v.literal("hybrid"),
      v.literal("onsite")
    ),
    payType: v.union(
      v.literal("volunteer"),
      v.literal("stipend"),
      v.literal("paid")
    ),
    payAmount: v.optional(v.string()),
    slots: v.number(),
    filledSlots: v.optional(v.number()),
    deadline: v.number(),
    duration: v.string(),
    skills: v.optional(v.array(v.string())),
    applicationFormId: v.optional(v.id("learnhub_forms")),
    status: v.union(v.literal("open"), v.literal("closed")),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["status"]),

  learnhub_work_applications: defineTable({
    opportunityId: v.id("learnhub_work_opportunities"),
    studentId: v.id("learnhub_users"),
    note: v.optional(v.string()),
    formSubmissionId: v.optional(v.id("learnhub_form_submissions")),
    mentorEndorsement: v.optional(v.boolean()),
    endorsedBy: v.optional(v.id("learnhub_users")),
    status: v.union(
      v.literal("applied"),
      v.literal("under_review"),
      v.literal("accepted"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_opportunity", ["opportunityId"])
    .index("by_student", ["studentId"]),

  // ── Org Partners ─────────────────────────────────────────
  learnhub_org_profiles: defineTable({
    orgId: v.id("learnhub_users"),
    description: v.string(),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    municipality: v.optional(v.string()),
    industry: v.string(),
    logoUrl: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    specialOffers: v.array(v.object({
      title: v.string(),
      description: v.string(),
      validUntil: v.optional(v.number()),
    })),
    graduatesHired: v.number(),
    isVerified: v.boolean(),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  learnhub_org_invites: defineTable({
    inviteToken: v.string(),
    orgEmail: v.string(),
    orgName: v.string(),
    createdBy: v.id("learnhub_users"),
    usedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_token", ["inviteToken"]),

  // ── Reports ──────────────────────────────────────────────
  learnhub_quarterly_reports: defineTable({
    mentorId: v.id("learnhub_users"),
    quarter: v.string(),
    year: v.number(),
    generatedAt: v.number(),
    reportData: v.any(),
    status: v.union(
      v.literal("draft"),
      v.literal("final_review"),
      v.literal("published")
    ),
    driveExportUrl: v.optional(v.string()),
  })
    .index("by_mentor", ["mentorId"])
    .index("by_quarter_year", ["quarter", "year"]),

  // ── Messaging ────────────────────────────────────────────
  learnhub_conversations: defineTable({
    participantIds: v.array(v.id("learnhub_users")),
    type: v.optional(v.union(v.literal("direct"), v.literal("mentoring"))),
    relatedId: v.optional(v.string()),
    lastMessage: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    unreadCounts: v.any(),
  }).index("by_participants", ["participantIds"]),

  learnhub_messages: defineTable({
    conversationId: v.id("learnhub_conversations"),
    senderId: v.id("learnhub_users"),
    content: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // ── AI Chat ──────────────────────────────────────────────
  learnhub_chat_sessions: defineTable({
    userId: v.id("learnhub_users"),
    messageCount: v.number(),
    sessionStarted: v.number(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
  }).index("by_user", ["userId"]),

  learnhub_video_watch: defineTable({
    userId: v.id("learnhub_users"),
    postId: v.id("learnhub_posts"),
    videoId: v.string(),
    watchPercent: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user_post", ["userId", "postId"]),

  // ── Sync Log ─────────────────────────────────────────────
  learnhub_sync_log: defineTable({
    syncType: v.string(),
    status: v.union(v.literal("success"), v.literal("failed")),
    rowsSynced: v.number(),
    errorMessage: v.optional(v.string()),
    syncedAt: v.number(),
  }),
};
