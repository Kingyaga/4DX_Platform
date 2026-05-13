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
    update: {
      role: "MEMBER",
    },
  });
  
  console.log("Team Lead membership created");
  
  // Create a team and assign team lead
  const team = await db.team.upsert({
    where: { slug: "test-team" },
    create: {
      name: "Test Team",
      slug: "test-team",
      orgId: org.id,
      leadUserId: teamLeadUser.id,
    },
    update: {
      name: "Test Team",
      leadUserId: teamLeadUser.id,
    },
  });
  
  console.log("Team created:", team.id);
  
  // Add team lead as team member with LEAD role
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
    update: {
      role: "LEAD",
    },
  });
  
  console.log("Team lead added to team");
  
  // Add admin as team member
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
    update: {
      role: "MEMBER",
    },
  });
  
  console.log("Admin added to team");
  
  // TODO: Create a test invite once backend pushes the Invite table migration
  // const invite = await db.invite.create({
  //   data: {
  //     token: "test-invite-token-123",
  //     email: "member@test.com",
  //     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  //     orgId: org.id,
  //     teamId: team.id,
  //     invitedByUserId: adminUser.id,
  //   },
  // });
  // 
  // console.log("Test invite created:", invite.token);
  
  console.log("\n✅ Seed completed!");
  console.log(`
Test Users Created:
- Email: dave@test.com / Password: password123 (Admin)
- Email: team@test.com / Password: password123 (Team Lead)

Test Invite:
- Token: test-invite-token-123
- Email: member@test.com
- Signup URL: http://localhost:3001/signup?token=test-invite-token-123
  `);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
