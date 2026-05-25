# 4DX Platform — User Flows & Stories

**Date:** 2026-05-23  
**Scope:** All authenticated flows across Org Admin, Team Lead, and Member personas.  
**Source:** PRD v1.0 + live codebase analysis.

---

## Personas

| Persona | System Role | Primary Job |
|---------|-------------|-------------|
| **Org Admin** | `ADMIN` | Configure org, manage teams and users, monitor execution health |
| **Team Lead** | `TEAM_LEAD` | Own WIGs, approve activity, run weekly cadence |
| **Team Member** | `MEMBER` | Log activity, run weekly session, track personal commitments |

---

## Epic 1 — Onboarding & Access

### US-1.1 · Org Setup (Admin)
> As an Org Admin, I want to create my organization so the platform is scoped to my team.

**Current state:** No "Create Org" UI exists. Backend has `org.create` procedure but no frontend page.  
**Flow:** Manual DB seed / admin-only API call → org exists.  
**Gap:** ❌ No self-serve org creation flow.

---

### US-1.2 · Invite a User (Admin)
> As an Org Admin, I want to invite someone to the org so they can sign up and join.

**Current flow:**
1. Admin generates an invite token (backend `invites` router exists)
2. Token is shared out-of-band (no UI to create/copy/revoke tokens)
3. Invitee visits `/signup?token=<token>`
4. Invitee fills name, email, password → account created, token consumed

**Gap:** ❌ No admin UI to create, view, or revoke invite links. Admin cannot see pending invites.

---

### US-1.3 · Sign Up (New User)
> As a new user with an invite link, I want to create my account.

**Flow:**
1. User visits `/signup?token=...`
2. Fills name, email, password (all validated client-side)
3. POST `/api/signup` — validates token, bcrypt-hashes password, creates User + OrgMembership
4. Redirect to `/login`
5. User signs in → JWT issued → `useCurrentUser` fetches profile with role

**Works.** Minor gap: `name` field has no max-length or HTML sanitization on the server.

---

### US-1.4 · Sign In (All Roles)
> As a registered user, I want to sign in so I can access the dashboard.

**Flow:**
1. `/login` — email + password form
2. `signIn("credentials")` → NextAuth `CredentialsProvider.authorize`
3. Rate-limit check (5 attempts / 15 min / IP+email)
4. bcrypt compare → JWT (10-minute maxAge)
5. Redirect to role-based default route via `team-routing.ts`
   - ADMIN → `/dashboard/admin`
   - TEAM_LEAD → `/dashboard/team-lead`
   - MEMBER → `/dashboard/scoreboard`

**Gap:** ⚠️ 10-minute JWT maxAge silently logs users out mid-session. No proactive expiry warning or silent refresh.

---

### US-1.5 · Password Reset (All Roles)
> As a user who forgot my password, I want to reset it via email.

**Flow:**
1. `/forgot-password` — enter email
2. Backend sends reset email (Resend) with token
3. User clicks link → `/reset-password?token=...`
4. Enter new password → token consumed

**Works.** Not analyzed for token expiry edge cases.

---

## Epic 2 — Team & WIG Configuration

### US-2.1 · Create a Team (Admin)
> As an Org Admin, I want to create a team so I can assign members and WIGs to it.

**Flow:**
1. `/dashboard/admin/teams` → "Create Team" form
2. `teams.create({ name, orgSlug, leadUserId })` → team + slug generated
3. Team appears in list; admin can add members

**Works.**

---

### US-2.2 · Add Member to Team (Admin or Team Lead)
> As a Team Lead or Admin, I want to add an existing org user to my team.

**Flow:**
1. `/dashboard/members` → "Add Member" section
2. Enter email → `auth.findByEmail` → user card confirmed
3. Select role (MEMBER / LEAD) → `teams.addMember({ teamSlug, userId, role })`
4. Member appears in team list

**Works.** User must already be in the org — not a net-new invite.

---

### US-2.3 · Create a WIG (Team Lead)
> As a Team Lead, I want to define a WIG with a target and deadline so the team has a clear goal.

**Flow:**
1. `/dashboard/wigs` → "New WIG" button (visible if `canCreateWIG`)
2. Form: title, from/to values, unit, deadline, description (optional)
3. `wigs.create({ teamSlug, ... })` → WIG created in DRAFT status
4. WIG appears in list; team lead can now add lead measures

**Works.**

---

### US-2.4 · Add Lead Measures to a WIG (Team Lead)
> As a Team Lead, I want to define lead measures under a WIG so team members know what to track.

**Flow:**
1. `/dashboard/wigs` → select WIG → "Add Lead Measure"
2. Form: name, cadence (WEEKLY/BIWEEKLY), target value, unit, owner user IDs
3. `leadMeasures.create({ wigId, ... })` → lead measure created
4. Owners appear in the lead measure card

**Works.**

---

### US-2.5 · Activate a WIG (Team Lead)
> As a Team Lead, I want to activate a WIG when it's ready so members can start logging activity.

**Flow:**
1. `/dashboard/wigs` → WIG in DRAFT status → "Activate WIG" button
2. Server validates: at least 1 lead measure with at least 1 owner
3. `wigs.activate({ wigId })` → WIG status → ACTIVE
4. Scoreboard and session flows unlock

**Works.**

---

### US-2.6 · Close a WIG (Team Lead)
> As a Team Lead, I want to close a WIG as ACHIEVED, MISSED, or ABANDONED when the deadline is reached or the goal is settled.

**Flow:**
1. `/dashboard/wigs` → active WIG → "Close WIG" (red button, Team Lead only)
2. Modal: select outcome (ACHIEVED / MISSED / ABANDONED) + irreversibility warning
3. `wigs.close({ wigId, status })` → WIG status updated, `closedAt` set
4. In-app notification sent to all team members
5. Email sent to each member (Resend)
6. WIG moves to History tab

**Works.**

---

## Epic 3 — Activity Logging

### US-3.1 · Log Activity (Member)
> As a Team Member, I want to log my activity against a lead measure so my contribution is recorded.

**Flow:**
1. `/dashboard/activity` → select lead measure → enter value, date, optional note
2. `activityLogs.log({ leadMeasureId, value, loggedForDate, note })` → log created in PENDING status
3. Activity appears in log list; scoreboard stays unchanged until approved

**Works.**

---

### US-3.2 · Edit an Activity Log (Member)
> As a Team Member, I want to edit a log I submitted within 24 hours if I made a mistake.

**Flow (backend):**
- `activityLogs.edit({ logId, value, note })` — validates 24-hour window, audit-logged

**Gap:** ❌ No edit UI exposed in the frontend. The backend and hook exist; no component renders an edit action.

---

### US-3.3 · Approve / Decline Activity (Team Lead)
> As a Team Lead, I want to review pending activity logs and approve or decline them so the scoreboard reflects verified work.

**Flow:**
1. `/dashboard/team-lead/requests` → list of PENDING logs
2. Team lead reviews each: value, date, note, submitter name
3. Approve → `activityLogs.approve` → log becomes APPROVED, WIG `currentValue` updated
4. Decline → `activityLogs.decline` → log becomes REJECTED
5. "Approve all" bulk action available

**Works.**

---

## Epic 4 — Scoreboard

### US-4.1 · View Scoreboard (Member, Team Lead)
> As a team member, I want to see our WIG progress and lead measure performance at a glance.

**Flow:**
1. `/dashboard/scoreboard` → shows active WIG with progress bar
2. Displays days remaining to deadline
3. Each lead measure card shows: target, approved total, per-owner contribution
4. "Display Mode" button → full-screen dark overlay (Escape to exit)

**Works.** Per-owner contribution now live as of today's commit.

---

### US-4.2 · View Historical Scoreboard
> As a team member, I want to review past WIGs and their outcomes.

**Gap:** ⚠️ `/dashboard/wigs` has a "History" tab showing closed WIGs with their status. No scoreboard-style retrospective view with final numbers per member. Functional but lightweight.

---

## Epic 5 — Weekly Session

### US-5.1 · Run a Weekly Session — Account Step (Member)
> As a Team Member, I want to review last week's commitments and mark each one done, partial, or not done.

**Flow:**
1. `/dashboard/session` → session for current week loads
2. Step 1 (ACCOUNT): list of last week's commitments
3. For each: mark DONE / PARTIAL / NOT_DONE; if NOT_DONE, select reason (WHIRLWIND / MISJUDGED / BLOCKED / OTHER) + optional reflection
4. Validation: every NOT_DONE must have a reason
5. `sessions.completeAccount({ sessionId, commitmentUpdates })` → `accountDoneAt` set

**Works.** Critical gap: if user leaves and returns, step resets to 0 regardless of `accountDoneAt`. User re-sees step 1 but cannot re-submit the Account step because the server has already recorded it. Confusing UX.

---

### US-5.2 · Run a Weekly Session — Review Step (Member)
> As a Team Member, I want to review the scoreboard during the session to stay aligned with WIG progress.

**Flow:**
1. Step 2 (REVIEW): scoreboard data shown inline within the session flow
2. User acknowledges → `sessions.completeReview({ sessionId })` → `reviewDoneAt` set

**Works.**

---

### US-5.3 · Run a Weekly Session — Commit Step (Member)
> As a Team Member, I want to make 1–3 specific commitments for the coming week.

**Flow:**
1. Step 3 (COMMIT): commitment text fields (1–3 entries)
2. Validation: each commitment ≥ 5 words, linked lead measure optional
3. `sessions.completeCommit({ sessionId, commitments })` → `commitDoneAt` set → session COMPLETE
4. Commitments stored, become next week's Account step items

**Works.** Gap: no confirmation/celebration state after COMMIT. Session just advances step counter — no success screen shown.

---

### US-5.4 · Session Generates Automatically (System)
> As a Team Lead, I want sessions to be created for all WIG owners at the start of each week automatically.

**Flow:**
1. Monday 00:00 UTC → Render cron → `POST /api/cron/generate-sessions` (CRON_SECRET auth)
2. For every active WIG across all teams: creates one `WeeklySession` per member-WIG pair
3. Sessions created with status PENDING

**Gap:** ⚠️ Cron also has a standalone script (`scripts/generate-weekly-sessions.ts`) that does the same thing — two implementations with the same N+1 bug. `render.yaml` calls the standalone script, not the API route.

---

### US-5.5 · Mark Overdue Sessions (System)
> As a system admin, I want sessions that weren't completed by Tuesday to be marked OVERDUE automatically.

**Flow:**
1. Tuesday 09:00 UTC → Render cron → `POST /api/cron/mark-overdue`
2. Finds PENDING/IN_PROGRESS sessions from current week's Monday
3. Marks them OVERDUE, sends in-app notification + email per user

**Works.** Minor: uses `getThisMonday()` — safe on Tuesday schedule but fragile if rescheduled.

---

## Epic 6 — Team Lead Dashboard

### US-6.1 · View Team Execution Health (Team Lead)
> As a Team Lead, I want to see my team's weekly session completion status so I can follow up with anyone who is behind.

**Flow:**
1. `/dashboard/team-lead` → session roster: each member, their WIG, color-coded status dot
2. Quick actions: generate sessions, approve all pending activity
3. Summary stats from `org.getDashboard` (org-wide, not team-scoped)

**Gap:** ⚠️ The team lead dashboard shows org-wide stats (not team-scoped). A team lead managing only their team sees org metrics that may belong to other teams. Misleading at scale.

---

### US-6.2 · View Historical Team Session Data (Team Lead)
> As a Team Lead, I want to browse past weeks' sessions to track accountability trends.

**Gap:** ⚠️ `/dashboard/team-lead/reports` exists but the sessions hook always fetches the current week (`weekStarting` omitted). No week-picker UI. Team lead can only see this week.

---

## Epic 7 — Org Admin Dashboard

### US-7.1 · Monitor Org Execution Health (Admin)
> As an Org Admin, I want a real-time view of the org's WIG progress, session completion rate, and activity volume.

**Flow:**
1. `/dashboard/admin` → org dashboard: active WIGs count, members, teams, session completion rate
2. Stats sourced from `org.getDashboard` (now shows real completion rate, not fake trend)

**Works.**

---

### US-7.2 · Manage Teams (Admin)
> As an Org Admin, I want to create, edit, and delete teams and assign team leads.

**Flow:**
1. `/dashboard/admin/teams` → team list
2. Create team, add/remove members, assign lead, delete team

**Works.**

---

### US-7.3 · Manage Users (Admin)
> As an Org Admin, I want to view all users and manage their roles.

**Flow:**
1. `/dashboard/admin/users` → user list with roles
2. Create new user → `/dashboard/admin/users/new` → fills name/email, role assigned
3. `auth.adminCreateUser` → user created, can log in

**Gap:** ❌ Admin creates users directly (knows credentials). No invite-based flow from admin UI. Invite tokens exist in backend but are inaccessible from the UI.

---

### US-7.4 · View Audit Trail (Admin)
> As an Org Admin, I want to see a log of all actions taken in the org for compliance.

**Flow:**
1. `/dashboard/admin` → audit logs section
2. `org.getAuditLogs` returns recent audit events

**Gap:** 🔴 `org.getAuditLogs` has no `orgId` filter — an admin can see audit logs from all orgs in the database. Critical data boundary violation.

---

## Epic 8 — Notifications

### US-8.1 · Receive In-App Notifications (All Roles)
> As a user, I want to be notified of important events (WIG closed, session overdue, activity approved) without leaving the app.

**Flow:**
1. Bell icon in sidebar — red badge shows unread count (polls every 30s)
2. Click bell → dropdown feed with unread notifications, timestamps, and human-readable messages
3. Per-item "mark read" or "Mark all read"

**Works.**

---

### US-8.2 · Receive Email Notifications (All Roles)
> As a user, I want email notifications for critical events so I'm informed even when not logged in.

**Events covered:**
- WIG closed → email to all team members ✅
- Session overdue → email to user ✅
- Password reset → email ✅

**Gap:** ⚠️ No email on activity approved/rejected. No email when a new session is generated. Email send failures are silently swallowed — no logging, no retry.

---

## Epic 9 — Settings

### US-9.1 · Change Password (All Roles)
> As a user, I want to change my password from within the app.

**Flow:**
1. `/dashboard/settings` → change password form
2. `auth.changePassword({ currentPassword, newPassword })`

**Works.**

---

## Summary: Gap Map

| ID | Gap | Severity | Effort |
|----|-----|----------|--------|
| US-1.1 | No self-serve org creation UI | Low (internal tool) | Medium |
| US-1.2 | No invite management UI | **High** | Medium |
| US-1.4 | 10-min JWT silent logout | **High** | Low |
| US-3.2 | No edit UI for activity logs | Medium | Low |
| US-5.1 | Session step doesn't resume from saved state | **High** | Low |
| US-5.3 | No success screen after completing session | Medium | Low |
| US-5.4 | Dual cron implementations + N+1 bug | **High** | Medium |
| US-6.1 | Team lead sees org-wide stats, not team-scoped | Medium | Medium |
| US-6.2 | No historical week navigation for sessions | Medium | Low |
| US-7.3 | No invite-based admin user flow | Medium | Medium |
| US-7.4 | Audit log cross-org data leak | **Critical** | Low |
| US-8.2 | Silent email failures, missing notification events | Medium | Low |

---

*Generated from PRD v1.0 + live codebase — 2026-05-23*
