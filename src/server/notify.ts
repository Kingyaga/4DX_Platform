import { type PrismaClient } from "@prisma/client";

type NotificationType =
  | "SESSION_READY"
  | "SESSION_OVERDUE"
  | "WIG_CLOSED"
  | "TEAM_INVITE";

interface NotifyPayload {
  db: PrismaClient;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}

export async function notify({ db, userId, type, payload }: NotifyPayload) {
  return db.notification.create({
    data: {
      userId,
      type,
      payloadJson: payload,
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
  payload: Record<string, unknown>;
}) {
  return db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      payloadJson: payload,
    })),
  });
}
