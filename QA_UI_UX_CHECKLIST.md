# 4DX Platform QA and UI/UX Checklist

Use this checklist for end-to-end release testing across admin, team lead, and member roles. Mark each item pass/fail and attach screenshots or console/network traces for failures.

## Fixes to Verify First

- Approve All requests shows a real count, never `undefined`.
- Team reports lag progress uses baseline-to-target math: `(current - fromValue) / (toValue - fromValue)`.
- Download Report and Share Report are visibly marked coming soon until backend export/share support exists.
- WIG current and target values cannot be negative in the UI or backend.
- WIG target value must be greater than current value in the UI or backend.
- Creating a WIG shows a confirmation prompt before submission.
- Admin-created users receive an email with account details when email is configured.
- Org admins receive an in-app notification when a new WIG is created.

## Onboarding and Auth

- Invite-only signup blocks users without a valid token.
- Expired, used, or mismatched-email invite links show clear errors.
- Valid invite signup creates the user, org membership, and team membership when included.
- Admin-created user can log in with the generated/admin-supplied password.
- Password reset request sends email when Resend is configured.
- Password reset with valid token succeeds; expired/used token fails clearly.
- Change password rejects wrong current password and mismatched/invalid new password.
- Logout clears session and redirects to login.

## Admin

- Create team; team appears in list and dashboards.
- Assign team lead; user sees team lead navigation for that team.
- Create user directly; user receives account details email.
- Create user with team assignment; user appears in that team.
- Delete user; user cannot log in and disappears from admin lists.
- Org dashboard execution score matches team-by-team lead measure health.
- Org activity feed shows approved logs across all teams only.
- At-risk WIG page shows WIGs behind expected pace.
- Admin receives in-app notification when team lead creates a WIG.

## Team Lead: WIG Lifecycle

- Create WIG with title, current value, target value, unit, deadline, and description.
- Live WIG statement updates while typing.
- Negative current or target values are blocked.
- Target less than or equal to current value is blocked.
- Confirmation prompt appears before WIG creation.
- WIG appears in current WIGs after creation.
- Two active WIG cap is enforced by backend with a clear error.
- Edit WIG updates title, deadline, and description.
- Target reached state appears when current value is at or above target.
- Close WIG requires outcome: ACHIEVED, MISSED, or ABANDONED.
- Closed WIG moves to Closed History and sends notifications.

## Team Lead: Lead Measures

- Add lead measure to WIG with name, target, unit, cadence, description.
- Cannot add a fourth lead measure.
- Assign/reassign owners from team members.
- Owners receive added/removed notifications.
- Lead measure progress equals cumulative approved activity logs.

## Team Lead: Activity Approval

- Pending requests show member, WIG, lead measure, value, unit, date, and note.
- Requests nav badge matches pending count.
- Approve single request clears it, updates scoreboard, and notifies member.
- Decline single request clears it and notifies member.
- Approve All clears all pending requests and shows the correct count.
- WIG current value recomputes after approvals.

## Member Activity

- Activity dropdown shows only lead measures the member owns.
- Unit is visible next to the value field.
- Submitting a log creates a pending request.
- Pending logs are visually distinct from approved logs.
- Member can edit own pending log within 24 hours.
- Edit action disappears or fails clearly after 24 hours.
- Approved logs appear in Recent Logs with status clarity.

## Weekly Session

- Monday cron generates sessions for every member and active WIG.
- Session banner appears until completion.
- Account step shows prior commitments and enforces reason for NOT_DONE.
- Review step shows approved activity only and on-track status.
- Commit step requires commitment text and lead measure link.
- Completed sessions update team lead roster.
- Tuesday cron marks incomplete sessions overdue.

## Scoreboard

- Active WIG scoreboard loads with baseline, current, target, and days remaining.
- Multiple active WIGs show selector tabs.
- Lag progress is baseline-to-target, not current divided by target.
- Lead cards show cumulative approved totals.
- By-owner breakdown shows all member contributions.
- Target reached banner appears at or above target.
- Display Mode opens full-screen dark view.
- Escape and Exit close Display Mode.
- Auto-refresh runs every 60 seconds.

## WIG History

- Closed WIGs show under Closed History.
- Retrospective detail opens from history list.
- Outcome colors are ACHIEVED green, MISSED red, ABANDONED grey.
- Final lag result shows baseline, current/final, target, progress, and timeline.
- Lead measure breakdown shows cumulative totals and target met status.
- Per-member contribution percentages are correct.

## Team Members

- Members page lists name, role, email, and join date.
- Team lead can add an existing org user to team.
- Error appears when email/user is not in org.
- Remove member requires confirmation and updates list.
- Clicking member opens that member's activity history.

## Notifications

- Bell unread count refreshes without page reload.
- Notification list has readable copy for known types and generic fallback for unknown types.
- Mark one as read decrements count.
- Mark all as read clears count.
- SESSION_READY, SESSION_OVERDUE, WIG_CREATED, WIG_CLOSED, WIG_AT_RISK, ACTIVITY_APPROVED, ACTIVITY_DECLINED, LEAD_MEASURE_OWNER_ADDED, and LEAD_MEASURE_OWNER_REMOVED are covered.

## UI/UX

- Pages use consistent spacing, borders, typography, and button styles.
- Primary actions are visually distinct from secondary actions.
- Destructive actions are red and require confirmation when irreversible.
- Loading states appear on every data-fetching page.
- Mutation buttons disable and show progress while submitting.
- Network errors show retryable error states.
- Empty states are present; no blank panels.
- Role-forbidden pages redirect or show graceful errors.
- Active nav item is clear.
- Role-specific nav hides unauthorized items.
- Tables and card grids do not overflow on narrow screens.
- Scoreboard tabs scroll horizontally on small screens.
- Display Mode is readable on projector/wall display.
- Success messages auto-dismiss where appropriate.

## Full-Cycle Manual Test

Create team -> assign lead -> create user -> user receives email -> create WIG -> add lead measure -> assign owner -> log activity -> approve -> scoreboard updates -> complete weekly session -> close WIG -> review history.

## Backend-Dependent or Not Fully Implemented

- Report download needs a backend export endpoint.
- Report sharing needs a backend share-link or email endpoint.
- Draft-to-active WIG workflow is not implemented yet; current creation path creates an active WIG.
- Lead-measure owner assignment notifications must be verified against backend owner assignment implementation.
- Activity approval/decline emails must be verified against email implementation for those mutations.
- Public/embedded scoreboard URL is not implemented.
- Slack/Teams notifications are not implemented.
