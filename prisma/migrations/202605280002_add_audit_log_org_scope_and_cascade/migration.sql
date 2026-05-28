ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

UPDATE "AuditLog" AS al
SET "orgId" = (
  SELECT om."orgId"
  FROM "OrgMembership" AS om
  WHERE om."userId" = al."actorUserId"
  ORDER BY om."orgId"
  LIMIT 1
)
WHERE al."orgId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AuditLog" WHERE "orgId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make AuditLog.orgId required because some audit rows could not be scoped to an organization.';
  END IF;
END $$;

ALTER TABLE "AuditLog" ALTER COLUMN "orgId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AuditLog_orgId_idx" ON "AuditLog"("orgId");

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_orgId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorUserId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
