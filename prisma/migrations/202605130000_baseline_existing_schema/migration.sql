DO $$
BEGIN
  CREATE TYPE "OrgRole" AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER', 'OBSERVER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WIGStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ACHIEVED', 'MISSED', 'ABANDONED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "Cadence" AS ENUM ('WEEKLY', 'BIWEEKLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ActivityLogStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CommitmentStatus" AS ENUM ('PENDING', 'DONE', 'PARTIAL', 'NOT_DONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotDoneReason" AS ENUM ('WHIRLWIND', 'MISJUDGED', 'BLOCKED', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "defaultTeamId" TEXT,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrgMembership" (
  "id" TEXT NOT NULL,
  "role" "OrgRole" NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "orgId" TEXT NOT NULL,
  "leadUserId" TEXT NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamMembership" (
  "id" TEXT NOT NULL,
  "role" "TeamRole" NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WIG" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fromValue" DOUBLE PRECISION NOT NULL,
  "toValue" DOUBLE PRECISION NOT NULL,
  "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "status" "WIGStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "teamId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  CONSTRAINT "WIG_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadMeasure" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "cadence" "Cadence" NOT NULL,
  "targetValue" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "wigId" TEXT NOT NULL,
  CONSTRAINT "LeadMeasure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadMeasureOwner" (
  "id" TEXT NOT NULL,
  "leadMeasureId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "LeadMeasureOwner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "loggedForDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "status" "ActivityLogStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),
  "leadMeasureId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WeeklySession" (
  "id" TEXT NOT NULL,
  "weekStarting" TIMESTAMP(3) NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
  "accountDoneAt" TIMESTAMP(3),
  "reviewDoneAt" TIMESTAMP(3),
  "commitDoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "wigId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "WeeklySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Commitment" (
  "id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" "CommitmentStatus" NOT NULL DEFAULT 'PENDING',
  "notDoneReason" "NotDoneReason",
  "reflection" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "weeklySessionId" TEXT NOT NULL,
  "linkedLeadMeasureId" TEXT,
  CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT NOT NULL,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "orgId" TEXT NOT NULL,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "OrgMembership_userId_orgId_key" ON "OrgMembership"("userId", "orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_slug_key" ON "Team"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMembership_userId_teamId_key" ON "TeamMembership"("userId", "teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadMeasureOwner_leadMeasureId_userId_key" ON "LeadMeasureOwner"("leadMeasureId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_key_key" ON "ApiKey"("key");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrgMembership_userId_fkey') THEN
    ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrgMembership_orgId_fkey') THEN
    ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Team_orgId_fkey') THEN
    ALTER TABLE "Team" ADD CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMembership_userId_fkey') THEN
    ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMembership_teamId_fkey') THEN
    ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WIG_teamId_fkey') THEN
    ALTER TABLE "WIG" ADD CONSTRAINT "WIG_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadMeasure_wigId_fkey') THEN
    ALTER TABLE "LeadMeasure" ADD CONSTRAINT "LeadMeasure_wigId_fkey" FOREIGN KEY ("wigId") REFERENCES "WIG"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadMeasureOwner_leadMeasureId_fkey') THEN
    ALTER TABLE "LeadMeasureOwner" ADD CONSTRAINT "LeadMeasureOwner_leadMeasureId_fkey" FOREIGN KEY ("leadMeasureId") REFERENCES "LeadMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadMeasureOwner_userId_fkey') THEN
    ALTER TABLE "LeadMeasureOwner" ADD CONSTRAINT "LeadMeasureOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_leadMeasureId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_leadMeasureId_fkey" FOREIGN KEY ("leadMeasureId") REFERENCES "LeadMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_userId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklySession_wigId_fkey') THEN
    ALTER TABLE "WeeklySession" ADD CONSTRAINT "WeeklySession_wigId_fkey" FOREIGN KEY ("wigId") REFERENCES "WIG"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklySession_userId_fkey') THEN
    ALTER TABLE "WeeklySession" ADD CONSTRAINT "WeeklySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Commitment_weeklySessionId_fkey') THEN
    ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_weeklySessionId_fkey" FOREIGN KEY ("weeklySessionId") REFERENCES "WeeklySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Commitment_linkedLeadMeasureId_fkey') THEN
    ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_linkedLeadMeasureId_fkey" FOREIGN KEY ("linkedLeadMeasureId") REFERENCES "LeadMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_actorUserId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_orgId_fkey') THEN
    ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
