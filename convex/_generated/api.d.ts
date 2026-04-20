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
import type * as files from "../files.js";
import type * as gamification from "../gamification.js";
import type * as googleSheetsWrite from "../googleSheetsWrite.js";
import type * as highlightFields from "../highlightFields.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as internAuth from "../internAuth.js";
import type * as internPortal from "../internPortal.js";
import type * as internPublic from "../internPublic.js";
import type * as internSheetsSync from "../internSheetsSync.js";
import type * as internTasks from "../internTasks.js";
import type * as interns from "../interns.js";
import type * as otpCodes from "../otpCodes.js";
import type * as personnel from "../personnel.js";
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
  files: typeof files;
  gamification: typeof gamification;
  googleSheetsWrite: typeof googleSheetsWrite;
  highlightFields: typeof highlightFields;
  http: typeof http;
  images: typeof images;
  internAuth: typeof internAuth;
  internPortal: typeof internPortal;
  internPublic: typeof internPublic;
  internSheetsSync: typeof internSheetsSync;
  internTasks: typeof internTasks;
  interns: typeof interns;
  otpCodes: typeof otpCodes;
  personnel: typeof personnel;
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
