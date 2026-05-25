import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const db = new PrismaClient();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const emailFrom = process.env.EMAIL_FROM || "4DX Platform <onboarding@resend.dev>";

function getThisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function sendSessionReadyEmail(to: string, name: string, teamName: string) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: emailFrom,
      to,
      subject: "Your weekly session is ready",
      html: `<h2>Hi ${name},</h2><p>Your weekly 4DX session for <strong>${teamName}</strong> is ready. Complete your Account, Review, and Commit steps before end of week.</p>`,
    });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err);
  }
}

async function main() {
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
        sessionsToCreate.push({ userId: member.userId, wigId: wig.id, weekStarting: monday, status: "PENDING" });
      }
    }

    if (sessionsToCreate.length === 0) continue;

    await db.weeklySession.createMany({ data: sessionsToCreate, skipDuplicates: true });
    totalCreated += sessionsToCreate.length;
    teamCount++;

    const uniqueUserIds = [...new Set(sessionsToCreate.map((s) => s.userId))];

    await db.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        type: "SESSION_READY" as const,
        payloadJson: {
          teamSlug: team.slug,
          weekStarting: monday.toISOString(),
          message: "Your weekly session is ready. Complete it before end of week.",
        },
      })),
    });

    const members = await db.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, name: true, email: true },
    });

    for (const m of members) {
      await sendSessionReadyEmail(m.email, m.name, team.name);
    }
  }

  console.log(`Generated sessions for week of ${monday.toISOString()}. Teams: ${teamCount}, sessions created: ${totalCreated}.`);
}

main()
  .catch((err) => {
    console.error("Session generation job failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
