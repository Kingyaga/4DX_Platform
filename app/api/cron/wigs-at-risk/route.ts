import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { sendWigAtRiskEmail } from "@/server/email";

export async function POST(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find active numeric WIGs where progress is below 50% of target with less than 25% of time remaining.
  // Milestone WIGs need a different risk model and are intentionally skipped here.
  const now = new Date();
  const wigs = await db.wIG.findMany({
    where: { status: "ACTIVE", trackingType: "NUMERIC", archivedAt: null },
    include: {
      team: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });

  let notified = 0;

  for (const wig of wigs) {
    if (wig.fromValue === null || wig.toValue === null || wig.currentValue === null) continue;

    const totalDays = (wig.deadline.getTime() - wig.createdAt.getTime()) / 86_400_000;
    if (totalDays <= 0) continue;

    const daysRemaining = (wig.deadline.getTime() - now.getTime()) / 86_400_000;
    const timeRemainingPct = daysRemaining / totalDays;

    const progressRange = wig.toValue - wig.fromValue;
    const progressPct = progressRange > 0 ? (wig.currentValue - wig.fromValue) / progressRange : 0;

    // At-risk: less than 25% time left but less than 50% progress
    if (timeRemainingPct > 0.25 || progressPct >= 0.5) continue;

    const leadMember = wig.team.members.find((m) => m.userId === wig.team.leadUserId);
    if (!leadMember) continue;

    await notify({
      db,
      userId: wig.team.leadUserId,
      type: "WIG_AT_RISK",
      payload: { wigTitle: wig.title, wigId: wig.id, progressPct: Math.round(progressPct * 100) },
    });

    sendWigAtRiskEmail({
      to: leadMember.user.email,
      name: leadMember.user.name || leadMember.user.email,
      teamName: wig.team.name,
      wigTitle: wig.title,
    }).catch(() => {});

    notified++;
  }

  return NextResponse.json({ ok: true, notified });
}
