const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const db = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Hash password
  const passwordHash = await bcrypt.hash("password123", 12);

  // Create organization
  const org = await db.organization.upsert({
    where: { slug: "test-org" },
    create: {
      name: "Test Organization",
      slug: "test-org",
      timezone: "UTC",
    },
    update: {},
  });

  console.log("✓ Organization created:", org.id);

  // Create admin user
  const adminUser = await db.user.upsert({
    where: { email: "dave@test.com" },
    create: {
      email: "dave@test.com",
      name: "Dave Admin",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "Dave Admin",
    },
  });

  console.log("✓ Admin user created:", adminUser.email);

  // Create admin org membership
  const adminMembership = await db.orgMembership.upsert({
    where: {
      userId_orgId: {
        userId: adminUser.id,
        orgId: org.id,
      },
    },
    create: {
      userId: adminUser.id,
      orgId: org.id,
      role: "ADMIN",
    },
    update: {},
  });

  console.log("✓ Admin membership created");

  // Create member user
  const memberUser = await db.user.upsert({
    where: { email: "member@test.com" },
    create: {
      email: "member@test.com",
      name: "Member User",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "Member User",
    },
  });

  console.log("✓ Member user created:", memberUser.email);

  // Create member org membership
  const memberMembership = await db.orgMembership.upsert({
    where: {
      userId_orgId: {
        userId: memberUser.id,
        orgId: org.id,
      },
    },
    create: {
      userId: memberUser.id,
      orgId: org.id,
      role: "MEMBER",
    },
    update: {},
  });

  console.log("✓ Member membership created");

  // Create team lead user
  const teamLeadUser = await db.user.upsert({
    where: { email: "teamlead@test.com" },
    create: {
      email: "teamlead@test.com",
      name: "Team Lead User",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "Team Lead User",
    },
  });

  console.log("✓ Team lead user created:", teamLeadUser.email);

  // Create team lead org membership
  const teamLeadMembership = await db.orgMembership.upsert({
    where: {
      userId_orgId: {
        userId: teamLeadUser.id,
        orgId: org.id,
      },
    },
    create: {
      userId: teamLeadUser.id,
      orgId: org.id,
      role: "MEMBER",
    },
    update: {},
  });

  console.log("✓ Team lead membership created");

  // Create test team
  const team = await db.team.upsert({
    where: {
      slug: "test-team",
    },
    create: {
      name: "Test Team",
      slug: "test-team",
      orgId: org.id,
      leadUserId: teamLeadUser.id,
    },
    update: {},
  });

  console.log("✓ Team created:", team.id);

  // Add team lead to team
  await db.teamMembership.upsert({
    where: {
      userId_teamId: {
        userId: teamLeadUser.id,
        teamId: team.id,
      },
    },
    create: {
      userId: teamLeadUser.id,
      teamId: team.id,
      role: "LEAD",
    },
    update: {},
  });

  console.log("✓ Team lead added to team as LEAD");

  // Add admin to team
  await db.teamMembership.upsert({
    where: {
      userId_teamId: {
        userId: adminUser.id,
        teamId: team.id,
      },
    },
    create: {
      userId: adminUser.id,
      teamId: team.id,
      role: "MEMBER",
    },
    update: {},
  });

  console.log("✓ Admin added to team as MEMBER");

  // Add member to team
  await db.teamMembership.upsert({
    where: {
      userId_teamId: {
        userId: memberUser.id,
        teamId: team.id,
      },
    },
    create: {
      userId: memberUser.id,
      teamId: team.id,
      role: "MEMBER",
    },
    update: {},
  });

  console.log("✓ Member added to team as MEMBER");

  console.log("\n✅ Seed completed successfully!");
  console.log("\nTest credentials:");
  console.log("  Admin:     dave@test.com / password123 (ADMIN role)");
  console.log("  Team Lead: teamlead@test.com / password123 (TEAM_LEAD role)");
  console.log("  Member:    member@test.com / password123 (MEMBER role)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
