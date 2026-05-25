# Codebase Concerns

**Analysis Date:** 2026-05-23

---

## Security Considerations

**[CRITICAL] Audit logs not scoped to current org**
- Risk: Any authenticated admin can read audit logs from all organizations in the database. `org.getAuditLogs` fetches with `ctx.db.auditLog.findMany({ take: input.limit })` — no `orgId` filter is applied.
- Files: `server/routers/org.ts` lines 453–461
- Current mitigation: Admin-role check is enforced, but the SQL query has no org boundary.
- Recommendation: Add `where: { actorUserId: { in: orgMemberUserIds } }` or add `orgId` to the `AuditLog` model and filter on it.

**[HIGH] In-memory rate limiter loses state on restart**
- Risk: The rate limiter in `server/rateLimit.ts` stores state in a `Map` on the Node.js heap. Every Render deployment restart (which happens on every deploy and after inactivity) clears all rate-limit buckets, completely resetting brute-force protection.
- Files: `server/rateLimit.ts`, `app/api/auth/[...nextauth]/route.ts`, `server/routers/auth.ts`
- Current mitigation: None — limits reset to zero on every cold start.
- Recommendation: Move rate limit state to Redis or use a persistent counter (e.g., Upstash Redis). For quick wins, add Render's persistent disk or use Vercel Edge Config.

**[HIGH] Debug console.log statements in production auth handler**
- Risk: The NextAuth authorize callback logs the normalized email address and IP of every login attempt to stdout: `console.log("[Auth] Normalized email:", normalizedEmail)`. This creates PII exposure in server logs and reveals user enumeration patterns if logs are ever compromised.
- Files: `app/api/auth/[...nextauth]/route.ts` lines 36–94 (11 console.log calls)
- Current mitigation: None.
- Recommendation: Remove all `console.log` calls. Replace `console.error` with a structured logger that redacts PII.

**[HIGH] JWT session maxAge is 10 minutes — likely too short**
- Risk: Sessions expire after 10 minutes (`maxAge: 10 * 60`). The app does not appear to implement silent token refresh. Users will be silently logged out mid-task, especially during the multi-step weekly session flow, with no graceful recovery.
- Files: `app/api/auth/[...nextauth]/route.ts` line 108
- Current mitigation: None detected in the frontend.
- Recommendation: Increase to a sensible value (e.g., 8 hours) or implement a sliding session. If short sessions are intentional for security, add a proactive "session expiring" warning and auto-refresh mechanism.

**[MEDIUM] Microsoft/Azure SSO users bypass invite-only enforcement**
- Risk: The `signIn` callback for `azure-ad` only verifies the user already exists in the database. It does not check if the sign-in originated from a valid, unexpired invite token. New Microsoft accounts that happen to match an org domain could be created outside the invite flow.
- Files: `app/api/auth/[...nextauth]/route.ts` lines 111–119
- Current mitigation: The user must already exist (`Boolean(existingUser)`), limiting creation, but users can only be created via the `/api/signup` route which does enforce invite tokens.
- Recommendation: Acceptable as-is if Microsoft SSO is only intended for returning users. Document this explicitly.

**[MEDIUM] Signup endpoint does not sanitize or length-limit the `name` field**
- Risk: `name` is accepted as-is from request JSON with no max length or HTML sanitation. Very long names or HTML/script strings are persisted to the database and rendered into the UI.
- Files: `app/api/signup/route.ts` line 9, `4dx-frontend/app/signup/page.tsx`
- Recommendation: Add `name: z.string().min(1).max(100).trim()` validation to the signup route.

---

## Technical Debt

**[HIGH] Pervasive `(ctx.session.user as any).id` pattern — 97 occurrences**
- Issue: Every protected procedure casts the session user to `any` to access `.id`. This bypasses TypeScript's type system across the entire server layer, meaning a session shape change would silently break all auth checks without compile-time warning.
- Files: All router files — `server/routers/wigs.ts`, `sessions.ts`, `teams.ts`, `activityLogs.ts`, `leadMeasures.ts`, `org.ts`, `auth.ts`, `notifications.ts` (97 total occurrences across 12 files)
- Fix approach: Extend the NextAuth session/JWT type declarations in `types/next-auth.d.ts` so `session.user.id` is typed as `string`. Eliminate all `as any` casts.

**[HIGH] Two conflicting router files for the same domain: `session.ts` vs `sessions.ts`, `leadMeasure.ts` vs `leadMeasures.ts`**
- Issue: `server/routers/session.ts` (382 lines) and `server/routers/sessions.ts` (575 lines) both export a `sessionsRouter`. `server/routers/leadMeasure.ts` (62 lines, missing `ownerUserIds`) and `server/routers/leadMeasures.ts` (169 lines) both define lead measure creation. The app router (`_app.ts`) imports only the pluralized versions, leaving the singular files as dead code that can mislead developers.
- Files: `server/routers/session.ts`, `server/routers/sessions.ts`, `server/routers/leadMeasure.ts`, `server/routers/leadMeasures.ts`
- Impact: Confusion about which is canonical; `session.ts` has an `isObserver` helper and `OBSERVER` role support not present in `sessions.ts`.
- Fix approach: Delete `server/routers/session.ts` and `server/routers/leadMeasure.ts`. Migrate the `isObserver` helper and `OBSERVER` role guard into `sessions.ts` if still needed.

**[HIGH] `getThisMonday()` duplicated 6+ times across codebase**
- Issue: The function is copy-pasted into `server/routers/sessions.ts`, `server/routers/session.ts`, `app/api/cron/generate-sessions/route.ts`, `app/api/cron/mark-overdue/route.ts`, `scripts/generate-weekly-sessions.ts`, and `scripts/mark-overdue-sessions.ts`. Any timezone edge-case fix must be applied in 6 places.
- Files: All locations listed above
- Fix approach: Extract to `server/lib/dateUtils.ts` and import everywhere.

**[MEDIUM] Frontend uses `as any` to access tRPC procedures — 32 occurrences**
- Issue: Large portions of `4dx-frontend/lib/hooks.ts` cast `trpc.teams`, `trpc.auth`, and `trpc.notifications` to `any` before calling procedure hooks. This defeats tRPC's end-to-end type safety — the main value proposition of using tRPC.
- Files: `4dx-frontend/lib/hooks.ts` lines 101, 124, 141, 343, 575, 590, 605, 620, 632, 644, 671, 693, 707, 719
- Fix approach: Set up the shared tRPC type from the backend's `AppRouter` in the frontend's `trpc.ts` config and use the fully typed client throughout.

**[MEDIUM] `wigs/page.tsx` exceeds 800-line file limit (901 lines)**
- Issue: The WIGs page bundles creation, activation, closing, editing WIGs and lead measures, and history display in a single file. This violates the project's 800-line max convention and makes the file difficult to maintain.
- Files: `4dx-frontend/app/dashboard/wigs/page.tsx` (901 lines)
- Fix approach: Extract `WIGDetail`, `CreateWIGForm`, `LeadMeasureSection`, and `WIGHistory` into separate component files under `4dx-frontend/lib/components/wigs/`.

**[MEDIUM] `session.ts` dead code contains `OBSERVER` role logic not in active router**
- Issue: `server/routers/session.ts` has an `isObserver` guard and `OBSERVER` role handling that is not present in the active `sessions.ts` router. The schema defines `OBSERVER` in `TeamRole` but the active router never checks it, meaning observers currently get the same access as regular members.
- Files: `server/routers/session.ts`, `prisma/schema.prisma` (TeamRole enum)
- Fix approach: Decide if OBSERVER role is a planned feature. If yes, port the guard to `sessions.ts`. If no, remove `OBSERVER` from the schema.

**[LOW] `signup/route.ts` creates its own Prisma client instance (`createPrismaClient()`)**
- Issue: The signup route bypasses the shared `db` singleton from `server/db.ts` and creates a new `PrismaClient` instance per request. This can exhaust the database connection pool under concurrent signups.
- Files: `app/api/signup/route.ts` lines 5–6
- Fix approach: Replace `const db = createPrismaClient()` with `import { db } from "@/server/db"`.

---

## Performance Bottlenecks

**[HIGH] N+1 query in session generation cron: `findFirst` inside nested for-loop**
- Problem: `app/api/cron/generate-sessions/route.ts` runs a `db.weeklySession.findFirst` query for every `(member, wig)` pair inside a nested `for` loop. For an org with 10 teams × 20 members × 2 WIGs, that is 400 sequential database roundtrips before any session is created.
- Files: `app/api/cron/generate-sessions/route.ts` lines 36–49; same pattern in `scripts/generate-weekly-sessions.ts` lines 57–64
- Cause: Existence check is not batched.
- Improvement path: Pre-fetch all existing sessions for the week in a single query, build a Set of `userId:wigId` keys, then filter `sessionsToCreate` from that Set.

**[HIGH] `activityLogs.getByUser` and `getByLeadMeasure` are unbounded — no pagination**
- Problem: Both queries fetch every activity log matching the filter with no `take` limit. A user who has logged activity daily for a year could return 300+ records in a single request.
- Files: `server/routers/activityLogs.ts` lines 317–373
- Improvement path: Add `take` and `cursor`-based or `skip`/`take` pagination. Add a `limit` input parameter defaulting to 50.

**[MEDIUM] `approveAllForTeam` runs N WIG aggregate queries sequentially via `Promise.all` + per-WIG UPDATE**
- Problem: `activityLogs.approveAllForTeam` runs a separate `activityLog.aggregate` + `wIG.update` pair for each active WIG. With 2 WIGs per team this is 4 queries; with many teams and WIGs this scales poorly.
- Files: `server/routers/activityLogs.ts` lines 167–184
- Improvement path: Use a grouped aggregate query with `groupBy: ['wigId']` to sum approved values for all WIGs in a single query, then batch-update.

**[MEDIUM] `wigs.getById` executes the same WIG lookup twice**
- Problem: The procedure first fetches the WIG to read `team.leadUserId`, then fetches it again with full `include`. This doubles the database work for every single WIG detail view.
- Files: `server/routers/wigs.ts` lines 286–328
- Improvement path: Merge into one query with the full include, using `wig.team.leadUserId` from the result for the access-control check.

---

## Operational Gaps

**[HIGH] Cron jobs split across two incompatible delivery mechanisms with no deduplication**
- Problem: Session generation is implemented as both a Render cron job (calling a standalone script via `pnpm cron:generate-sessions`) and a Next.js API route (`app/api/cron/generate-sessions/route.ts`). The `render.yaml` points the cron at the standalone script. If the API route is also called (e.g., by a Vercel cron from a prior deployment), sessions are created twice. Both implementations also have the same N+1 bug independently.
- Files: `render.yaml` lines 24–32, `app/api/cron/generate-sessions/route.ts`, `scripts/generate-weekly-sessions.ts`
- Improvement path: Pick one mechanism. Prefer the API route approach (uses shared `db` singleton, no ts-node dependency). Archive or delete the standalone scripts.

**[HIGH] No React Error Boundaries anywhere in the frontend**
- Problem: A JavaScript runtime error inside any dashboard component (e.g., accessing a property of `null` from an API response shape change) will crash the entire dashboard and show a blank screen. There are no error boundaries defined anywhere in `4dx-frontend/`.
- Files: `4dx-frontend/app/dashboard/layout.tsx`, all page files
- Impact: Any unhandled render error is invisible to the user and potentially undetected.
- Recommendation: Add a top-level `ErrorBoundary` in `4dx-frontend/app/dashboard/layout.tsx` and per-route boundaries for critical pages.

**[HIGH] No monitoring, alerting, or structured logging**
- Problem: There is no error tracking service (Sentry, Datadog, etc.) integrated. Server errors are logged only to `console.error`. Email send failures are silently swallowed (`sendWigClosedEmail(...).catch(() => {})` and similar). Cron failures have no alerting path.
- Files: `server/audit.ts` line 55, `server/email.ts` lines 70/98/127/152/179/205, `server/routers/wigs.ts` line 199
- Impact: Production failures are invisible until a user reports them.
- Recommendation: Integrate Sentry (or equivalent) for backend error tracking. Replace fire-and-forget email error handling with logged failures.

**[MEDIUM] Render cron for "wigs at risk notifications" has no corresponding API route**
- Problem: `render.yaml` schedules `pnpm notify:wigs-at-risk` daily, but there is no `app/api/cron/` route for it — only the standalone script at `scripts/check-wigs-at-risk.ts`. The script uses `ts-node` with CommonJS mode. If ts-node is unavailable in the Render environment or path resolution fails, this cron silently does nothing.
- Files: `render.yaml` lines 44–50
- Impact: WIG-at-risk notifications may never fire in production.
- Recommendation: Implement an API route equivalent for this cron, consistent with the session generation and overdue-marking routes.

**[MEDIUM] `mark-overdue` cron runs on Tuesday but calls `getThisMonday()`**
- Problem: `app/api/cron/mark-overdue/route.ts` is scheduled `0 9 * * 2` (Tuesday 09:00 UTC) and marks sessions from the current week's Monday as OVERDUE. However `getThisMonday()` returns Monday of the *current* week — on Tuesday, this correctly computes the prior Monday. The behavior is correct but only by coincidence of scheduling. If the cron is ever rescheduled to Wednesday or later, it will re-mark already-OVERDUE sessions from the wrong week.
- Files: `app/api/cron/mark-overdue/route.ts`
- Recommendation: Add a comment documenting this coupling, or compute `getPreviousMonday()` explicitly instead of relying on schedule timing.

**[LOW] `notification.createMany` in `mark-overdue` bypasses `notifyMany()` helper**
- Problem: The mark-overdue cron writes notifications directly via `db.notification.createMany()` using `as any` to cast the data shape, bypassing the `notifyMany` helper used everywhere else.
- Files: `app/api/cron/mark-overdue/route.ts` line 58
- Recommendation: Refactor to use `notifyMany()` for consistency and type safety.

---

## Missing Features / Frontend-Backend Gaps

**[HIGH] No invite management UI — invites exist in the backend but are not surfaced**
- Problem: The backend has a complete `invitesRouter` registered in `_app.ts` with token creation, validation, and revocation. The frontend has no UI for admins to create invite links or view pending invites. The only way to onboard new users is by directly generating tokens in the database.
- Files: `server/routers/invites.ts` (backend), no corresponding frontend pages
- Blocks: Any real user onboarding.
- Recommendation: Build an admin invite page under `/dashboard/admin/users/invite`.

**[HIGH] Session page cannot recover a partially-completed session**
- Problem: If a user completes the Account step (`accountDoneAt` is set) but then closes the browser, returning to `/dashboard/session` sets `step` back to `0`. The session correctly shows `IN_PROGRESS` status but the UI re-renders step 0. There is no logic to initialize `step` from the session's `accountDoneAt`/`reviewDoneAt`/`commitDoneAt` fields.
- Files: `4dx-frontend/app/dashboard/session/page.tsx` lines 18, 26–30
- Impact: Users who partially complete a session and return will be confused by the step display.
- Fix approach: Initialize `step` based on which step timestamps are set on `selectedSession`.

**[MEDIUM] `OBSERVER` TeamRole in schema is unused in the active codebase**
- Problem: `prisma/schema.prisma` defines `OBSERVER` in the `TeamRole` enum. The `OrgUser` type in `4dx-frontend/lib/types.ts` includes `"OBSERVER"` in the teamMembership role union. However, no router procedure handles OBSERVER differently from MEMBER, and no UI assigns or displays the OBSERVER role.
- Files: `prisma/schema.prisma`, `4dx-frontend/lib/types.ts` line 52, `server/routers/session.ts` (dead code only)
- Recommendation: Either remove `OBSERVER` from the schema (breaking change requiring migration) or implement OBSERVER access control in `sessions.ts` and the frontend.

**[MEDIUM] Activity log edit UI not exposed — backend supports it, frontend does not**
- Problem: `server/routers/activityLogs.ts` has a complete `edit` mutation (24-hour window, audit-logged). `4dx-frontend/lib/hooks.ts` exports `useEditActivity()`. However, no frontend page or component renders an edit button or form on activity log entries.
- Files: `server/routers/activityLogs.ts` lines 253–313, `4dx-frontend/lib/hooks.ts` lines 484–494, `4dx-frontend/app/dashboard/activity/page.tsx`
- Recommendation: Add an edit inline action on each activity log row in `/dashboard/activity`.

**[MEDIUM] `getTeamSessions` with `weekStarting` parameter has no frontend pagination/history control**
- Problem: `sessions.getTeamSessions` accepts an optional `weekStarting` filter to view historical sessions, but the Team Lead dashboard's sessions hook always omits the parameter (defaulting to the current week). There is no UI to navigate to previous weeks.
- Files: `server/routers/sessions.ts` lines 511–563, `4dx-frontend/lib/hooks.ts` lines 232–244
- Recommendation: Add a week-picker to the team sessions view on `/dashboard/team-lead/reports`.

**[LOW] `ApiKey` model exists in schema but no router or UI is implemented**
- Problem: `prisma/schema.prisma` defines an `ApiKey` model with full lifecycle fields (`expiresAt`, `lastUsedAt`, `revokedAt`). No router creates, lists, or revokes API keys. No frontend page exists.
- Files: `prisma/schema.prisma` lines 340–352
- Recommendation: Either implement API key management or remove the model to avoid schema confusion.

---

## Test Coverage Gaps

**[CRITICAL] Zero automated tests exist in the entire project**
- What's not tested: All business logic — WIG activation gates, session step sequencing, activity log approval, invite token enforcement, rate limiting, cron job logic.
- Files: No `*.test.*` or `*.spec.*` files found anywhere in the project.
- Risk: Any refactor of the multi-step session flow, WIG activation rules, or auth logic can silently break without detection. The cron N+1 bug and the audit log cross-org leak cannot be caught by CI.
- Priority: HIGH — production launch without any test coverage is high risk for a workflow platform where data integrity (activity approval, session completion) is the core product value.
- Recommendation: Start with integration tests for the critical business rules: WIG activation enforcement, session step gating, and the cron session generation idempotency.

---

*Concerns audit: 2026-05-23*
