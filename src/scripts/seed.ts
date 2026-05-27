import { createPrismaClient } from "../../server/prisma-client";
import bcrypt from "bcryptjs";

const db = createPrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing test data
  await db.commitment.deleteMany();
  await db.weeklySession.deleteMany();
  await db.activityLog.deleteMany();
  await db.leadMeasureOwner.deleteMany();
  await db.leadMeasure.deleteMany();
  await db.wIG.deleteMany();
  await db.teamMembership.deleteMany();
  await db.team.deleteMany();
  await db.orgMembership.deleteMany();
  await db.organization.deleteMany();
  await db.inviteToken.deleteMany();
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.user.deleteMany();

  console.log("✅ Cleaned existing data");

  // Create users
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await db.user.create({
    data: {
      name: "Sarah Admin",
      email: "admin@4dx.com",
      passwordHash,
    },
  });

  const leadA = await db.user.create({
    data: {
      name: "James Lead",
      email: "james@4dx.com",
      passwordHash,
    },
  });

  const leadB = await db.user.create({
    data: {
      name: "Amara Lead",
      email: "amara@4dx.com",
      passwordHash,
    },
  });

  const member1 = await db.user.create({
    data: {
      name: "Tunde Member",
      email: "tunde@4dx.com",
      passwordHash,
    },
  });

  const member2 = await db.user.create({
    data: {
      name: "Chioma Member",
      email: "chioma@4dx.com",
      passwordHash,
    },
  });

  const member3 = await db.user.create({
    data: {
      name: "Dave Member",
      email: "dave@4dx.com",
      passwordHash,
    },
  });

  console.log("✅ Created users");

  // Create organization
  const org = await db.organization.create({
    data: {
      name: "Acme Corporation",
      slug: "acme",
      timezone: "Africa/Lagos",
    },
  });

  // Org memberships
  await db.orgMembership.createMany({
    data: [
      { userId: admin.id, orgId: org.id, role: "ADMIN" },
      { userId: leadA.id, orgId: org.id, role: "MEMBER" },
      { userId: leadB.id, orgId: org.id, role: "MEMBER" },
      { userId: member1.id, orgId: org.id, role: "MEMBER" },
      { userId: member2.id, orgId: org.id, role: "MEMBER" },
      { userId: member3.id, orgId: org.id, role: "MEMBER" },
    ],
  });

  console.log("✅ Created organization and memberships");

  // Create Team A — Sales
  const teamA = await db.team.create({
    data: {
      name: "Sales Team",
      slug: "sales-team",
      orgId: org.id,
      leadUserId: leadA.id,
    },
  });

  await db.teamMembership.createMany({
    data: [
      { userId: leadA.id, teamId: teamA.id, role: "LEAD" },
      { userId: member1.id, teamId: teamA.id, role: "MEMBER" },
      { userId: member2.id, teamId: teamA.id, role: "MEMBER" },
    ],
  });

  // Create Team B — Operations
  const teamB = await db.team.create({
    data: {
      name: "Operations Team",
      slug: "operations-team",
      orgId: org.id,
      leadUserId: leadB.id,
    },
  });

  await db.teamMembership.createMany({
    data: [
      { userId: leadB.id, teamId: teamB.id, role: "LEAD" },
      { userId: member3.id, teamId: teamB.id, role: "MEMBER" },
      { userId: admin.id, teamId: teamB.id, role: "MEMBER" },
    ],
  });

  console.log("✅ Created teams and memberships");

  // Create WIGs for Sales Team
  const wigA1 = await db.wIG.create({
    data: {
      title: "Increase monthly revenue",
      description: "Grow monthly revenue through new client acquisition",
      fromValue: 500000,
      toValue: 1000000,
      currentValue: 650000,
      unit: "NGN",
      deadline: new Date("2026-12-31"),
      status: "ACTIVE",
      teamId: teamA.id,
      createdByUserId: leadA.id,
    },
  });

  const wigA2 = await db.wIG.create({
    data: {
      title: "Increase client retention rate",
      description: "Reduce churn by improving client satisfaction",
      fromValue: 70,
      toValue: 90,
      currentValue: 75,
      unit: "%",
      deadline: new Date("2026-09-30"),
      status: "ACTIVE",
      teamId: teamA.id,
      createdByUserId: leadA.id,
    },
  });

  // Create WIG for Operations Team
  const wigB1 = await db.wIG.create({
    data: {
      title: "Reduce order processing time",
      description: "Cut average processing time from 5 days to 2 days",
      fromValue: 5,
      toValue: 2,
      currentValue: 4,
      unit: "days",
      deadline: new Date("2026-08-31"),
      status: "ACTIVE",
      teamId: teamB.id,
      createdByUserId: leadB.id,
    },
  });

  console.log("✅ Created WIGs");

  // Lead Measures for WIG A1
  const lm1 = await db.leadMeasure.create({
    data: {
      name: "Weekly sales calls",
      cadence: "WEEKLY",
      targetValue: 20,
      unit: "calls",
      wigId: wigA1.id,
    },
  });

  const lm2 = await db.leadMeasure.create({
    data: {
      name: "New proposals submitted",
      cadence: "WEEKLY",
      targetValue: 5,
      unit: "proposals",
      wigId: wigA1.id,
    },
  });

  // Lead Measures for WIG A2
  const lm3 = await db.leadMeasure.create({
    data: {
      name: "Client check-in calls",
      cadence: "WEEKLY",
      targetValue: 10,
      unit: "calls",
      wigId: wigA2.id,
    },
  });

  // Lead Measures for WIG B1
  const lm4 = await db.leadMeasure.create({
    data: {
      name: "Orders processed same day",
      cadence: "WEEKLY",
      targetValue: 50,
      unit: "orders",
      wigId: wigB1.id,
    },
  });

  console.log("✅ Created lead measures");

  // Activity logs — last 4 weeks
  const weeks = [28, 21, 14, 7];

  for (const daysAgo of weeks) {
    const logDate = new Date();
    logDate.setDate(logDate.getDate() - daysAgo);

    await db.activityLog.createMany({
      data: [
        {
          leadMeasureId: lm1.id,
          userId: member1.id,
          value: 18,
          loggedForDate: logDate,
          note: "Good week for calls",
        },
        {
          leadMeasureId: lm1.id,
          userId: member2.id,
          value: 15,
          loggedForDate: logDate,
        },
        {
          leadMeasureId: lm2.id,
          userId: member1.id,
          value: 4,
          loggedForDate: logDate,
        },
        {
          leadMeasureId: lm3.id,
          userId: member2.id,
          value: 9,
          loggedForDate: logDate,
        },
        {
          leadMeasureId: lm4.id,
          userId: member3.id,
          value: 45,
          loggedForDate: logDate,
        },
      ],
    });
  }

  console.log("✅ Created activity logs");

  // Weekly sessions for this week
  const monday = getThisMonday();

  const sessions = await db.weeklySession.createMany({
    data: [
      {
        userId: member1.id,
        wigId: wigA1.id,
        weekStarting: monday,
        status: "COMPLETE",
        accountDoneAt: new Date(),
        reviewDoneAt: new Date(),
        commitDoneAt: new Date(),
      },
      {
        userId: member2.id,
        wigId: wigA1.id,
        weekStarting: monday,
        status: "IN_PROGRESS",
        accountDoneAt: new Date(),
      },
      {
        userId: member1.id,
        wigId: wigA2.id,
        weekStarting: monday,
        status: "PENDING",
      },
      {
        userId: member3.id,
        wigId: wigB1.id,
        weekStarting: monday,
        status: "PENDING",
      },
    ],
  });

  console.log("✅ Created weekly sessions");

  console.log("\n🎉 Seed complete! Test accounts:");
  console.log("─────────────────────────────────");
  console.log("Admin:     admin@4dx.com   / password123");
  console.log("Lead A:    james@4dx.com   / password123");
  console.log("Lead B:    amara@4dx.com   / password123");
  console.log("Member 1:  tunde@4dx.com   / password123");
  console.log("Member 2:  chioma@4dx.com  / password123");
  console.log("Member 3:  dave@4dx.com    / password123");
  console.log("─────────────────────────────────");
  console.log("Org slug:  acme");
  console.log("Team A:    sales-team");
  console.log("Team B:    operations-team");
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

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
