# Architecture

**Analysis Date:** 2026-05-23

## Pattern Overview

**Overall:** Two-Next.js-app monorepo — a backend API app (root `/`) and a separate frontend app (`4dx-frontend/`), communicating exclusively over tRPC HTTP. Both are deployed as separate Render web services from the same git repository.

**Key Characteristics:**
- Root app owns all data access: Prisma, tRPC routers, NextAuth, and REST cron endpoints
- Frontend app is a pure UI consumer — no direct DB access, no Prisma, no server-side business logic
- tRPC provides end-to-end type safety; the frontend imports `AppRouter` type to get full inference
- JWT session (10-minute max-age) carries user identity between apps via NextAuth cookies

## Two-App Relationship

**Root App (Backend, port 3001):**
- Location: `./` (repo root)
- Role: API server. Exposes `/api/trpc/[trpc]`, `/api/auth/[...nextauth]`, `/api/signup`, `/api/cron/*`, `/api/health`, `/api/v1/*`
- Owns: Prisma schema, tRPC routers, auth logic, email, notifications, audit logging
- Does NOT serve a production UI (only has `app/test-api/` and `app/test-login/` development pages)

**Frontend App (port 3000):**
- Location: `4dx-frontend/`
- Role: React UI. All data fetched from the backend via tRPC over HTTP
- Points to backend at `NEXT_PUBLIC_BACKEND_URL` env var; in development calls `/api/trpc` (same-origin proxy or direct)
- Owns: React components, Zustand stores, tRPC React client, routing logic, auth UI pages

## Layers

**tRPC Router Layer:**
- Purpose: Defines all application procedures (queries and mutations) with Zod validation and access control
- Location: `server/routers/`
- Contains: 9 sub-routers assembled in `server/routers/_app.ts`
- Depends on: `server/db.ts` (Prisma client), `server/audit.ts`, `server/notify.ts`, `server/email.ts`
- Used by: `app/api/trpc/[trpc]/route.ts` (HTTP handler)

**Database Layer:**
- Purpose: Single Prisma client singleton, shared across all routers
- Location: `server/db.ts`, `server/prisma-client.ts`
- Pattern: Global singleton in development to avoid connection leaks; fresh instance per request in production
- Generated client output: `src/generated/prisma/`

**Context Layer:**
- Purpose: Attaches `db` and `session` to every tRPC request
- Location: `server/context.ts`
- Provides: `{ db: PrismaClient, session: Session | null, req: NextRequest }`

**Auth Layer:**
- Purpose: Session management via NextAuth JWT strategy
- Location: `server/authOptions.ts` (canonical config), `app/api/auth/[...nextauth]/route.ts` (Next.js route handler)
- Note: `authOptions` is defined in two places — `server/authOptions.ts` and duplicated in the route file with extra `console.log` debug statements. The route file version is the one actually used by the app.

**Cross-Cutting Services:**
- `server/audit.ts` — writes `AuditLog` records for all state-changing mutations
- `server/notify.ts` — writes `Notification` records to DB for in-app notifications
- `server/email.ts` — sends transactional email via Resend
- `server/rateLimit.ts` — in-memory rate limiting (per-IP, per-email) for auth endpoints

**Frontend Client Layer:**
- Purpose: Connects React components to the backend tRPC API
- Location: `4dx-frontend/lib/trpc.ts` (tRPC React client), `4dx-frontend/lib/api-client.ts` (error utilities)
- Pattern: `createTRPCReact<any>()` — type safety is intentionally bypassed (`as any`) due to cross-repo type sharing complexity. AppRouter type is NOT imported directly.

**Frontend State Layer:**
- Purpose: In-memory client state for current user, active team, and sessions
- Location: `4dx-frontend/lib/stores/`
- Files: `user-store.ts` (user identity + role), `team-store.ts` (current team, persists slug to `localStorage`), `session-store.ts` (current weekly sessions)
- Framework: Zustand

**Frontend Hooks Layer:**
- Purpose: Wraps all tRPC queries and mutations in consistent `{ data, isLoading, error }` return shapes
- Location: `4dx-frontend/lib/hooks.ts`
- Pattern: Each hook calls one tRPC procedure and optionally syncs data to a Zustand store

## tRPC Router Inventory

All routers are assembled at `server/routers/_app.ts` and exposed via `appRouter`:

| Namespace | File | Key Procedures |
|-----------|------|----------------|
| `auth` | `server/routers/auth.ts` | `me`, `signup`, `adminCreateUser`, `getAllUsers`, `deleteUser`, `findByEmail`, `requestPasswordReset`, `resetPassword`, `changePassword` |
| `wigs` | `server/routers/wigs.ts` | `create`, `getByTeam`, `getById`, `activate`, `close`, `update` |
| `teams` | `server/routers/teams.ts` | `create`, `addMember`, `removeMember`, `assignLead`, `delete`, `getBySlug`, `getMyTeams`, `getAllTeams`, `getMembers`, `getActivitySummary` |
| `leadMeasures` | `server/routers/leadMeasures.ts` | `create`, `getByWig`, `update`, `archive` |
| `activityLogs` | `server/routers/activityLogs.ts` | `log`, `approve`, `approveAllForTeam`, `decline`, `edit`, `getPendingForTeam`, `getByLeadMeasure`, `getByUser` |
| `sessions` | `server/routers/sessions.ts` | `generateForTeam`, `completeAccount`, `completeReview`, `completeCommit`, `getCurrentSession`, `getMySession`, `getTeamSessions` |
| `org` | `server/routers/org.ts` | `create`, `getDashboard`, `getActivityData`, `getMembers`, `inviteMember`, `updateMemberRole`, `getAuditLogs`, `getTeams` |
| `notifications` | `server/routers/notifications.ts` | `getUnread`, `getUnreadCount`, `markRead`, `markAllRead` |
| `invites` | `server/routers/invites.ts` | (invite token management) |

## Procedure Types

- `publicProcedure` — no auth required (signup, password reset). Defined in `server/trpc.ts`.
- `protectedProcedure` — middleware checks `ctx.session?.user` exists, throws `UNAUTHORIZED` if not. Used by every data procedure.

## Data Flow: Frontend Action to Database

1. User triggers action in a React component (e.g., clicking "Log Activity")
2. Component calls a hook from `4dx-frontend/lib/hooks.ts` (e.g., `useLogActivity()`)
3. Hook wraps `trpc.activityLogs.log.useMutation()` — tRPC React-Query mutation
4. tRPC client batches the HTTP request to `POST /api/trpc` (backend root app)
5. `app/api/trpc/[trpc]/route.ts` receives the request, calls `createContext(req)`
6. `createContext` calls `getServerSession(authOptions)` to validate the JWT cookie and populate `ctx.session`
7. The matched router procedure (e.g., `activityLogsRouter.log`) receives `{ ctx, input }`
8. Procedure validates input via Zod, checks business rules (ownership, membership), then calls `ctx.db.*`
9. On mutations, `auditLog()` is called to write an `AuditLog` record
10. For side-effects: `notify()` writes a `Notification` record; `sendEmail()` fires Resend API call (non-blocking)
11. Response returned via tRPC → React-Query cache updated → component re-renders

## Auth Flow

1. Frontend `4dx-frontend/app/login/page.tsx` calls `signIn("credentials", { email, password })`
2. NextAuth `CredentialsProvider.authorize` in `app/api/auth/[...nextauth]/route.ts` validates credentials:
   - Rate-limit check (5 attempts per 15 min per IP+email)
   - `db.user.findUnique({ email })` lookup
   - `bcrypt.compare(password, passwordHash)`
3. On success: NextAuth creates a JWT token containing `{ id, email, name }`
4. `jwt` callback stores `user.id` in `token.id`
5. `session` callback copies `token.id` to `session.user.id`
6. JWT cookie is set (10-minute max-age, refreshed on each request)
7. Frontend `useCurrentUser()` hook calls `trpc.auth.me` on mount — returns full role/org/team data from DB
8. Role is derived in `auth.me`: `ADMIN` if any `OrgMembership.role === "ADMIN"`, `TEAM_LEAD` if any `TeamMembership.role === "LEAD"` or `Team.leadUserId === userId`, otherwise `MEMBER`
9. Role written to `useUserStore` (Zustand), drives nav filtering and route access control in `4dx-frontend/lib/team-routing.ts`

**Microsoft SSO (optional):** If `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` env vars are set, `AzureADProvider` is added. On sign-in, the `signIn` callback verifies the Azure user's email exists in the DB before permitting access.

## Role-Based Access Control

Roles are enforced at two layers:

**Server (tRPC routers):**
- Each procedure explicitly checks `ctx.session.user.id` against DB records
- Pattern: look up `OrgMembership` for org-admin checks, `Team.leadUserId` for team-lead checks, `TeamMembership.userId === session.user.id` for member checks

**Client (routing):**
- `4dx-frontend/lib/team-routing.ts` maps roles to default routes and permitted path prefixes
- `dashboard/layout.tsx` redirects on mount if `pathname` is not allowed for current `userRole`
- Nav items filtered by `roles` array in `allNavItems`

Role derivation in `auth.me`:
- `ADMIN` — has any `OrgMembership` with `role === "ADMIN"`
- `TEAM_LEAD` — has any `TeamMembership` with `role === "LEAD"` OR is `Team.leadUserId` for any team
- `MEMBER` — all others

## Weekly Session Lifecycle

Sessions are per-user per-WIG per-week. Each has three gated steps:

1. **Account** (`completeAccount`) — review last week's commitments, mark each DONE/PARTIAL/NOT_DONE
2. **Review** (`completeReview`) — acknowledge scoreboard (gates: Account must be complete)
3. **Commit** (`completeCommit`) — make 1–3 new commitments (gates: Account and Review must be complete)

Session generation runs via:
- Cron job every Monday 00:00 UTC (`app/api/cron/generate-sessions/route.ts`)
- Team Lead can also trigger manually via `sessions.generateForTeam`

Overdue sessions marked via separate cron (`app/api/cron/mark-overdue/route.ts`).

## Error Handling Strategy

**Server:** All procedures throw `TRPCError` with specific codes (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`, `UNAUTHORIZED`, `CONFLICT`). `auditLog` failures are caught silently to avoid blocking mutations.

**Client:** `parseTRPCError()` in `4dx-frontend/lib/api-client.ts` normalizes all tRPC errors to `APIError { message, code, httpStatus }`. Hooks expose `error: APIError | null`. Auth errors (`UNAUTHORIZED`) in `useCurrentUser` trigger redirect to `/login`.

---

*Architecture analysis: 2026-05-23*
