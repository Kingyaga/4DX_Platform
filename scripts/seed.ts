import { db } from "../src/server/db";
import bcrypt from "bcryptjs";

async function main() {
  // Hash password for "password123"
  const passwordHash = await bcrypt.hash("password123", 12);
  
  console.log("Creating test user...");
  
  // Find or create organization
  const org = await db.organization.upsert({
    where: { slug: "test-org" },
    create: {
      name: "Test Organization",
      slug: "test-org",
      timezone: "UTC",
    },
    update: {},
  });
  
  console.log("Organization:", org.id);
  
  // Create test user (admin)
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
  
  console.log("Admin User created:", adminUser.email);
  
  // Create org membership for admin
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
    update: {
      role: "ADMIN",
    },
  });
  
  console.log("Admin membership created");
  
  // Create another test user (team lead)
  const teamLeadUser = await db.user.upsert({
    where: { email: "team@test.com" },
    create: {
      email: "team@test.com",
      name: "Team Lead User",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "Team Lead User",
    },
  });
  
  console.log("Team Lead User created:", teamLeadUser.email);
  
  // Create org membership for team lead
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
    update: {
      role: "MEMBER",
    },
  });
  
  console.log("Team Lead membership created");
  
  // Create a team and assign team lead
  const team = await db.team.create({
    data: {
      name: "Test Team",
      slug: "test-team",
      orgId: org.id,
      leadUserId: teamLeadUser.id,
    },
  });
  
  console.log("Team created:", team.id);
  
  // Add team lead as team member with LEAD role
  const teamLeadTeamMembership = await db.teamMembership.create({
    data: {
      userId: teamLeadUser.id,
      teamId: team.id,
      role: "LEAD",
    },
  });
  
  console.log("Team lead added to team");
  
  // Add admin as team member
  const adminTeamMembership = await db.teamMembership.create({
    data: {
      userId: adminUser.id,
      teamId: team.id,
      role: "MEMBER",
    },
  });
  
  console.log("Admin added to team");
  
  console.log("\n✅ Seed completed!");
  console.log(`
Test Users Created:
- Email: dave@test.com / Password: password123 (Admin)
- Email: team@test.com / Password: password123 (Team Lead)
  `);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
