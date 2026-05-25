CREATE TABLE IF NOT EXISTS "Invite" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),
  "orgId" TEXT NOT NULL,
  "teamId" TEXT,
  "invitedByUserId" TEXT NOT NULL,
  CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InviteToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT,
  "orgId" TEXT NOT NULL,
  "teamId" TEXT,
  "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT NOT NULL,
  CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invite_token_key" ON "Invite"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "InviteToken_token_key" ON "InviteToken"("token");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invite_orgId_fkey') THEN
    ALTER TABLE "Invite" ADD CONSTRAINT "Invite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invite_teamId_fkey') THEN
    ALTER TABLE "Invite" ADD CONSTRAINT "Invite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invite_invitedByUserId_fkey') THEN
    ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InviteToken_orgId_fkey') THEN
    ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InviteToken_createdByUserId_fkey') THEN
    ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "OrgMembership_orgId_idx" ON "OrgMembership"("orgId");

CREATE INDEX IF NOT EXISTS "Invite_orgId_idx" ON "Invite"("orgId");
CREATE INDEX IF NOT EXISTS "Invite_teamId_idx" ON "Invite"("teamId");
CREATE INDEX IF NOT EXISTS "Invite_invitedByUserId_idx" ON "Invite"("invitedByUserId");
CREATE INDEX IF NOT EXISTS "Invite_expiresAt_idx" ON "Invite"("expiresAt");

CREATE INDEX IF NOT EXISTS "Team_orgId_idx" ON "Team"("orgId");
CREATE INDEX IF NOT EXISTS "Team_leadUserId_idx" ON "Team"("leadUserId");

CREATE INDEX IF NOT EXISTS "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

CREATE INDEX IF NOT EXISTS "WIG_teamId_idx" ON "WIG"("teamId");
CREATE INDEX IF NOT EXISTS "WIG_createdByUserId_idx" ON "WIG"("createdByUserId");
CREATE INDEX IF NOT EXISTS "WIG_status_idx" ON "WIG"("status");

CREATE INDEX IF NOT EXISTS "LeadMeasure_wigId_idx" ON "LeadMeasure"("wigId");

CREATE INDEX IF NOT EXISTS "LeadMeasureOwner_userId_idx" ON "LeadMeasureOwner"("userId");

CREATE INDEX IF NOT EXISTS "ActivityLog_leadMeasureId_idx" ON "ActivityLog"("leadMeasureId");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_loggedForDate_idx" ON "ActivityLog"("loggedForDate");

CREATE INDEX IF NOT EXISTS "WeeklySession_wigId_idx" ON "WeeklySession"("wigId");
CREATE INDEX IF NOT EXISTS "WeeklySession_userId_idx" ON "WeeklySession"("userId");
CREATE INDEX IF NOT EXISTS "WeeklySession_wigId_userId_weekStarting_idx" ON "WeeklySession"("wigId", "userId", "weekStarting");

CREATE INDEX IF NOT EXISTS "Commitment_weeklySessionId_idx" ON "Commitment"("weeklySessionId");
CREATE INDEX IF NOT EXISTS "Commitment_linkedLeadMeasureId_idx" ON "Commitment"("linkedLeadMeasureId");

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");

CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "ApiKey_orgId_idx" ON "ApiKey"("orgId");

CREATE INDEX IF NOT EXISTS "InviteToken_orgId_idx" ON "InviteToken"("orgId");
CREATE INDEX IF NOT EXISTS "InviteToken_teamId_idx" ON "InviteToken"("teamId");
CREATE INDEX IF NOT EXISTS "InviteToken_createdByUserId_idx" ON "InviteToken"("createdByUserId");
CREATE INDEX IF NOT EXISTS "InviteToken_expiresAt_idx" ON "InviteToken"("expiresAt");
