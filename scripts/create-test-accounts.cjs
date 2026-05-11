const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const db = new PrismaClient();

async function main() {
  console.log("Creating test accounts...");

  const passwordHash = await bcrypt.hash("password123", 12);

  // Find organization
  const org = await db.organization.findFirst({
    where: { slug: "test-org" }
  });

  if (!org) {
    console.error("Organization not found. Run seed-simple.cjs first.");
    return;
  }

  // Create admin user
  const adminUser = await db.user.upsert({
    where: { email: "admin@4dx.com" },
    create: {
      email: "admin@4dx.com",
      name: "Admin User",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "Admin User",
    },
  });

  // Create admin membership
  await db.orgMembership.upsert({
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

  // Create team lead user
  const teamLeadUser = await db.user.upsert({
    where: { email: "james@4dx.com" },
    create: {
      email: "james@4dx.com",
      name: "James Team Lead",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "James Team Lead",
    },
  });

  // Create team lead membership
  await db.orgMembership.upsert({
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

  // Create Sales Team
  const salesTeam = await db.team.upsert({
    where: { slug: "sales-team" },
    create: {
      name: "Sales Team",
      slug: "sales-team",
      orgId: org.id,
      leadUserId: teamLeadUser.id,
    },
    update: {
      leadUserId: teamLeadUser.id,
    },
  });

  // Add team lead to team
  await db.teamMembership.upsert({
    where: {
      userId_teamId: {
        userId: teamLeadUser.id,
        teamId: salesTeam.id,
      },
    },
    create: {
      userId: teamLeadUser.id,
      teamId: salesTeam.id,
      role: "LEAD",
    },
    update: {},
  });

  // Create member user
  const memberUser = await db.user.upsert({
    where: { email: "tunde@4dx.com" },
    create: {
      email: "tunde@4dx.com",
      name: "Tunde Member",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "Tunde Member",
    },
  });

  // Create member membership
  await db.orgMembership.upsert({
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

  // Add member to sales team
  await db.teamMembership.upsert({
    where: {
      userId_teamId: {
        userId: memberUser.id,
        teamId: salesTeam.id,
      },
    },
    create: {
      userId: memberUser.id,
      teamId: salesTeam.id,
      role: "MEMBER",
    },
    update: {},
  });

  console.log("✅ Test accounts created:");
  console.log("  Admin: admin@4dx.com / password123");
  console.log("  Team Lead: james@4dx.com / password123");
  console.log("  Member: tunde@4dx.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });