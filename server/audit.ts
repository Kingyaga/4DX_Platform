import { type PrismaClient, type Prisma } from "@/generated/prisma/client";

type AuditAction =
  | "WIG_CREATED"
  | "WIG_ACTIVATED"
  | "WIG_ARCHIVED"
  | "WIG_RESUMED"
  | "WIG_DELETED"
  | "WIG_CLOSED"
  | "LEAD_MEASURE_CREATED"
  | "LEAD_MEASURE_ARCHIVED"
  | "ACTIVITY_LOGGED"
  | "ACTIVITY_APPROVED"
  | "ACTIVITY_APPROVED_BULK"
  | "ACTIVITY_EDITED"
  | "SESSION_GENERATED"
  | "SESSION_ACCOUNT_COMPLETED"
  | "SESSION_REVIEW_COMPLETED"
  | "SESSION_COMMIT_COMPLETED"
  | "TEAM_CREATED"
  | "TEAM_ARCHIVED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "TEAM_LEAD_ASSIGNED"
  | "ORG_CREATED"
  | "ORG_MEMBER_INVITED"
  | "ORG_MEMBER_ROLE_UPDATED"
  | "LEAD_MEASURE_OWNERS_UPDATED";

interface AuditParams {
  db: PrismaClient;
  actorUserId: string;
  orgId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

export async function auditLog({
  db,
  actorUserId,
  orgId,
  entityType,
  entityId,
  action,
  before,
  after,
}: AuditParams) {
  try {
    const scopedOrgId =
      orgId ??
      (
        await db.orgMembership.findFirst({
          where: { userId: actorUserId },
          select: { orgId: true },
        })
      )?.orgId;

    if (!scopedOrgId) {
      throw new Error("Audit log org scope could not be resolved.");
    }

    await db.auditLog.create({
      data: {
        actorUserId,
        orgId: scopedOrgId,
        entityType,
        entityId,
        action,
        beforeJson: before,
        afterJson: after,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}
