CREATE TYPE "TrackingType" AS ENUM ('NUMERIC', 'MILESTONE');
CREATE TYPE "ActivityProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE');

ALTER TABLE "WIG"
  ADD COLUMN "trackingType" "TrackingType" NOT NULL DEFAULT 'NUMERIC',
  ALTER COLUMN "fromValue" DROP NOT NULL,
  ALTER COLUMN "toValue" DROP NOT NULL,
  ALTER COLUMN "currentValue" DROP NOT NULL,
  ALTER COLUMN "unit" DROP NOT NULL;

ALTER TABLE "LeadMeasure"
  ADD COLUMN "trackingType" "TrackingType" NOT NULL DEFAULT 'NUMERIC',
  ALTER COLUMN "targetValue" DROP NOT NULL,
  ALTER COLUMN "unit" DROP NOT NULL;

ALTER TABLE "ActivityLog"
  ADD COLUMN "progressStatus" "ActivityProgressStatus",
  ALTER COLUMN "value" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InviteToken_teamId_fkey') THEN
    ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
