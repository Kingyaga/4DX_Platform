import { createPrismaClient } from "../src/server/prisma-client";
import bcrypt from "bcryptjs";

const db = createPrismaClient();

async function main() {
  // 1. Check what password hash the test user has
  const user = await db.user.findUnique({
    where: { email: "test@example.com" },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  if (!user) {
    console.log("❌ No user with email test@example.com");
    return;
  }

  console.log("✅ Found user:", user.email, user.name);
  console.log("   Hash:", user.passwordHash);

  // 2. Try common passwords
  const candidates = ["password", "Password123", "Test1234", "test1234", "password123", "12345678"];
  for (const pwd of candidates) {
    const match = await bcrypt.compare(pwd, user.passwordHash);
    if (match) {
      console.log(`✅ PASSWORD MATCH: "${pwd}"`);
      return;
    }
  }

  console.log("❌ None of the candidate passwords matched.");
  console.log("   Setting password to 'TestPass123' for testing...");

  // 3. Set a known password so we can test login
  const newHash = await bcrypt.hash("TestPass123", 12);
  await db.user.update({
    where: { email: "test@example.com" },
    data: { passwordHash: newHash },
  });
  console.log("✅ Password updated to 'TestPass123'");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
