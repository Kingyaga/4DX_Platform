# External Integrations

**Analysis Date:** 2026-05-23

## APIs & External Services

**Email:**
- Resend — Transactional email delivery
  - SDK: `resend` ^6.12.2
  - Client: `server/email.ts` — lazily instantiated; silently disabled if key absent
  - Auth: `RESEND_API_KEY` env var
  - From address: `EMAIL_FROM` env var (default: `"4DX Platform <onboarding@resend.dev>"`)
  - Triggers: session ready, session overdue, WIG closed, password reset, team membership changes, WIG-at-risk daily cron
  - Graceful degradation: if `RESEND_API_KEY` is missing or `"undefined"`, email sends are skipped without throwing

## Data Storage

**Databases:**
- PostgreSQL (provider-agnostic; hosted wherever `DATABASE_URL` points — Render PostgreSQL in production)
  - Primary connection: `DATABASE_URL` env var (used by `PrismaPg` adapter in `server/prisma-client.ts`)
  - Migration/seed connection: `DIRECT_URL` env var (used in `prisma.config.ts` datasource — bypasses connection poolers for DDL)
  - Client: Prisma 7.8.0 with `@prisma/adapter-pg` (pg driver adapter; sets `uselibpqcompat=true` flag)
  - Generated client output: `src/generated/prisma/` (non-default path, set in `prisma/schema.prisma`)
  - Singleton pattern in development to prevent connection leaks: `server/db.ts` uses `globalThis` cache

**File Storage:**
- None detected — no S3, GCS, or local file upload integrations present

**Caching:**
- In-memory only — rate limit buckets use a `Map<string, Bucket>` in `server/rateLimit.ts`; resets on process restart
- No Redis or external cache

## Authentication & Identity

**Auth Provider (Primary): Credentials (email + password)**
- Implementation: NextAuth v4 `CredentialsProvider`
- Password hashing: bcryptjs (hash stored in `User.passwordHash` column)
- Rate limiting: 5 login attempts per 15-minute window per IP+email, enforced in `server/rateLimit.ts`
- Configured in: `server/authOptions.ts` and duplicated in `app/api/auth/[...nextauth]/route.ts`
- Session strategy: JWT, 10-minute maxAge
- Secret: `NEXTAUTH_SECRET` env var

**Auth Provider (Optional): Microsoft Azure AD / Entra ID**
- Implementation: NextAuth `AzureADProvider`
- Only activated if `MICROSOFT_CLIENT_ID` (or `AZURE_AD_CLIENT_ID`) AND `MICROSOFT_CLIENT_SECRET` (or `AZURE_AD_CLIENT_SECRET`) are set
- Tenant: `MICROSOFT_TENANT_ID` / `AZURE_AD_TENANT_ID` env var (default: `"common"` = multi-tenant)
- Azure AD sign-in restricted to users who already exist in the local DB (`signIn` callback checks `db.user.findUnique`)
- Env vars (any of these accepted):
  - `MICROSOFT_CLIENT_ID` or `AZURE_AD_CLIENT_ID`
  - `MICROSOFT_CLIENT_SECRET` or `AZURE_AD_CLIENT_SECRET`
  - `MICROSOFT_TENANT_ID` or `AZURE_AD_TENANT_ID`

**API Key Auth (for external consumers):**
- `x-api-key` header checked in `server/apiAuth.ts`
- Keys stored in `ApiKey` table with `revokedAt`, `expiresAt`, `lastUsedAt` tracking
- Used on REST v1 routes (`app/api/v1/`)

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or equivalent detected

**Logs:**
- `console.error` / `console.warn` / `console.log` used directly throughout (no structured logging library)
- Prisma client logs: `["error"]` only in both dev and prod (`server/db.ts`)

## CI/CD & Deployment

**Hosting — Backend + Cron Jobs:**
- Render (`render.yaml` defines all services)
  - Service: `4dx-platform-backend` (type: `web`, Node runtime)
    - Build: `pnpm prisma generate && pnpm build`
    - Pre-deploy: `pnpm prisma migrate deploy` (runs migrations before each deploy)
    - Start: `pnpm exec next start -p $PORT`
    - Auto-deploy on push to `main`
  - Cron: `4dx-generate-weekly-sessions` — Mondays 00:00 UTC (`scripts/generate-weekly-sessions.ts`)
  - Cron: `4dx-mark-overdue-sessions` — Tuesdays 09:00 UTC (`scripts/mark-overdue-sessions.ts`)
  - Cron: `4dx-wigs-at-risk-notifications` — Daily 08:00 UTC (`scripts/check-wigs-at-risk.ts`)

**Hosting — Frontend:**
- Render (`render.yaml`, service: `4dx-platform-frontend`, type: `web`, Node runtime)
  - Build: `npm ci && npm --prefix 4dx-frontend ci && npm --prefix 4dx-frontend run build`
  - Start: `npm --prefix 4dx-frontend run start -- -p $PORT`
  - Auto-deploy on push to `main`
  - Env var: `NEXT_PUBLIC_BACKEND_URL` (set manually in Render dashboard — `sync: false`)
- Also deployable to Vercel (commit history references Vercel; `4dx-frontend/` has Vercel-compatible structure)

**CI Pipeline:**
- None detected (no `.github/workflows/`, no CircleCI, no GitLab CI config)

## Environment Configuration

**Required env vars (backend):**
- `DATABASE_URL` — PostgreSQL connection string (Prisma `PrismaPg` adapter)
- `DIRECT_URL` — Direct PostgreSQL URL for migrations (used in `prisma.config.ts`; typically same as `DATABASE_URL` or a non-pooled URL)
- `NEXTAUTH_SECRET` — Signs/verifies NextAuth JWTs; app will start without it but auth will fail

**Required env vars (frontend):**
- `NEXT_PUBLIC_BACKEND_URL` — URL of the backend app; used in `4dx-frontend/next.config.ts` rewrites to proxy `/api/*` to backend
- `NEXTAUTH_BACKEND_URL` — Alternative backend URL env var (also checked in frontend `next.config.ts`)
- `NEXTAUTH_SECRET` — Must match backend value for session cookie validation
- `NEXTAUTH_URL` — Standard NextAuth callback URL

**Optional env vars:**
- `RESEND_API_KEY` — Enables email sending; gracefully disabled if absent
- `EMAIL_FROM` — Sender address for Resend emails (default: `"4DX Platform <onboarding@resend.dev>"`)
- `MICROSOFT_CLIENT_ID` / `AZURE_AD_CLIENT_ID` — Enables Azure AD sign-in provider
- `MICROSOFT_CLIENT_SECRET` / `AZURE_AD_CLIENT_SECRET` — Required alongside client ID for Azure AD
- `MICROSOFT_TENANT_ID` / `AZURE_AD_TENANT_ID` — Azure tenant (default: `"common"`)

**Secrets location:**
- Runtime environment variables injected by Render (production)
- Local development: `.env` file (not committed; loaded via `dotenv/config` in `server/prisma-client.ts` and Prisma config)

## Webhooks & Callbacks

**Incoming:**
- None detected — no inbound webhook handlers (no Stripe, no GitHub, no Resend webhook routes)

**Outgoing:**
- Resend email sends (fire-and-forget; errors logged but not re-raised)

## Internal API Surface

**tRPC router** (primary path for frontend ↔ backend):
- Mount: `app/api/trpc/[trpc]/route.ts`
- Routers: `server/routers/_app.ts` aggregates `auth`, `org`, `teams`, `wigs`, `leadMeasures`, `sessions`, `activityLogs`, `invites`, `notifications`, `leadMeasure`, `session`
- Frontend client: `4dx-frontend/lib/trpc.ts` — `httpBatchLink` to `/api/trpc` with superjson transformer

**REST v1 API** (for external/API key consumers):
- `GET /api/v1/teams` — `app/api/v1/teams/route.ts`
- `GET/POST /api/v1/wigs` — `app/api/v1/wigs/route.ts`
- `GET/POST /api/v1/sessions` — `app/api/v1/sessions/route.ts`
- `GET/POST /api/v1/lead-measures` — `app/api/v1/lead-measures/route.ts`

**Cron HTTP endpoints** (Render can also trigger via HTTP):
- `POST /api/cron/generate-sessions` — `app/api/cron/generate-sessions/route.ts`
- `POST /api/cron/mark-overdue` — `app/api/cron/mark-overdue/route.ts`

---

*Integration audit: 2026-05-23*
