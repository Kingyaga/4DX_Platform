# Technology Stack

**Analysis Date:** 2026-05-23

## Languages

**Primary:**
- TypeScript 5.x - All application code (backend API routes, server logic, frontend components, scripts)

**Secondary:**
- SQL - Prisma migration files in `prisma/migrations/`

## Runtime

**Environment:**
- Node.js (no pinned version in `.nvmrc`; render.yaml targets `node` runtime)

**Package Manager:**
- Root: pnpm (lockfile: `pnpm-lock.yaml`, workspace: `pnpm-workspace.yaml`)
- Frontend sub-package (`4dx-frontend/`): npm (lockfile: `4dx-frontend/package-lock.json`)
  - render.yaml build uses `npm ci && npm --prefix 4dx-frontend ci` confirming dual manager setup

## Repository Structure

This is a **monorepo with two Next.js applications** sharing a single git repo but distinct package manifests:

| App | Root | Role |
|-----|------|------|
| Backend + API | `/` (root `package.json`) | tRPC API, REST v1 endpoints, NextAuth, Prisma DB layer, cron scripts |
| Frontend | `4dx-frontend/` | Separate Next.js app that proxies all `/api/*` calls to the backend via `next.config.ts` rewrites |

## Frameworks

**Core (Backend — root):**
- Next.js 16.2.4 - App Router, API route handlers (`app/api/`)
- React 19.2.4 - UI (minimal; backend app has a `app/test-api/page.tsx` dev page)

**Core (Frontend — `4dx-frontend/`):**
- Next.js 16.2.4 - App Router, full dashboard UI
- React 19.2.4 - Component tree

**API Layer:**
- tRPC 11.16.0 (`@trpc/server`, `@trpc/client`, `@trpc/next`) - Type-safe RPC between frontend and backend
- tRPC React Query 11.17.0 (`@trpc/react-query`) - Frontend data-fetching via tRPC

**Authentication:**
- NextAuth 4.x (`next-auth`) - Session management, credentials + Azure AD providers
  - Strategy: JWT, 10-minute session maxAge
  - Configured in `app/api/auth/[...nextauth]/route.ts` and `server/authOptions.ts`

**Database ORM:**
- Prisma 7.8.0 (`prisma`, `@prisma/client`) - Schema-first ORM, migrations, typed queries
- `@prisma/adapter-pg` 7.8.0 - PostgreSQL adapter (replaces default Prisma engine driver)
- `pg` 8.20.0 - Raw PostgreSQL node driver (used by `PrismaPg` adapter)
- Prisma client generated to `src/generated/prisma/` (not the default `node_modules`)

**Styling (Frontend):**
- Tailwind CSS 4.x - Utility-first CSS; custom design token color system in `4dx-frontend/tailwind.config.ts`
- Inter font family throughout

**State Management (Frontend):**
- Zustand 5.0.13 - Client-side stores in `4dx-frontend/lib/stores/` (user, team, session stores)
- TanStack Query 5.100.9 (`@tanstack/react-query`) - Server state via tRPC integration

**Data Serialization:**
- superjson 2.2.6 - tRPC transformer enabling Date, Map, Set serialization over JSON

**Validation:**
- Zod 4.3.6 - Input validation in tRPC routers

**Email:**
- Resend 6.12.2 - Transactional email SDK; client initialized in `server/email.ts`

**Password Hashing:**
- bcryptjs 3.0.3 - Used in auth routes for credential comparison

**HTTP Client:**
- axios 1.15.2 - Available as dependency; used in scripts/test utilities

## Key Dependencies

**Critical:**
- `@prisma/client` 7.8.0 - Database access; all routers depend on `server/db.ts` which exports `db`
- `@trpc/server` 11.16.0 - Defines all tRPC routers in `server/routers/`; core business logic transport
- `next-auth` 4.x - Gate on all protected tRPC procedures via `server/context.ts` session injection
- `zod` 4.3.6 - Schema validation on all tRPC input types
- `superjson` 2.2.6 - Required on both client and server tRPC links; removing breaks Date serialization

**Infrastructure:**
- `dotenv` 17.4.2 - Loaded via `import "dotenv/config"` in `server/prisma-client.ts`; makes `.env` available to scripts and cron jobs run outside Next.js
- `ts-node` 10.9.2 - Executes TypeScript cron scripts directly (`scripts/*.ts`) via `pnpm cron:*` commands
- `tsconfig-paths` 4.2.0 - Resolves `@/` path alias when running scripts with `ts-node`
- `tsx` 4.21.0 - Used for Prisma seed: `tsx prisma/seed.ts` (defined in `prisma.config.ts`)

## Configuration

**TypeScript:**
- `tsconfig.json` at root: strict mode, `moduleResolution: bundler`, path alias `@/*` → `./`, `@/generated/*` → `./src/generated/*`
- `4dx-frontend/` has its own `tsconfig.json`

**Build:**
- Root: `next build` (compiles backend app)
- Frontend: `npm --prefix 4dx-frontend run build`
- Prisma config: `prisma.config.ts` — points schema to `prisma/schema.prisma`, migrations to `prisma/migrations/`, seed to `tsx prisma/seed.ts`, datasource URL from `DIRECT_URL` env var

**Linting:**
- ESLint 9.x with `eslint-config-next` at both root and `4dx-frontend/`

## Platform Requirements

**Development:**
- Node.js (LTS recommended), pnpm for root, npm for frontend
- PostgreSQL database reachable via `DATABASE_URL` and `DIRECT_URL`
- `NEXTAUTH_SECRET` required; `RESEND_API_KEY` optional (emails disabled gracefully if absent)

**Production:**
- Render (backend + cron jobs) — see `render.yaml`
- Render or Vercel (frontend) — see `4dx-frontend/` Vercel configuration and `render.yaml` frontend service

---

*Stack analysis: 2026-05-23*
