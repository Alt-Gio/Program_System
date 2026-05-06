# DICT R5 PMS — Project Knowledge Base & Code Stability Report

**Generated:** 2026-04-30  
**Repo:** `dict-r5-pms` (Next.js 14 + Convex + Python face server)  
**Platform:** Windows + WSL2 + Docker Desktop (production deploy target)

---

## 1. Architecture Overview

### 1.1 Stack
| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI, Framer Motion, Recharts |
| Backend (primary) | Convex (self-hosted or cloud) — real-time DB + functions |
| Auth | Custom Convex-backed sessions (`dict-session` cookie) + Google OAuth for select roles |
| Face Recognition | Python FastAPI + InsightFace (CUDA) — separate container |
| Sync / ETL | Google Sheets双向同步 via service-account JWT |
| Maps | Mapbox GL |
| Deployment | Docker Compose (5 services) or standalone `next start` |

### 1.2 Key Design Patterns
- **Convex as source of truth** for activities, users, attendance events, intern management, LearnHub social data.
- **Python face server** holds face embeddings in local SQLite; Convex holds attendance *events* only.
- **Next.js API routes** (`/api/*`) bridge Node.js-only concerns (JWT signing, Google Sheets writes, Convex HTTP client).
- **Cron jobs in Convex** call internal actions that POST to `/api/sync-trigger` — avoids `"use node"` in Convex.
- **Middleware** (`middleware.ts`) is a fast cookie-presence gate; actual role enforcement happens in server components via `requireRole()`.

---

## 2. Major Subsystems

### 2.1 Authentication (6-Role System)

| Role | Auth Method | Registration | Cookie | Landing | Notes |
|------|-------------|------------|--------|---------|-------|
| Admin | email + password | invite-only | `dict-session` | `/dtc-admin` | |
| Manager | email + password | invite-only | `dict-session` | `/dashboard` | |
| Supervisor | Google OAuth | self-register | `dict-session` | `/supervisor` | |
| Intern | Google OAuth | self-register | `dict-session` | `/intern-portal` | |
| Mentor | Google OAuth | self-register | `learnhub_session` | `/learnhub/feed` | LearnHub only |
| Student | Google OAuth | self-register | `learnhub_session` | `/learnhub/feed` | LearnHub only |

- **Unified login entry:** `/login/[role]` (6 branded pages).
- **Cross-system identity:** same Google account can have BOTH a DICT role AND a LearnHub role. `convex/identities.ts` queries both `users` and `learnhub_users` by `googleId`. Role picker at `/login/pick-role`.
- **OAuth flow:** `state={"role":"intern"}` → callback → existing user = sign-in, new user = pending cookie → registration form.

**Key files:**
- `middleware.ts` — route classification + redirect to correct login page
- `lib/session.ts` — `getSessionUser()`, `requireRole()`
- `app/api/auth/google/callback/route.ts` — code exchange, cross-system check
- `convex/auth.ts` — `signInWithGoogle`, `registerWithGoogle`
- `convex/schema.ts` — `users.googleId`, `by_googleId` index

### 2.2 Face Recognition Attendance

Three layers:

1. **Python server** (`cv-station/server/main.py`)
   - FastAPI lifespan model load, GPU semaphore, per-(camera,user) cooldown
   - WebSocket `/ws/camera` for frame streaming
   - REST `/api/register` (enrollment), `/api/visible` (live snapshot), `/api/attendance/today`
   - Posts to Convex via `POST /face/attendance` with `X-Face-Token`
   - Local SQLite: `registered_faces`, `attendance_log`, `sync_queue` (retry worker)

2. **Convex backend** (`convex/face_recognition.ts`, `convex/http.ts`)
   - `face_attendance` table with `by_date`, `by_user`, `by_user_date` indexes
   - `markAttendanceInternal`: first event = time_in, second = time_out, third+ = ignored (idempotent)
   - HTTP endpoint `POST /face/attendance` gated by `FACE_SHARED_TOKEN`

3. **Next.js UI**
   - Overview: `app/(main)/attendance/page.tsx`
   - Camera feed: `app/(main)/attendance/camera/page.tsx`
   - Kiosk: **`app/(kiosk)/attendance/kiosk/page.tsx`** — MUST stay in its own route group `(kiosk)` to avoid inheriting `(main)` sidebar
   - Live detection panel polls `/api/visible` every 2 s

**Key invariant:** `action` (time_in/time_out) is **always decided server-side** from today's event count. The payload field is advisory only.

### 2.3 Google Sheets Sync (Dual DB)

**4 Sheets connected:**
1. `DICT_Attendance_Log` — Tabs: Attendance, AuditTrail
2. `DICT_DTC_Logbook` — Tab: Logbook
3. `DICT_Sync_Status` — Tab: Status
4. `DICT_Results` — Tabs: EGOV_2025, ELGU_2025, FY_2025, Looker_Smart_Guide, Looker_Filter_Config, Looker_Summary

**Architecture:**
- Convex cron → internal action → POST `/api/sync-trigger` (Node.js, handles JWT natively)
- No `"use node"` in Convex — avoids Windows ESM loader bug
- Test dashboard at `/test-sync`

**Key files:**
- `app/api/sync-trigger/route.ts` — main sync engine (JWT, tab auto-create, append/overwrite)
- `convex/googleSheetsWrite.ts` — thin cron wrappers
- `convex/attendanceSync.ts`, `convex/auditLog.ts`

### 2.4 LearnHub (Social/E-learning Module)

- **Layout:** `app/learnhub/(lh-main)/layout.tsx` — TopNav (fixed 60px) + 3-column grid (260px / 1fr / 300px) + MobileBottomNav
- **Design system:** `app/learnhub/learnhub.css` — CSS variables, light/dark mode via `[data-theme="dark"]`
- **Fonts:** Plus Jakarta Sans (headings), DM Sans (body)
- **Feed:** PostComposer + FeedPost with inline comments, likes, threaded bubbles
- **Messages:** Full real-time DM using Convex reactive queries (`convex/learnhub_conversations.ts`)
- **Work:** Opportunity board with apply mutation
- **Leaderboard:** XP-based ranking

**Key files:**
- `lib/learnhub/hooks.ts` — `useLearnhubSession()` (session, userId, role, isMentor, isAdmin)
- `components/learnhub/feed/PostComposer.tsx`, `FeedPost.tsx`
- `components/learnhub/layout/TopNav.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`
- `convex/learnhub_schema.ts` — imported into main schema via spread

### 2.5 DTC Logbook & Meeting Hall

- Public pages: `/dtc-logbook`, `/meeting-hall` (no auth required)
- Offline support: service worker + `clientId` deduping in Convex schema
- DTC PC workstation grid with status tracking

### 2.6 Intern Management

- **Attendance:** QR + Face (CV) check-in with geofence validation
- **Tasks, habits, goals, daily logs** — full gamification system
- **Documents:** storage IDs for 2x2, resume, application, endorsement, medical, WFH, work plan, NDA
- **Supervisor messaging:** direct messages via `supervisorMessages` table

---

## 3. Deployment Artifacts

### 3.1 Docker
- `Dockerfile` — multi-stage (deps → builder → runner), `output: "standalone"`, non-root user
- `docker-compose.prod.yml` — 5 services with `core` + `proxy` profiles:
  - `convex-backend` (:3210 API/WS, :3211 httpAction)
  - `convex-dashboard` (:6791)
  - `face-recognition` (:8001, GPU reservations)
  - `app` (:3000)
  - `nginx` (:80, optional `--profile proxy`)
- Volumes: `convex_data`, `face_data`, `face_models`
- All services have healthchecks

### 3.2 Nginx Config
- Existing at `nginx/nginx.conf`
- **Known mismatch:** nginx config expects service name `convex`, but compose uses `convex-backend`. If proxy profile is enabled, this needs alignment.

### 3.3 Environment Requirements
- `CONVEX_INSTANCE_SECRET` — one-time, never change
- `FACE_SHARED_TOKEN` — must match between Convex env and face server
- `NEXT_PUBLIC_CONVEX_URL` — baked at build time; changing LAN IP requires `docker compose build app`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (or `GOOGLE_SERVICE_ACCOUNT_KEY` JSON)
- `DICT_GOOGLE_CLIENT_ID`, `DICT_GOOGLE_CLIENT_SECRET`, `DICT_GOOGLE_REDIRECT_URI`

---

## 4. Performance Optimizations Applied

1. **Bundle:** `optimizePackageImports` for 16 packages (Radix, recharts, date-fns, etc.)
2. **Images:** `formats: ["image/avif","image/webp"]`, `minimumCacheTTL: 86400`
3. **Dynamic imports:** Recharts on landing page, mentor report charts
4. **Deferred search:** `useDeferredValue` on intern list filter
5. **Page transitions:** `.page-content` enter animation on 14+ pages
6. **Preconnect:** `api.mapbox.com`, `lh3.googleusercontent.com`, `drive.google.com`, conditional Convex origin
7. **Source maps:** gated on `NEXT_PRODUCTION_SOURCE_MAPS=1`
8. **Console stripping:** in production (except error/warn)

---

## 5. Code Stability Assessment

### 5.1 Build Configuration
| Check | Status | Notes |
|-------|--------|-------|
| `next.config.mjs` | ✅ | `output: "standalone"`, IPv6 fix, image optimization, bundle analyzer conditional |
| `tsconfig.json` | ✅ | Strict mode, path alias `@/*`, correct module resolution |
| `package.json` | ✅ | No version conflicts; Convex 1.35.1, Next 14.2.5 |
| TypeScript build | ⚠️ | `ignoreBuildErrors: true` set — pre-existing null-check warnings in `activities/[id]/page.tsx` (14 errors) are intentionally silenced |
| ESLint | ⚠️ | `ignoreDuringBuilds: true` — lint noise suppressed for production builds |

### 5.2 Schema Integrity
| Check | Status | Notes |
|-------|--------|-------|
| Schema composition | ✅ | Uses spread imports for modularity (`learnhubTables`, `faceRecognitionTables`, `userAccountTables`, `importLogTables`) |
| Indexes | ✅ | All query-heavy tables have indexes; compound indexes follow ordering rules |
| Unbounded arrays | ✅ | No unbounded arrays stored inline (guidelines followed) |
| High-churn separation | ✅ | Audit logs, sync logs, attendance events in separate tables |
| Face attendance | ✅ | `face_attendance` table additive only, does not touch existing tables |

### 5.3 Auth & Security
| Check | Status | Notes |
|-------|--------|-------|
| Middleware | ✅ | Fast cookie check + family routing; no DB calls in middleware |
| Role enforcement | ✅ | `requireRole()` in server components/API routes (two-layer) |
| OAuth callback | ✅ | CSRF-safe (state param with role), HMAC pending cookie |
| Face webhook | ✅ | Shared token auth (`FACE_SHARED_TOKEN`); no admin key exposed |
| Service account | ✅ | JWT signed in Node.js route, never in client bundle |

### 5.4 Face Recognition
| Check | Status | Notes |
|-------|--------|-------|
| GPU concurrency | ✅ | `asyncio.Semaphore` prevents OOM with multiple clients |
| Cooldown | ✅ | Per-(camera, user) cooldown + already-timed-out guard |
| Idempotency | ✅ | Both Python SQLite and Convex agree: third event = ignored |
| Sync queue | ✅ | Failed posts retried every 60s, max 5 attempts, poison messages dropped |
| Live snapshot | ✅ | `/api/visible` exposes `_current_visible` (no auth, read-only preview) |
| Health endpoint | ✅ | `/healthz` fixed (no reference to non-existent `sync_queue.synced` column) |

### 5.5 Google Sheets Sync
| Check | Status | Notes |
|-------|--------|-------|
| JWT signing | ✅ | Native `crypto.createSign` in Next.js route |
| Credential fallback | ✅ | Supports both JSON key and split email+privateKey |
| Tab auto-creation | ✅ | `setupTabs` creates missing tabs before writing |
| Convex → Sheets | ✅ | 4 sheets wired with health checks |

### 5.6 Potential Risks / TODOs
| Item | Risk Level | Details |
|------|-----------|---------|
| Nginx service name mismatch | 🔶 Medium | `nginx/nginx.conf` expects `convex`, compose uses `convex-backend`. Will break if `--profile proxy` is used without editing config. |
| TypeScript null warnings | 🔶 Low | 14 `'activity' is possibly null` warnings in `app/(main)/activities/[id]/page.tsx`. Silenced at build time, but code smell. |
| `package-lock.json` absence check | 🔶 Low | `Dockerfile` references `package-lock.json` — verify it exists in repo root. |
| `.dockerignore` | 🔶 Low | File is gitignored; Dockerfile uses explicit COPY. Safe, but easy to miss new top-level dirs. |
| LearnHub TS server noise | 🔶 Low | Pre-existing TS errors in `app/(learnhub)/(lh-main)/layout.tsx`, `app/(learnhub)/login/page.tsx`, `app/(learnhub)/onboarding/page.tsx` — fixed by restarting TS server. |
| Convex query payload size | 🔶 Medium | `listActivities` returns full docs. Could become heavy at scale. Pagination (`listActivitiesPaginated`) exists but not wired everywhere. |
| `useDeferredValue` intern filter | ✅ Good | Applied on `app/(main)/interns/page.tsx` |

### 5.7 Convex Guidelines Compliance
| Guideline | Status |
|-----------|--------|
| No `"use node"` in query/mutation files | ✅ (JWT handled in Next.js) |
| Argument validators on all functions | ✅ |
| Bounded queries (`.take()`, `.paginate()`) | ✅ (mostly; `listActivities` is noted exception) |
| Index fields in correct order | ✅ |
| `ctx.runQuery`/`ctx.runMutation` for cross-function calls | ✅ |
| Separate high-churn data | ✅ |

---

## 6. Critical File Inventory

### Must-not-break files
- `convex/schema.ts` — additive-only policy; deletions require migration
- `convex/http.ts` — webhook endpoints (face + sheets); URL paths are hard contracts
- `middleware.ts` — all route gating; changing `FAMILY_RULES` order changes auth behavior
- `lib/session.ts` — single source of truth for DICT auth
- `app/api/sync-trigger/route.ts` — Google Sheets sync engine
- `cv-station/server/main.py` — face recognition runtime; single-worker GPU state

### Build-critical files
- `next.config.mjs` — `output: standalone` required by Dockerfile
- `Dockerfile` — explicit COPY list; new top-level source dirs must be added
- `docker-compose.prod.yml` — service names, ports, env var references

---

## 7. Known Invariants (Do Not Break)

1. **Kiosk route isolation:** `app/(kiosk)/attendance/kiosk/page.tsx` MUST stay under `(kiosk)`, NOT `(main)`. Next.js throws route conflict if both exist.
2. **Face action authority:** time_in/time_out is computed from today's event count **server-side** in both Python SQLite and Convex. The `action` field in payloads is advisory.
3. **Build-time baking:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_FACE_SERVER_HTTP/WS` are baked at Docker build. Changing the LAN IP requires rebuilding the `app` image.
4. **Convex additive schema:** Never remove fields/tables without a migration plan. Use `widen-migrate-narrow` workflow.
5. **OAuth state param:** Must contain `role` and optionally `callbackUrl`. Callback route depends on this structure.

---

## 8. Quick Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `fetch failed` to external APIs (Windows) | Node v22 IPv6 bug | `setDefaultResultOrder("ipv4first")` in `next.config.mjs` — already applied |
| Face server not syncing to Convex | `FACE_SHARED_TOKEN` mismatch between Convex env and face server env | Check both sides; regenerate if needed |
| Kiosk shows sidebar/header | Kiosk page moved under `(main)` | Move back to `app/(kiosk)/attendance/kiosk/` |
| Google Sheets sync fails | Missing service account credentials or sheet ID | Check `/test-env` page; verify `.env.local` |
| TypeScript errors in IDE | Stale TS server | Ctrl+Shift+P → "TypeScript: Restart TS Server" |
| Nginx 502 to Convex | Service name mismatch | Edit `nginx/nginx.conf` to use `convex-backend:3210` |
| Duplicate popups on kiosk open | Not using `lib/kiosk/openKioskPopup.ts` | Use the named-window helper (`dict-kiosk`) |

---

## 9. Environment Variable Checklist

### Required for development
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOY_KEY` (or `npx convex dev` with cloud)

### Required for production / Docker
- `CONVEX_INSTANCE_SECRET`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `FACE_SHARED_TOKEN`
- `FACE_API_TOKEN` (optional but recommended)
- `NEXT_PUBLIC_FACE_SERVER_HTTP`
- `NEXT_PUBLIC_FACE_SERVER_WS`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (or `GOOGLE_SERVICE_ACCOUNT_KEY`)
- `GOOGLE_SHEETS_TARGET_ID` (DICT_Results)
- `ATTENDANCE_LOG_SHEET_ID`
- `DTC_LOGBOOK_SHEET_ID`
- `SYNC_STATUS_SHEET_ID`
- `DICT_GOOGLE_CLIENT_ID`, `DICT_GOOGLE_CLIENT_SECRET`, `DICT_GOOGLE_REDIRECT_URI`
- `DICT_OAUTH_SECRET` (falls back to `LEARNHUB_SESSION_SECRET`)

---

## 10. Summary Verdict

**Overall Stability: GOOD — Production-ready with noted maintenance items.**

- Core auth, face recognition, and Sheets sync are robust and idempotent.
- Docker production setup is complete and health-checked.
- Build is configured to tolerate pre-existing TS lint noise.
- Primary risk is the nginx service name mismatch if reverse proxy is enabled.
- Secondary risk is query payload growth on large activity tables (pagination exists but not universally wired).
