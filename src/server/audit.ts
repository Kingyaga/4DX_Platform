import { type PrismaClient } from "@prisma/client";

type AuditAction =
  | "WIG_CREATED"
  | "WIG_CLOSED"
  | "LEAD_MEASURE_CREATED"
  | "LEAD_MEASURE_ARCHIVED"
  | "ACTIVITY_LOGGED"
  | "ACTIVITY_EDITED"
  | "SESSION_GENERATED"
  | "SESSION_ACCOUNT_COMPLETED"
  | "SESSION_REVIEW_COMPLETED"
  | "SESSION_COMMIT_COMPLETED"
  | "TEAM_CREATED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "TEAM_LEAD_ASSIGNED"
  | "ORG_CREATED"
  | "ORG_MEMBER_INVITED"
  | "ORG_MEMBER_ROLE_UPDATED";

interface AuditParams {
  db: PrismaClient;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export async function auditLog({
  db,
  actorUserId,
  entityType,
  entityId,
  action,
  before,
  after,
}: AuditParams) {
  try {
    await db.auditLog.create({
      data: {
        actorUserId,
        entityType,
        entityId,
        action,
        beforeJson: before ?? undefined,
        afterJson: after ?? undefined,
      },
    });
  } catch (error) {
    // Never block the main request if audit logging fails
    console.error("Audit log failed:", error);
  }
}
