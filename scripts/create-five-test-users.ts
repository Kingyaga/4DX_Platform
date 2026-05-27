import { createPrismaClient } from "@/server/prisma-client";
import bcrypt from "bcryptjs";

const db = createPrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hashSync(p, 12);

  const users = [
    { name: "Admin User", email: "admin@test.local", role: "ADMIN" },
    { name: "User One", email: "user1@test.local", role: "MEMBER" },
    { name: "User Two", email: "user2@test.local", role: "MEMBER" },
    { name: "User Three", email: "user3@test.local", role: "MEMBER" },
    { name: "User Four", email: "user4@test.local", role: "MEMBER" },
  ];

  try {
    // Ensure test org exists
    const org = await db.organization.upsert({
      where: { slug: "test-org" },
      update: {},
      create: { name: "Test Organization", slug: "test-org", timezone: "UTC" },
    });

    const created: Array<{ id: string; email: string }> = [];

    for (const u of users) {
      const user = await db.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          name: u.name,
          email: u.email,
          passwordHash: hash("password123"),
        },
      });

      // Create org membership
      await db.orgMembership.upsert({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
        update: { role: u.role === "ADMIN" ? "ADMIN" : "MEMBER" },
        create: {
          userId: user.id,
          orgId: org.id,
          role: u.role === "ADMIN" ? "ADMIN" : "MEMBER",
        },
      });

      created.push({ id: user.id, email: user.email });
    }

    console.log("✅ Created/updated test users:");
    for (const c of created) console.log(`- ${c.email} / password123`);
  } catch (err) {
    console.error(err);
  } finally {
    await db.$disconnect();
  }
}

main();
