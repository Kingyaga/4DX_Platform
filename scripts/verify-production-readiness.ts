import "dotenv/config";
import { createPrismaClient } from "@/server/prisma-client";

const db = createPrismaClient();
const rollbackMessage = "ROLLBACK_PRODUCTION_READINESS_VERIFICATION";

async function main() {
  const slug = `codex-verify-${Date.now()}`;
  let verifiedOrgId: string | null = null;

  try {
    await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: "Codex Verification", slug },
      });
      verifiedOrgId = org.id;

      const user = await tx.user.create({
        data: {
          email: `${slug}@example.com`,
          name: "Codex Verification User",
          passwordHash: null,
        },
      });

      await tx.orgMembership.create({
        data: { orgId: org.id, userId: user.id, role: "MEMBER" },
      });

      const team = await tx.team.create({
        data: {
          name: "Verification Team",
          slug,
          orgId: org.id,
          leadUserId: user.id,
        },
      });

      await tx.teamMembership.create({
        data: { teamId: team.id, userId: user.id, role: "LEAD" },
      });

      const wig = await tx.wIG.create({
        data: {
          title: "Verification WIG",
          trackingType: "NUMERIC",
          fromValue: 0,
          toValue: 10,
          currentValue: 0,
          unit: "pts",
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
          teamId: team.id,
          createdByUserId: user.id,
        },
      });

      const leadMeasure = await tx.leadMeasure.create({
        data: {
          name: "Verification Lead Measure",
          trackingType: "NUMERIC",
          cadence: "WEEKLY",
          targetValue: 10,
          unit: "pts",
          wigId: wig.id,
        },
      });

      const activityPayload = {
        version: 1,
        trackingType: "NUMERIC",
        value: 1.5,
        progressStatus: null,
      };

      const activity = await tx.activityLog.create({
        data: {
          leadMeasureId: leadMeasure.id,
          userId: user.id,
          value: 1.5,
          payloadJson: activityPayload,
          loggedForDate: new Date(),
        },
      });

      const legacyActivity = await tx.activityLog.create({
        data: {
          leadMeasureId: leadMeasure.id,
          userId: user.id,
          value: 2,
          loggedForDate: new Date(),
        },
      });

      const sessionSnapshot = {
        version: 1,
        team: { id: team.id, slug: team.slug },
        wig: { id: wig.id, title: wig.title },
      };

      const session = await tx.weeklySession.create({
        data: {
          userId: user.id,
          wigId: wig.id,
          weekStarting: new Date("2026-05-25T00:00:00.000Z"),
          snapshotJson: sessionSnapshot,
        },
      });

      const savedActivity = await tx.activityLog.findUniqueOrThrow({
        where: { id: activity.id },
      });
      const savedLegacyActivity = await tx.activityLog.findUniqueOrThrow({
        where: { id: legacyActivity.id },
      });
      const savedSession = await tx.weeklySession.findUniqueOrThrow({
        where: { id: session.id },
      });

      if (savedActivity.value !== 1.5) {
        throw new Error("Decimal activity value was not preserved.");
      }
      const savedPayload = savedActivity.payloadJson as typeof activityPayload;
      if (
        savedPayload.version !== activityPayload.version ||
        savedPayload.trackingType !== activityPayload.trackingType ||
        savedPayload.value !== activityPayload.value ||
        savedPayload.progressStatus !== activityPayload.progressStatus
      ) {
        throw new Error("Activity payload JSON was not preserved.");
      }
      if (savedLegacyActivity.payloadJson !== null) {
        throw new Error("Legacy activity compatibility check failed.");
      }
      const savedSnapshot = savedSession.snapshotJson as typeof sessionSnapshot;
      if (
        savedSnapshot.version !== sessionSnapshot.version ||
        savedSnapshot.team.slug !== sessionSnapshot.team.slug ||
        savedSnapshot.wig.title !== sessionSnapshot.wig.title
      ) {
        throw new Error("Weekly session snapshot JSON was not preserved.");
      }

      throw new Error(rollbackMessage);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMessage) {
      throw error;
    }
  }

  const remaining = await db.organization.count({ where: { slug } });
  if (remaining !== 0 || verifiedOrgId === null) {
    throw new Error("Rollback verification failed.");
  }

  console.log("Production readiness data checks passed and rolled back.");
}

main()
  .finally(async () => {
    await db.$disconnect();
  });
