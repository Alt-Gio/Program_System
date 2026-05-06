import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * DICT access gate.
 *
 * Public routes need no session. Every other route requires a valid
 * `dict-session` cookie. The middleware does a cheap cookie-presence
 * check + route-to-role-family match; per-page role verification is
 * done server-side with requireRole() from lib/session.ts (which hits
 * Convex). That two-layer setup keeps middleware fast and correct.
 *
 * Role families:
 *   - intern-portal : intern, supervisor
 *   - supervisor    : supervisor only
 *   - admin-area    : admin, manager
 *   - account       : any authenticated user (e.g. /account, /settings-personal)
 */

type Family = "intern-portal" | "supervisor" | "admin-area" | "account" | "learnhub";

// Exact paths that anyone can hit without signing in.
const PUBLIC_EXACT = new Set<string>([
  "/",
  "/dtc-logbook",
  "/meeting-hall",
  "/event",
  "/accept-invite",
  "/bootstrap",
  "/signup", // invite-only info page; links to /login
  // LearnHub login (backward compat)
  "/learnhub/login",
  "/learnhub/onboarding",
  "/learnhub/login/mentor/invite",
]);

// Prefix matchers for paths that are always public (no session needed)
const PUBLIC_PREFIXES = [
  "/learnhub/verify/",
  "/login",           // unified sign-in carousel + /login/register/* + /login/pick-role
];

// Prefix matchers for the family each route tree belongs to.
// Order matters: the first match wins.
const FAMILY_RULES: Array<{ prefix: string; family: Family }> = [
  { prefix: "/learnhub", family: "learnhub" },
  { prefix: "/intern-portal", family: "intern-portal" },
  { prefix: "/intern/", family: "intern-portal" },
  { prefix: "/intern", family: "intern-portal" }, // /intern itself
  { prefix: "/supervisor", family: "supervisor" },
  { prefix: "/dtc-admin", family: "admin-area" },
  { prefix: "/interns", family: "admin-area" },
  { prefix: "/activities", family: "admin-area" },
  { prefix: "/projects", family: "admin-area" },
  { prefix: "/dashboard", family: "admin-area" },
  { prefix: "/personnel", family: "admin-area" },
  { prefix: "/settings", family: "admin-area" },
  { prefix: "/map", family: "admin-area" },
  { prefix: "/reports", family: "admin-area" },
  { prefix: "/attendance-overview", family: "admin-area" },
  { prefix: "/test-", family: "admin-area" },
  { prefix: "/reset-supervisor", family: "admin-area" },
  { prefix: "/intern-logbook", family: "admin-area" },
];

function classify(pathname: string): Family | "public" | "account" {
  if (PUBLIC_EXACT.has(pathname)) return "public";
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return "public";
  for (const rule of FAMILY_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
      return rule.family;
    }
  }
  // Unknown authenticated route — treat as any-logged-in-user.
  return "account";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const kind = classify(pathname);

  if (kind === "public") {
    return NextResponse.next();
  }

  // ── LearnHub paths use a separate session cookie ──
  if (kind === "learnhub") {
    const lhToken = request.cookies.get("learnhub_session")?.value;
    if (!lhToken) {
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({
      request: {
        headers: new Headers({
          ...Object.fromEntries(request.headers),
          "x-dict-route-family": "learnhub",
        }),
      },
    });
  }

  // ── Existing DICT system: uses dict-session cookie ──
  const token = request.cookies.get("dict-session")?.value;
  if (!token) {
    // Route to the appropriate role login page based on family
    const loginPath =
      kind === "admin-area" ? "/login"
      : kind === "supervisor" ? "/login"
      : kind === "intern-portal" ? "/login"
      : "/login"; // unified login carousel for all fallbacks
    const url = new URL(loginPath, request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Pass the resolved family to downstream server components via a request
  // header so layouts can short-circuit without re-computing. Actual role
  // enforcement still happens in server components via requireRole().
  const res = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers),
        "x-dict-route-family": kind,
      }),
    },
  });
  return res;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};
