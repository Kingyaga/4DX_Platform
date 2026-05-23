import { Prisma, type PrismaClient } from "@/generated/prisma/client";

type NotificationType =
  | "SESSION_READY"
  | "SESSION_OVERDUE"
  | "WIG_CLOSED"
  | "TEAM_INVITE"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "WIG_AT_RISK"
  | "PASSWORD_CHANGED"
  | "ACTIVITY_APPROVED"
  | "ACTIVITY_DECLINED"
  | "WIG_DEADLINE_PASSED"
  | "LEAD_MEASURE_OWNER_ADDED"
  | "LEAD_MEASURE_OWNER_REMOVED";

interface NotifyPayload {
  db: PrismaClient;
  userId: string;
  type: NotificationType;
  payload: Prisma.JsonValue;
}

export async function notify({ db, userId, type, payload }: NotifyPayload) {
  return db.notification.create({
    data: {
      userId,
      type,
      payloadJson: payload === null ? Prisma.JsonNull : payload,
    },
  });
}

export async function notifyMany({
  db,
  userIds,
  type,
  payload,
}: {
  db: PrismaClient;
  userIds: string[];
  type: NotificationType;
  payload: Prisma.JsonValue;
}) {
  return db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      payloadJson: payload === null ? Prisma.JsonNull : payload,
    })),
  });
}
