DO $$
BEGIN
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'BOOLEAN';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'TIME';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'TEXT';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'PERCENTAGE';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'DURATION';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'CHECKLIST';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'COMPLETION';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'HYBRID';
  ALTER TYPE "TrackingType" ADD VALUE IF NOT EXISTS 'CUSTOM';
END $$;

DO $$
BEGIN
  CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ActivityLog"
  ADD COLUMN IF NOT EXISTS "trackingType" "TrackingType" NOT NULL DEFAULT 'NUMERIC',
  ADD COLUMN IF NOT EXISTS "valueJson" JSONB;

ALTER TABLE "WeeklySession"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "weekEnding" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "snapshotJson" JSONB,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "confidenceScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "teamId" TEXT,
  ADD COLUMN IF NOT EXISTS "facilitatorUserId" TEXT;

ALTER TABLE "Commitment"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WeeklySession"
  ALTER COLUMN "wigId" DROP NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "SessionBlocker" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT,
  "status" "BlockerStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "weeklySessionId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  CONSTRAINT "SessionBlocker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SessionTimelineEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "weeklySessionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  CONSTRAINT "SessionTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WeeklySession_teamId_idx" ON "WeeklySession"("teamId");
CREATE INDEX IF NOT EXISTS "WeeklySession_facilitatorUserId_idx" ON "WeeklySession"("facilitatorUserId");
CREATE INDEX IF NOT EXISTS "WeeklySession_teamId_weekStarting_idx" ON "WeeklySession"("teamId", "weekStarting");
CREATE INDEX IF NOT EXISTS "SessionBlocker_weeklySessionId_idx" ON "SessionBlocker"("weeklySessionId");
CREATE INDEX IF NOT EXISTS "SessionBlocker_createdByUserId_idx" ON "SessionBlocker"("createdByUserId");
CREATE INDEX IF NOT EXISTS "SessionTimelineEvent_weeklySessionId_idx" ON "SessionTimelineEvent"("weeklySessionId");
CREATE INDEX IF NOT EXISTS "SessionTimelineEvent_actorUserId_idx" ON "SessionTimelineEvent"("actorUserId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklySession_teamId_fkey') THEN
    ALTER TABLE "WeeklySession" ADD CONSTRAINT "WeeklySession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklySession_facilitatorUserId_fkey') THEN
    ALTER TABLE "WeeklySession" ADD CONSTRAINT "WeeklySession_facilitatorUserId_fkey" FOREIGN KEY ("facilitatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionBlocker_weeklySessionId_fkey') THEN
    ALTER TABLE "SessionBlocker" ADD CONSTRAINT "SessionBlocker_weeklySessionId_fkey" FOREIGN KEY ("weeklySessionId") REFERENCES "WeeklySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionBlocker_createdByUserId_fkey') THEN
    ALTER TABLE "SessionBlocker" ADD CONSTRAINT "SessionBlocker_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionTimelineEvent_weeklySessionId_fkey') THEN
    ALTER TABLE "SessionTimelineEvent" ADD CONSTRAINT "SessionTimelineEvent_weeklySessionId_fkey" FOREIGN KEY ("weeklySessionId") REFERENCES "WeeklySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionTimelineEvent_actorUserId_fkey') THEN
    ALTER TABLE "SessionTimelineEvent" ADD CONSTRAINT "SessionTimelineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
