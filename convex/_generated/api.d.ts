/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as activityImages from "../activityImages.js";
import type * as attendanceSync from "../attendanceSync.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as dtcAnnouncements from "../dtcAnnouncements.js";
import type * as dtcLogs from "../dtcLogs.js";
import type * as dtcPcs from "../dtcPcs.js";
import type * as dtcSettings from "../dtcSettings.js";
import type * as emails from "../emails.js";
import type * as face_recognition from "../face_recognition.js";
import type * as files from "../files.js";
import type * as gamification from "../gamification.js";
import type * as googleSheetsWrite from "../googleSheetsWrite.js";
import type * as highlightFields from "../highlightFields.js";
import type * as http from "../http.js";
import type * as identities from "../identities.js";
import type * as images from "../images.js";
import type * as import_log from "../import_log.js";
import type * as internAuth from "../internAuth.js";
import type * as internPortal from "../internPortal.js";
import type * as internPublic from "../internPublic.js";
import type * as internSheetsSync from "../internSheetsSync.js";
import type * as internTasks from "../internTasks.js";
import type * as interns from "../interns.js";
import type * as invites from "../invites.js";
import type * as learnhub_bookmarks from "../learnhub_bookmarks.js";
import type * as learnhub_cert_ingest from "../learnhub_cert_ingest.js";
import type * as learnhub_cert_ingest_node from "../learnhub_cert_ingest_node.js";
import type * as learnhub_certificates from "../learnhub_certificates.js";
import type * as learnhub_comments from "../learnhub_comments.js";
import type * as learnhub_conversations from "../learnhub_conversations.js";
import type * as learnhub_curated from "../learnhub_curated.js";
import type * as learnhub_events from "../learnhub_events.js";
import type * as learnhub_forms from "../learnhub_forms.js";
import type * as learnhub_google_credentials from "../learnhub_google_credentials.js";
import type * as learnhub_habits from "../learnhub_habits.js";
import type * as learnhub_journal from "../learnhub_journal.js";
import type * as learnhub_meet from "../learnhub_meet.js";
import type * as learnhub_mentors from "../learnhub_mentors.js";
import type * as learnhub_notifications from "../learnhub_notifications.js";
import type * as learnhub_org from "../learnhub_org.js";
import type * as learnhub_posts from "../learnhub_posts.js";
import type * as learnhub_progress from "../learnhub_progress.js";
import type * as learnhub_reports from "../learnhub_reports.js";
import type * as learnhub_schema from "../learnhub_schema.js";
import type * as learnhub_streaks from "../learnhub_streaks.js";
import type * as learnhub_users from "../learnhub_users.js";
import type * as learnhub_video_collab from "../learnhub_video_collab.js";
import type * as learnhub_video_courses from "../learnhub_video_courses.js";
import type * as learnhub_video_flow from "../learnhub_video_flow.js";
import type * as learnhub_work from "../learnhub_work.js";
import type * as learnhub_xp from "../learnhub_xp.js";
import type * as meetingHall from "../meetingHall.js";
import type * as otp from "../otp.js";
import type * as otpCodes from "../otpCodes.js";
import type * as personnel from "../personnel.js";
import type * as programMedia from "../programMedia.js";
import type * as projects from "../projects.js";
import type * as provinces from "../provinces.js";
import type * as resetTestSupervisor from "../resetTestSupervisor.js";
import type * as seedTestAccounts from "../seedTestAccounts.js";
import type * as sheetsActions from "../sheetsActions.js";
import type * as sheetsSync from "../sheetsSync.js";
import type * as subProjects from "../subProjects.js";
import type * as supervisorTools from "../supervisorTools.js";
import type * as supervisors from "../supervisors.js";
import type * as syncMonitor from "../syncMonitor.js";
import type * as testEnv from "../testEnv.js";
import type * as user_accounts from "../user_accounts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  activityImages: typeof activityImages;
  attendanceSync: typeof attendanceSync;
  auditLog: typeof auditLog;
  auth: typeof auth;
  crons: typeof crons;
  dtcAnnouncements: typeof dtcAnnouncements;
  dtcLogs: typeof dtcLogs;
  dtcPcs: typeof dtcPcs;
  dtcSettings: typeof dtcSettings;
  emails: typeof emails;
  face_recognition: typeof face_recognition;
  files: typeof files;
  gamification: typeof gamification;
  googleSheetsWrite: typeof googleSheetsWrite;
  highlightFields: typeof highlightFields;
  http: typeof http;
  identities: typeof identities;
  images: typeof images;
  import_log: typeof import_log;
  internAuth: typeof internAuth;
  internPortal: typeof internPortal;
  internPublic: typeof internPublic;
  internSheetsSync: typeof internSheetsSync;
  internTasks: typeof internTasks;
  interns: typeof interns;
  invites: typeof invites;
  learnhub_bookmarks: typeof learnhub_bookmarks;
  learnhub_cert_ingest: typeof learnhub_cert_ingest;
  learnhub_cert_ingest_node: typeof learnhub_cert_ingest_node;
  learnhub_certificates: typeof learnhub_certificates;
  learnhub_comments: typeof learnhub_comments;
  learnhub_conversations: typeof learnhub_conversations;
  learnhub_curated: typeof learnhub_curated;
  learnhub_events: typeof learnhub_events;
  learnhub_forms: typeof learnhub_forms;
  learnhub_google_credentials: typeof learnhub_google_credentials;
  learnhub_habits: typeof learnhub_habits;
  learnhub_journal: typeof learnhub_journal;
  learnhub_meet: typeof learnhub_meet;
  learnhub_mentors: typeof learnhub_mentors;
  learnhub_notifications: typeof learnhub_notifications;
  learnhub_org: typeof learnhub_org;
  learnhub_posts: typeof learnhub_posts;
  learnhub_progress: typeof learnhub_progress;
  learnhub_reports: typeof learnhub_reports;
  learnhub_schema: typeof learnhub_schema;
  learnhub_streaks: typeof learnhub_streaks;
  learnhub_users: typeof learnhub_users;
  learnhub_video_collab: typeof learnhub_video_collab;
  learnhub_video_courses: typeof learnhub_video_courses;
  learnhub_video_flow: typeof learnhub_video_flow;
  learnhub_work: typeof learnhub_work;
  learnhub_xp: typeof learnhub_xp;
  meetingHall: typeof meetingHall;
  otp: typeof otp;
  otpCodes: typeof otpCodes;
  personnel: typeof personnel;
  programMedia: typeof programMedia;
  projects: typeof projects;
  provinces: typeof provinces;
  resetTestSupervisor: typeof resetTestSupervisor;
  seedTestAccounts: typeof seedTestAccounts;
  sheetsActions: typeof sheetsActions;
  sheetsSync: typeof sheetsSync;
  subProjects: typeof subProjects;
  supervisorTools: typeof supervisorTools;
  supervisors: typeof supervisors;
  syncMonitor: typeof syncMonitor;
  testEnv: typeof testEnv;
  user_accounts: typeof user_accounts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
