/**
 * Phase 9.D — Seed starter learning paths.
 *
 * Idempotent: skips any path with a title that already exists. Modules
 * start with empty `postIds` arrays — the author/admin can attach posts
 * later via the path edit UI. Each path is created as published + public
 * so the browse surface and onboarding step 5 have content from day one.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type SeedModule = {
  order: number;
  title: string;
  postIds: Id<"learnhub_posts">[];
  completionRequirements: {
    watchPercent?: number;
    formPassingScore?: number;
  };
};

type SeedPath = {
  title: string;
  description: string;
  programType: string;
  estimatedWeeks: number;
  coverEmoji: string;
  coverColor: string;
  modules: SeedModule[];
};

const STARTER_PATHS: SeedPath[] = [
  {
    title: "Full-Stack Web Foundations",
    description:
      "Learn HTML, CSS, JavaScript, and a backend framework end-to-end. From your first webpage to a deployed app, with checkpoints along the way.",
    programType: "SPARK",
    estimatedWeeks: 12,
    coverEmoji: "🌐",
    coverColor: "#5b6cff",
    modules: [
      {
        order: 1,
        title: "HTML + CSS basics",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 2,
        title: "JavaScript essentials",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 3,
        title: "Working with APIs",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 4,
        title: "Frontend frameworks (React intro)",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 5,
        title: "Backend basics + databases",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 6,
        title: "Deploy your first app",
        postIds: [],
        completionRequirements: { formPassingScore: 70 },
      },
    ],
  },
  {
    title: "Digital Literacy Basics",
    description:
      "Practical computer skills for everyday work — file management, online safety, productivity tools, and effective communication.",
    programType: "Tech4ED",
    estimatedWeeks: 6,
    coverEmoji: "💻",
    coverColor: "#ff5f6d",
    modules: [
      {
        order: 1,
        title: "Navigating your computer",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 2,
        title: "Browsing the web safely",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 3,
        title: "Email + messaging etiquette",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 4,
        title: "Productivity tools (Docs, Sheets)",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 5,
        title: "Online safety + privacy",
        postIds: [],
        completionRequirements: { formPassingScore: 70 },
      },
    ],
  },
  {
    title: "Public Speaking Mastery",
    description:
      "Build the confidence and craft to speak to any audience. Covers structure, body language, voice control, and handling Q&A.",
    programType: "SPARK",
    estimatedWeeks: 4,
    coverEmoji: "🎤",
    coverColor: "#22d3a0",
    modules: [
      {
        order: 1,
        title: "Structuring a talk",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 2,
        title: "Voice + body language",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 3,
        title: "Handling nerves + Q&A",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 4,
        title: "Practice talk + peer review",
        postIds: [],
        completionRequirements: { formPassingScore: 70 },
      },
    ],
  },
  {
    title: "Data Analysis with Spreadsheets",
    description:
      "Turn raw data into insights. Master formulas, pivot tables, charts, and basic statistics using Google Sheets or Excel.",
    programType: "DWIA",
    estimatedWeeks: 8,
    coverEmoji: "📊",
    coverColor: "#22d3a0",
    modules: [
      {
        order: 1,
        title: "Spreadsheet fundamentals",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 2,
        title: "Essential formulas",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 3,
        title: "Pivot tables + summaries",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 4,
        title: "Charts + visualization",
        postIds: [],
        completionRequirements: { watchPercent: 80 },
      },
      {
        order: 5,
        title: "Basic statistics + reporting",
        postIds: [],
        completionRequirements: { formPassingScore: 70 },
      },
    ],
  },
];

export const seedStarterPaths = mutation({
  args: { actorId: v.id("learnhub_users") },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Actor not found");
    if (actor.role !== "admin" && actor.role !== "coordinator") {
      throw new Error("Only admins or coordinators can seed starter paths");
    }

    const existing = await ctx.db.query("learnhub_learning_paths").collect();
    const existingTitles = new Set(existing.map((p) => p.title));

    let created = 0;
    for (const seed of STARTER_PATHS) {
      if (existingTitles.has(seed.title)) continue;
      await ctx.db.insert("learnhub_learning_paths", {
        createdBy: args.actorId,
        title: seed.title,
        description: seed.description,
        programType: seed.programType,
        modules: seed.modules,
        estimatedWeeks: seed.estimatedWeeks,
        prerequisitePathIds: [],
        enrollmentCount: 0,
        createdAt: Date.now(),
        visibility: "public",
        published: true,
        coverEmoji: seed.coverEmoji,
        coverColor: seed.coverColor,
      });
      created++;
    }

    return { created, skipped: STARTER_PATHS.length - created };
  },
});
