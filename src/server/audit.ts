import { type PrismaClient } from "@prisma/client";
import { type JsonValue } from "@prisma/client/runtime/library";

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
  before?: JsonValue;
  after?: JsonValue;
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
        // AFTER
        beforeJson: before ? JSON.parse(JSON.stringify(before)) : undefined,
        afterJson: after ? JSON.parse(JSON.stringify(after)) : undefined,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}
