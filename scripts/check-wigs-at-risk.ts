import "dotenv/config";
import { PrismaClient, type WIG } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { sendWigAtRiskEmail } from "../src/server/email";

const db = new PrismaClient();

const DEFAULT_PROGRESS_TOLERANCE = 0.15;
const DEFAULT_DEADLINE_WARNING_DAYS = 14;
const DEFAULT_DEADLINE_MIN_PROGRESS = 0.85;

type WigRisk = {
  isAtRisk: boolean;
  reason: string;
  progress: number;
  expectedProgress: number;
  daysRemaining: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function getProgress(wig: Pick<WIG, "fromValue" | "toValue" | "currentValue">) {
  const total = wig.toValue - wig.fromValue;
  if (total === 0) return 1;

  return clamp((wig.currentValue - wig.fromValue) / total, 0, 1);
}

function assessWigRisk(wig: Pick<WIG, "createdAt" | "deadline" | "fromValue" | "toValue" | "currentValue">, now = new Date()): WigRisk {
  const progressTolerance = numberFromEnv("WIG_RISK_PROGRESS_TOLERANCE", DEFAULT_PROGRESS_TOLERANCE);
  const deadlineWarningDays = numberFromEnv("WIG_RISK_DEADLINE_WARNING_DAYS", DEFAULT_DEADLINE_WARNING_DAYS);
  const deadlineMinProgress = numberFromEnv("WIG_RISK_DEADLINE_MIN_PROGRESS", DEFAULT_DEADLINE_MIN_PROGRESS);

  const progress = getProgress(wig);
  const durationMs = wig.deadline.getTime() - wig.createdAt.getTime();
  const elapsedMs = now.getTime() - wig.createdAt.getTime();
  const expectedProgress = durationMs <= 0 ? 1 : clamp(elapsedMs / durationMs, 0, 1);
  const daysRemaining = Math.ceil((wig.deadline.getTime() - now.getTime()) / 86_400_000);

  if (daysRemaining < 0 && progress < 1) {
    return {
      isAtRisk: true,
      reason: "Deadline has passed and the WIG is not complete.",
      progress,
      expectedProgress,
      daysRemaining,
    };
  }

  if (daysRemaining <= deadlineWarningDays && progress < deadlineMinProgress) {
    return {
      isAtRisk: true,
      reason: `Deadline is within ${deadlineWarningDays} days and progress is below ${Math.round(deadlineMinProgress * 100)}%.`,
      progress,
      expectedProgress,
      daysRemaining,
    };
  }

  if (progress + progressTolerance < expectedProgress) {
    return {
      isAtRisk: true,
      reason: `Progress is more than ${Math.round(progressTolerance * 100)}% behind the expected pace.`,
      progress,
      expectedProgress,
      daysRemaining,
    };
  }

  return {
    isAtRisk: false,
    reason: "On pace.",
    progress,
    expectedProgress,
    daysRemaining,
  };
}

async function main() {
  const now = new Date();
  const dedupeSince = new Date(now);
  dedupeSince.setHours(0, 0, 0, 0);

  const wigs = await db.wIG.findMany({
    where: {
      status: "ACTIVE",
      closedAt: null,
    },
    include: {
      team: {
        include: {
          members: {
            where: { role: "LEAD" },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          org: {
            include: {
              memberships: {
                where: { role: "ADMIN" },
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  let atRiskCount = 0;
  let notifiedCount = 0;

  for (const wig of wigs) {
    const risk = assessWigRisk(wig, now);
    if (!risk.isAtRisk) continue;

    atRiskCount += 1;

    const recipients = new Map<string, { id: string; name: string; email: string }>();

    for (const member of wig.team.members) {
      recipients.set(member.user.id, member.user);
    }

    for (const membership of wig.team.org.memberships) {
      recipients.set(membership.user.id, membership.user);
    }

    for (const user of recipients.values()) {
      const alreadyNotified = await db.notification.findFirst({
        where: {
          userId: user.id,
          type: "WIG_AT_RISK",
          createdAt: { gte: dedupeSince },
          payloadJson: {
            path: ["wigId"],
            equals: wig.id,
          },
        },
      });

      if (alreadyNotified) continue;

      const payload = {
        wigId: wig.id,
        wigTitle: wig.title,
        teamId: wig.team.id,
        teamName: wig.team.name,
        reason: risk.reason,
        progress: Math.round(risk.progress * 100),
        expectedProgress: Math.round(risk.expectedProgress * 100),
        daysRemaining: risk.daysRemaining,
      };

      await db.notification.create({
        data: {
          userId: user.id,
          type: "WIG_AT_RISK",
          payloadJson: payload as Prisma.InputJsonValue,
        },
      });

      await sendWigAtRiskEmail({
        to: user.email,
        name: user.name,
        teamName: wig.team.name,
        wigTitle: wig.title,
      });

      notifiedCount += 1;
    }
  }

  console.log(`Checked ${wigs.length} active WIGs. Found ${atRiskCount} at risk. Sent ${notifiedCount} notifications.`);
}

main()
  .catch((error) => {
    console.error("WIG at-risk notification job failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
