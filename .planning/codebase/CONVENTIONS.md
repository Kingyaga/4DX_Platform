# Coding Conventions

**Analysis Date:** 2026-05-23

## Styling Approach

**Mixed: inline styles dominate pages, Tailwind used only in shared components.**

Dashboard pages (`4dx-frontend/app/dashboard/**/*.tsx`) use exclusively inline `style={{}}` objects with hardcoded hex values and pixel values. There is no Tailwind usage in page-level components.

Shared UI components in `4dx-frontend/lib/components/` use Tailwind class names. The split is consistent:
- `4dx-frontend/lib/components/states.tsx` — Tailwind (`className="p-4 bg-red-50 border border-red-200 rounded-lg"`)
- `4dx-frontend/app/dashboard/wigs/page.tsx` — inline styles (`style={{ padding: "32px", fontFamily: "'Inter', sans-serif" }}`)
- `4dx-frontend/app/dashboard/layout.tsx` — inline styles throughout, with a single `style jsx global` block for hover/click animation classes

**Design token pattern (inline styles):**
- Primary text: `#18181b`
- Muted/secondary text: `#71717a`
- Border: `#e4e4e7`
- Background tint: `#f7f9fd`, `#f4f4f5`
- Success: `#16A34A`
- Error/danger: `#ef4444`
- Accent: `#EAB308` (warning/yellow)

Do NOT mix Tailwind into page-level components. Keep Tailwind confined to `4dx-frontend/lib/components/`.

## Component Patterns

**Page components are exported as default from `page.tsx` files.** Sub-components within a page are defined as named functions in the same file (not exported). Example from `4dx-frontend/app/dashboard/wigs/page.tsx`: `WIGDetail`, `WIGCreateForm`, and `WIGEditForm` are all defined in the same file as local functions.

**Component signature pattern:**
```tsx
// Page component — no props
export default function WIGsPage() { ... }

// Sub-component — inline prop typing
function WIGDetail({ wig, onBack }: { wig: WIG; onBack: () => void }) { ... }
function WIGCreateForm({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) { ... }
```

**Shared components** in `4dx-frontend/lib/components/` use named `interface` for props:
```tsx
interface ErrorStateProps {
  error: APIError | null;
  title?: string;
  onRetry?: () => void;
}
export function ErrorState({ error, title, onRetry }: ErrorStateProps) { ... }
```

**`"use client"` directive** is at the top of every dashboard page and all hooks. It is always the first line before imports.

**No `React.FC`** — function components declared with plain `function` syntax throughout.

## Naming Conventions

**Files:**
- Page components: `page.tsx` in route-named directories (Next.js App Router)
- Hooks: `camelCase` exports in `4dx-frontend/lib/hooks.ts`
- Stores: `kebab-case` files, e.g., `user-store.ts`, `team-store.ts`
- Components: `kebab-case` files, e.g., `loading-spinner.tsx`, `role-badge.tsx`

**Functions/Hooks:**
- Custom hooks: `use` prefix, PascalCase after, e.g., `useCurrentUser`, `useCreateWIG`, `useDeleteTeam`
- Query hooks: `use` + noun, e.g., `useWIGs`, `useTeam`, `useMyTeams`
- Mutation hooks: `use` + verb + noun, e.g., `useCreateWIG`, `useLogActivity`, `useCompleteAccount`
- Event handlers: `handle` prefix, e.g., `handleSubmit`, `handleTeamChange`, `handleMarkRead`

**Types/Interfaces:**
- Domain types: PascalCase interfaces exported from `4dx-frontend/lib/types.ts`
- Store interfaces: PascalCase with `Store` suffix, e.g., `UserStore`, `TeamStore`
- Nav item interfaces: PascalCase, e.g., `NavItem`

**Variables:**
- camelCase throughout
- State variables named by noun: `selectedWIG`, `showNew`, `hoveredRow`
- Boolean state: `show*`, `is*`, `has*` prefix

## Hook Pattern

All data hooks follow a uniform return shape. Query hooks:
```ts
return {
  [noun]: query.data || defaultValue,
  isLoading: query.isLoading,
  error: query.error ? parseTRPCError(query.error) : null,
  refetch: query.refetch,
};
```

Mutation hooks:
```ts
return {
  [verbNoun]: mutation.mutateAsync,
  isLoading: mutation.isPending,
  error: mutation.error ? parseTRPCError(mutation.error) : null,
  isSuccess: mutation.isSuccess,
  reset: mutation.reset,
};
```

Side-effect syncing to Zustand stores is done inside `useEffect` within the hook (e.g., `useMyTeams` calls `setMyTeams`, `useCurrentSessions` calls `setCurrentSessions`).

**Conditional fetching:** All hooks guard queries with `enabled: !!param` when the parameter may be null/empty.

## Error Handling

**Frontend pattern:** Errors are surfaced via hook state, never via try/catch in the component handler. Handlers wrap `mutation.mutateAsync` in try/catch blocks with empty catch bodies and a comment:
```tsx
try {
  await createWIG({ ... });
  onSuccess();
} catch {
  // Error is handled in the hook
}
```
The actual error is displayed by rendering `<ErrorState error={error} />` from hook state in JSX.

**Error parsing:** `parseTRPCError` in `4dx-frontend/lib/api-client.ts` normalizes all tRPC errors to `APIError { message, code, httpStatus }`. User-friendly messages mapped in `getErrorMessage()`.

**Backend pattern:** tRPC procedures throw `TRPCError` with typed `code` values (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`, `UNAUTHORIZED`). No silent swallowing.

## TypeScript Usage

**Pervasive `as any` casting is a known issue.** The hooks file `4dx-frontend/lib/hooks.ts` has 20 occurrences. Dashboard page files have additional casts. This is concentrated around tRPC router calls for routers whose types are not fully inferred (e.g., `(trpc.teams as any).getMyTeams.useQuery(...)`).

Domain types are well-defined in `4dx-frontend/lib/types.ts` using `interface` for object shapes and `type` for string unions:
```ts
export type UserRole = "ADMIN" | "TEAM_LEAD" | "MEMBER";
export interface User { id: string; email: string; ... }
```

Backend routers use Zod for all input validation. Schema defined inline with `.input(z.object({...}))` on every procedure.

**`z.coerce.date()`** used for date inputs from frontend forms.

## State Management

Global state uses Zustand stores in `4dx-frontend/lib/stores/`:
- `user-store.ts` — current user, role, org slug
- `team-store.ts` — current team slug, teams list
- `session-store.ts` — current weekly sessions

Store actions use immutable `set({...})` pattern. No direct state mutation.

Server state managed by tRPC + TanStack Query. `staleTime: 0` and `gcTime: 0` set on `auth.me` to always fetch fresh.

Notifications poll every 30 seconds via `refetchInterval: 30_000` on `useNotifications` and `useNotificationCount`.

## Import Organization

No enforced import ordering. Observed pattern in pages:
1. React hooks (`useEffect`, `useState`)
2. Next.js imports (`useRouter`, `Link`)
3. Internal hooks from `@/lib/hooks`
4. Internal stores from `@/lib/stores/*`
5. Internal components from `@/lib/components/*`
6. Type imports (`import type { ... }`)

Path alias `@/` maps to `4dx-frontend/` root.

## Backend Router Conventions

All routers in `server/routers/` follow this pattern:
- Export a named `*Router` const, e.g., `wigsRouter`, `teamsRouter`
- All procedures use `protectedProcedure` (auth is enforced at the procedure level)
- Input validated with `z.object({...})`
- Authorization checks done inside the mutation/query body against `ctx.session.user`
- Every mutation calls `auditLog()` with before/after state

User ID access pattern: `(ctx.session.user as any).id` — the session user type is not fully typed, requiring `as any`.

## Linting

ESLint configured in `4dx-frontend/eslint.config.mjs` using `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Rules:
- `@typescript-eslint/no-explicit-any`: `"warn"` (not error — this is why `as any` proliferates)
- `react-hooks/set-state-in-effect`: `"warn"`
- `react/no-unescaped-entities`: `"warn"`

No Prettier config detected. No enforced auto-formatting.

## Console Logging

`console.log` is present in `app/api/auth/[...nextauth]/route.ts` (debug statements left in auth flow). `console.error` used in error paths. No structured logging library is in use.

---

*Convention analysis: 2026-05-23*
