# Codebase Structure

**Analysis Date:** 2026-05-23

## Directory Layout

```
4DX_Platform/                        # Repo root — backend Next.js app (port 3001)
├── app/                             # Next.js App Router — API routes only
│   ├── api/
│   │   ├── auth/[...nextauth]/      # NextAuth handler (GET, POST, HEAD)
│   │   ├── trpc/[trpc]/             # tRPC HTTP handler (GET + POST)
│   │   ├── signup/                  # REST signup endpoint (invite-based)
│   │   ├── cron/
│   │   │   ├── generate-sessions/   # Cron: create weekly sessions (Monday 00:00 UTC)
│   │   │   └── mark-overdue/        # Cron: mark OVERDUE sessions (Tuesday 09:00 UTC)
│   │   ├── health/                  # Health check endpoint
│   │   ├── test/                    # Dev-only test endpoint
│   │   └── v1/                      # REST v1 API (lead-measures, sessions, teams, wigs)
│   ├── test-api/                    # Dev-only test page
│   └── test-login/                  # Dev-only test login page
├── server/                          # All server-side business logic
│   ├── routers/
│   │   ├── _app.ts                  # Root router — assembles all sub-routers
│   │   ├── auth.ts                  # User auth, signup, password reset
│   │   ├── wigs.ts                  # WIG CRUD and lifecycle
│   │   ├── teams.ts                 # Team CRUD and membership management
│   │   ├── leadMeasures.ts          # Lead measure CRUD and archival
│   │   ├── activityLogs.ts          # Activity logging and approval
│   │   ├── sessions.ts              # Weekly session lifecycle
│   │   ├── org.ts                   # Org admin: dashboard, members, audit
│   │   ├── notifications.ts         # In-app notification queries
│   │   ├── invites.ts               # Invite token management
│   │   └── leadMeasure.ts           # (legacy — superseded by leadMeasures.ts)
│   ├── trpc.ts                      # tRPC init: router, publicProcedure, protectedProcedure
│   ├── context.ts                   # Request context: { db, session, req }
│   ├── authOptions.ts               # NextAuth config (canonical definition)
│   ├── db.ts                        # Prisma client singleton
│   ├── prisma-client.ts             # Prisma client factory
│   ├── audit.ts                     # auditLog() helper
│   ├── notify.ts                    # notify() / notifyMany() helpers
│   ├── email.ts                     # Resend email send functions
│   ├── rateLimit.ts                 # In-memory rate limiting
│   └── apiAuth.ts / apiResponse.ts  # REST API auth/response helpers
├── prisma/
│   ├── schema.prisma                # Database schema (single source of truth)
│   └── migrations/                  # Prisma migration SQL files
├── src/
│   └── generated/prisma/            # Generated Prisma client (do not edit)
├── scripts/                         # CLI scripts invoked by cron npm commands
│   ├── generate-weekly-sessions.ts  # Manual session generation
│   └── mark-overdue-sessions.ts     # Manual overdue marking
├── types/                           # Shared TypeScript type declarations
├── systemdocs/                      # System documentation (markdown)
├── public/                          # Static assets
├── package.json                     # Backend dependencies (Next.js 16, tRPC, Prisma, NextAuth)
├── tsconfig.json                    # TypeScript config (path alias: @/ → repo root)
├── render.yaml                      # Render deployment config (2 web services + 3 crons)
└── .planning/                       # Planning and codebase analysis docs

4DX_Platform/4dx-frontend/           # Frontend Next.js app (port 3000)
├── app/                             # Next.js App Router — UI pages only
│   ├── layout.tsx                   # Root layout: TRPCProvider, SessionProvider, QueryClient
│   ├── login/page.tsx               # Login form (next-auth signIn)
│   ├── signup/page.tsx              # Signup form (calls /api/signup on backend)
│   ├── forgot-password/page.tsx     # Password reset request
│   ├── reset-password/page.tsx      # Password reset form
│   └── dashboard/
│       ├── layout.tsx               # Dashboard shell: sidebar nav, team selector, notifications
│       ├── scoreboard/page.tsx      # WIG scoreboard view
│       ├── wigs/page.tsx            # WIG list and management
│       ├── activity/page.tsx        # Activity log view
│       ├── session/page.tsx         # Weekly session (Account → Review → Commit)
│       ├── members/
│       │   ├── page.tsx             # Team member list
│       │   └── [memberId]/page.tsx  # Individual member detail
│       ├── settings/page.tsx        # User settings / password change
│       ├── team-lead/
│       │   ├── page.tsx             # Team lead dashboard
│       │   ├── requests/page.tsx    # Pending activity approval queue
│       │   └── reports/page.tsx     # Team reports
│       └── admin/
│           ├── page.tsx             # Org admin dashboard
│           ├── teams/page.tsx       # Team management
│           ├── users/
│           │   ├── page.tsx         # User list
│           │   └── new/page.tsx     # Create user form
│           ├── activity/page.tsx    # Org-wide activity view
│           ├── at-risk-details/     # At-risk WIG detail
│           ├── execution-details/   # Execution detail view
│           └── lag-details/         # Lag measure detail
├── lib/
│   ├── trpc.ts                      # tRPC React client setup (createTRPCReact, QueryClient)
│   ├── api-client.ts                # Error parsing utilities (parseTRPCError, isAuthError, etc.)
│   ├── hooks.ts                     # All data hooks (useCurrentUser, useWIGs, useLogActivity, etc.)
│   ├── types.ts                     # Frontend TypeScript types (mirrors Prisma schema shapes)
│   ├── team-routing.ts              # Role → default route mapping, route permission checks
│   ├── useTimedMessage.ts           # Utility hook: timed success/error message state
│   └── stores/
│       ├── user-store.ts            # Zustand: { user, orgSlug, userRole }
│       ├── team-store.ts            # Zustand: { currentTeamSlug, myTeams } (persists slug to localStorage)
│       └── session-store.ts         # Zustand: { currentSessions }
├── scripts/
│   └── ensure-port-free.mjs         # Dev script: kills process on port 3000 before next dev
├── package.json                     # Frontend deps (Next.js 16, @trpc/react-query, zustand, tanstack/react-query)
└── tsconfig.json                    # TypeScript config (path alias: @/ → 4dx-frontend root)
```

## Directory Purposes

**`server/routers/`:**
- Purpose: tRPC procedure definitions. Each file is one domain router.
- Pattern: `router({ procedureName: protectedProcedure.input(zodSchema).mutation/query(handler) })`
- Key file: `_app.ts` — assembles all routers into `appRouter`; this is the type exported and used by the frontend

**`app/api/trpc/[trpc]/`:**
- Purpose: Single HTTP handler that routes all tRPC requests
- Key file: `route.ts` — calls `fetchRequestHandler` with `appRouter` and `createContext`

**`app/api/cron/`:**
- Purpose: Serverless cron endpoints protected by `CRON_SECRET` bearer token
- Called by Render cron jobs on schedules defined in `render.yaml`
- `generate-sessions/` — Monday 00:00 UTC: creates `WeeklySession` records for all active WIG members
- `mark-overdue/` — Tuesday 09:00 UTC: marks PENDING sessions as OVERDUE

**`prisma/`:**
- Purpose: Database schema and migration history
- `schema.prisma` — authoritative model definitions; `generator client` outputs to `src/generated/prisma`
- Do not import from `@prisma/client` directly; import from `@/generated/prisma/client`

**`4dx-frontend/lib/`:**
- Purpose: All frontend shared logic (no React components here except `components/` sub-folder)
- This is the primary integration layer between React pages and the backend

**`4dx-frontend/lib/stores/`:**
- Purpose: Client-side runtime state using Zustand
- `team-store.ts` persists `currentTeamSlug` to `localStorage` for page-refresh persistence
- Do NOT store server data here permanently — stores are populated from tRPC hooks on mount

**`4dx-frontend/app/dashboard/`:**
- Purpose: All authenticated UI pages behind the dashboard layout
- `layout.tsx` handles: session validation, user+role loading, team selection, nav rendering, notification bell
- All pages are client components (`"use client"`) that call hooks from `lib/hooks.ts`

## Key File Locations

**Entry Points (Backend):**
- `app/api/trpc/[trpc]/route.ts` — tRPC HTTP handler
- `app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `server/routers/_app.ts` — root tRPC router (exports `AppRouter` type)

**Entry Points (Frontend):**
- `4dx-frontend/app/layout.tsx` — root layout, wraps app in providers
- `4dx-frontend/app/dashboard/layout.tsx` — authenticated shell, role-based nav

**Configuration:**
- `prisma/schema.prisma` — database schema
- `render.yaml` — deployment config (services, crons, env vars)
- `server/authOptions.ts` — canonical NextAuth config (note: route file duplicates this)

**Core Logic:**
- `server/trpc.ts` — procedure factories (`publicProcedure`, `protectedProcedure`)
- `server/context.ts` — per-request context construction
- `server/audit.ts` — audit trail writer
- `4dx-frontend/lib/hooks.ts` — all data access hooks (single file, ~740 lines)
- `4dx-frontend/lib/team-routing.ts` — role-to-route mapping

**Type Definitions:**
- `4dx-frontend/lib/types.ts` — frontend types (manually maintained, mirrors Prisma shapes)
- `src/generated/prisma/` — generated Prisma types (do not edit)

## Naming Conventions

**Files:**
- Router files: `camelCase` matching the domain noun, e.g., `activityLogs.ts`, `leadMeasures.ts`
- Store files: `kebab-case` with `-store` suffix, e.g., `user-store.ts`, `team-store.ts`
- Page files: always `page.tsx` (Next.js App Router convention)
- Layout files: always `layout.tsx`

**tRPC Procedures:**
- Queries: `get` prefix or noun + query (e.g., `getByTeam`, `getCurrentSession`, `me`)
- Mutations: verb + noun (e.g., `create`, `activate`, `close`, `addMember`, `completeAccount`)

**Zustand Stores:**
- Store hook: `use{Domain}Store` (e.g., `useUserStore`, `useTeamStore`)
- Data hooks: `use{Domain}` or `use{Action}` (e.g., `useWIGs`, `useCreateWIG`, `useLogActivity`)

**Database Entities:**
- All IDs: `String @id @default(cuid())`
- Soft deletes: `archivedAt DateTime?` (Teams, LeadMeasures)
- Slug fields: lowercase alphanumeric + hyphens, unique

## Route-to-File Mapping

| URL | File | Role Access |
|-----|------|-------------|
| `/login` | `4dx-frontend/app/login/page.tsx` | Public |
| `/signup` | `4dx-frontend/app/signup/page.tsx` | Public (invite required) |
| `/forgot-password` | `4dx-frontend/app/forgot-password/page.tsx` | Public |
| `/reset-password` | `4dx-frontend/app/reset-password/page.tsx` | Public |
| `/dashboard/scoreboard` | `4dx-frontend/app/dashboard/scoreboard/page.tsx` | MEMBER, TEAM_LEAD |
| `/dashboard/wigs` | `4dx-frontend/app/dashboard/wigs/page.tsx` | MEMBER, TEAM_LEAD |
| `/dashboard/activity` | `4dx-frontend/app/dashboard/activity/page.tsx` | MEMBER, TEAM_LEAD |
| `/dashboard/session` | `4dx-frontend/app/dashboard/session/page.tsx` | MEMBER, TEAM_LEAD |
| `/dashboard/members` | `4dx-frontend/app/dashboard/members/page.tsx` | MEMBER, TEAM_LEAD |
| `/dashboard/team-lead` | `4dx-frontend/app/dashboard/team-lead/page.tsx` | TEAM_LEAD |
| `/dashboard/team-lead/requests` | `4dx-frontend/app/dashboard/team-lead/requests/page.tsx` | TEAM_LEAD |
| `/dashboard/team-lead/reports` | `4dx-frontend/app/dashboard/team-lead/reports/page.tsx` | TEAM_LEAD |
| `/dashboard/admin` | `4dx-frontend/app/dashboard/admin/page.tsx` | ADMIN |
| `/dashboard/admin/teams` | `4dx-frontend/app/dashboard/admin/teams/page.tsx` | ADMIN |
| `/dashboard/admin/users` | `4dx-frontend/app/dashboard/admin/users/page.tsx` | ADMIN |
| `/dashboard/admin/users/new` | `4dx-frontend/app/dashboard/admin/users/new/page.tsx` | ADMIN |
| `/dashboard/admin/activity` | `4dx-frontend/app/dashboard/admin/activity/page.tsx` | ADMIN |
| `/dashboard/settings` | `4dx-frontend/app/dashboard/settings/page.tsx` | All roles |

## Where to Add New Code

**New tRPC procedure:**
- Add to the relevant router in `server/routers/{domain}.ts`
- If adding a new domain, create `server/routers/{domain}.ts`, export a router, import and mount in `server/routers/_app.ts`
- Add a corresponding hook in `4dx-frontend/lib/hooks.ts`
- Add types to `4dx-frontend/lib/types.ts` if the response shape is new

**New dashboard page:**
- Create `4dx-frontend/app/dashboard/{route}/page.tsx` as a client component (`"use client"`)
- Add a nav item to `allNavItems` in `4dx-frontend/app/dashboard/layout.tsx` with appropriate `roles` array
- Update `isRouteAllowedForRole` in `4dx-frontend/lib/team-routing.ts` if the route needs custom role gating

**New cron job:**
- Create `app/api/cron/{name}/route.ts` with `CRON_SECRET` bearer check
- Add a CLI script in `scripts/` for manual execution
- Add a `cron` entry to `render.yaml` and a `scripts` entry to root `package.json`

**New shared component:**
- Place in `4dx-frontend/lib/components/`

**New Prisma model:**
- Add to `prisma/schema.prisma`
- Run `prisma migrate dev` to create migration
- Generated types appear in `src/generated/prisma/` automatically

## Special Directories

**`src/generated/prisma/`:**
- Purpose: Auto-generated Prisma client
- Generated: Yes (by `prisma generate`)
- Committed: Yes (to avoid needing `prisma generate` on every deploy)
- Import path: `@/generated/prisma/client`

**`prisma/migrations/`:**
- Purpose: SQL migration history
- Generated: Yes (by `prisma migrate dev`)
- Committed: Yes (required for `prisma migrate deploy` in production)

**`.planning/`:**
- Purpose: Planning docs and codebase analysis
- Generated: No
- Committed: Yes

**`systemdocs/`:**
- Purpose: System/product documentation
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-23*
