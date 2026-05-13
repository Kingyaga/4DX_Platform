import { createPrismaClient } from "@/server/prisma-client";
import bcrypt from "bcryptjs";

const db = createPrismaClient();

async function main() {
  console.log("Creating test user and organization...");

  try {
    const hash = (p: string) => bcrypt.hashSync(p, 12);

    // Create or find organization
    const org = await db.organization.upsert({
      where: { slug: "test-org" },
      update: {},
      create: {
        name: "Test Organization",
        slug: "test-org",
        timezone: "Africa/Lagos",
      },
    });

    // Create test user
    const user = await db.user.upsert({
      where: { email: "test@example.com" },
      update: {},
      create: {
        name: "Test User",
        email: "test@example.com",
        passwordHash: hash("password123"),
      },
    });

    // Create org membership
    await db.orgMembership.upsert({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId: org.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        orgId: org.id,
        role: "ADMIN",
      },
    });

    console.log("Test user and organization created:", { user, org });
  } catch (error) {
    console.error("Error creating user:", error);
  } finally {
    await db.$disconnect();
  }
}

main();
