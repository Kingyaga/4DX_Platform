import { createPrismaClient } from "@/server/prisma-client";

const db = createPrismaClient();

async function main() {
  const user = await db.user.findUnique({
    where: { email: "test@example.com" },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  console.log("User:", JSON.stringify(user, null, 2));
  
  if (user?.passwordHash) {
    // Test bcrypt comparison
    const bcrypt = await import("bcryptjs");
    const isValid = await bcrypt.compare("password123", user.passwordHash);
    console.log("Password valid:", isValid);
  } else if (user) {
    console.log("Password valid: no password hash set");
  }
}

main()
  .catch((err) => console.error("Error:", err))
  .finally(() => db.$disconnect());
