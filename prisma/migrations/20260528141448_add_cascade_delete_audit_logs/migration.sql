-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "WeeklySession_snapshotJson_idx" ON "WeeklySession" USING GIN ("snapshotJson");
