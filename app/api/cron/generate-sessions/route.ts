import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { notify, notifyMany } from "@/server/notify";
import { sendSessionReadyEmail } from "@/server/email";

// Called by Vercel Cron every Monday at 00:00 UTC (see vercel.json)
// Authorization: CRON_SECRET header must match env var
export async function POST(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monday = getThisMonday();
  let totalCreated = 0;
  let teamCount = 0;

  const teams = await db.team.findMany({
    where: { archivedAt: null },
    include: {
      members: true,
      wigs: { where: { status: "ACTIVE" } },
    },
  });

  // Pre-fetch all existing sessions for this Monday across all teams (one query total)
  const existingSessions = await db.weeklySession.findMany({
    where: { weekStarting: monday },
    select: { userId: true, wigId: true },
  });
  const existingSet = new Set(existingSessions.map((s) => `${s.userId}:${s.wigId}`));

  for (const team of teams) {
    if (team.wigs.length === 0) continue;

    const sessionsToCreate: Array<{
      userId: string;
      wigId: string;
      weekStarting: Date;
      status: "PENDING";
    }> = [];

    for (const member of team.members) {
      for (const wig of team.wigs) {
        if (existingSet.has(`${member.userId}:${wig.id}`)) continue;
        sessionsToCreate.push({
          userId: member.userId,
          wigId: wig.id,
          weekStarting: monday,
          status: "PENDING",
        });
      }
    }

    if (sessionsToCreate.length === 0) continue;

    await db.weeklySession.createMany({ data: sessionsToCreate, skipDuplicates: true });
    totalCreated += sessionsToCreate.length;
    teamCount++;

    const uniqueUserIds = [...new Set(sessionsToCreate.map((s) => s.userId))];
    await notifyMany({
      db,
      userIds: uniqueUserIds,
      type: "SESSION_READY",
      payload: {
        teamSlug: team.slug,
        weekStarting: monday.toISOString(),
        message: "Your weekly session is ready. Complete it before end of week.",
      },
    });

    const members = await db.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, name: true, email: true },
    });

    await Promise.all(
      members.map((m) =>
        sendSessionReadyEmail({ to: m.email, name: m.name, teamName: team.name }),
      ),
    );
  }

  return NextResponse.json({ ok: true, monday: monday.toISOString(), totalCreated, teamCount });
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
