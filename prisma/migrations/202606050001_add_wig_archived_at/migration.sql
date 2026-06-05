ALTER TABLE "WIG" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "WIG_archivedAt_idx" ON "WIG"("archivedAt");
