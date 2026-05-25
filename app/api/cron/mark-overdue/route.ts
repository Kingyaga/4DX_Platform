import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sendSessionOverdueEmail } from "@/server/email";

// Called by Render cron every Tuesday at 09:00 UTC
// Authorization: CRON_SECRET header must match env var
export async function POST(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        include: { team: { select: { name: true } } },
      },
    },
  });

  if (overdueSessions.length === 0) {
    return NextResponse.json({ ok: true, markedOverdue: 0 });
  }

  // Bulk update to OVERDUE
  await db.weeklySession.updateMany({
    where: { id: { in: overdueSessions.map((s) => s.id) } },
    data: { status: "OVERDUE" },
  });

  // In-app notifications — one per unique user
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

  // Emails — fire-and-forget, don't block response
  overdueSessions.forEach((session) => {
    sendSessionOverdueEmail({
      to: session.user.email,
      name: session.user.name || session.user.email,
      teamName: session.wig.team.name,
    }).catch(() => {});
  });

  return NextResponse.json({
    ok: true,
    markedOverdue: overdueSessions.length,
    notifiedUsers: notifiedUserIds.size,
  });
}

function getThisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}
