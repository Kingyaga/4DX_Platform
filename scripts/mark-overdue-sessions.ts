/**
 * Mark Overdue Sessions — Tuesday cron job
 *
 * Marks all PENDING or IN_PROGRESS sessions from the current week as OVERDUE
 * and sends an overdue email + in-app notification to each affected user.
 *
 * Invoked by render.yaml cron or directly: npx ts-node scripts/mark-overdue-sessions.ts
 */

import { PrismaClient } from "../generated/prisma/client";
import { sendSessionOverdueEmail } from "../server/email";

const db = new PrismaClient();

function getThisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function main() {
  const monday = getThisMonday();

  // Find all PENDING or IN_PROGRESS sessions from this week
  const overdueSessions = await db.weeklySession.findMany({
    where: {
      weekStarting: monday,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      wig: {
        include: {
          team: { select: { name: true } },
        },
      },
    },
  });

  if (overdueSessions.length === 0) {
    console.log("No overdue sessions found.");
    return;
  }

  console.log(`Marking ${overdueSessions.length} sessions as OVERDUE...`);

  // Bulk update all found sessions to OVERDUE
  const sessionIds = overdueSessions.map((s) => s.id);
  await db.weeklySession.updateMany({
    where: { id: { in: sessionIds } },
    data: { status: "OVERDUE" },
  });

  // Send in-app notifications (one per user, deduplicated)
  const notifiedUserIds = new Set<string>();
  const notificationRows: Array<{ userId: string; type: string; payloadJson: object }> = [];

  for (const session of overdueSessions) {
    if (!notifiedUserIds.has(session.userId)) {
      notifiedUserIds.add(session.userId);
      notificationRows.push({
        userId: session.userId,
        type: "SESSION_OVERDUE",
        payloadJson: {
          teamName: session.wig.team.name,
          weekStarting: monday.toISOString(),
        },
      });
    }
  }

  if (notificationRows.length > 0) {
    await db.notification.createMany({ data: notificationRows as any });
  }

  // Send overdue emails
  const emailPromises = overdueSessions.map((session) =>
    sendSessionOverdueEmail({
      to: session.user.email,
      name: session.user.name || session.user.email,
      teamName: session.wig.team.name,
    }).catch((err) => {
      console.error(`Email failed for ${session.user.email}:`, err);
    }),
  );

  await Promise.allSettled(emailPromises);

  console.log(`Done. Marked ${overdueSessions.length} sessions OVERDUE, notified ${notifiedUserIds.size} users.`);
}

main()
  .catch((err) => {
    console.error("mark-overdue-sessions failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
