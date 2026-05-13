import { createPrismaClient } from "@/server/prisma-client";

const db = createPrismaClient();

async function main() {
  console.log("Checking test user...");

  try {
    const user = await db.user.findUnique({
      where: { email: "test@example.com" },
      include: {
        orgMemberships: {
          include: {
            org: true,
          },
        },
      },
    });

    console.log("User:", user);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.$disconnect();
  }
}

main();
