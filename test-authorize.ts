import { createPrismaClient } from "@/server/prisma-client";
import bcrypt from "bcryptjs";

const db = createPrismaClient();

async function testAuthorize() {
  console.log("Testing authorize logic...");
  
  const credentials = {
    email: "test@example.com",
    password: "password123",
  };

  const normalizedEmail = credentials.email.toLowerCase().trim();
  console.log("Normalized email:", normalizedEmail);

  try {
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    console.log("User found:", user ? "YES" : "NO");
    if (user) {
      console.log("User ID:", user.id);
      console.log("User email:", user.email);
      console.log("Password hash exists:", !!user.passwordHash);
      
      const passwordMatch = await bcrypt.compare(
        credentials.password,
        user.passwordHash,
      );
      console.log("Password match:", passwordMatch);

      if (passwordMatch) {
        console.log("✅ Authorization should succeed!");
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      } else {
        console.log("❌ Password mismatch!");
      }
    } else {
      console.log("❌ User not found!");
    }
  } catch (error) {
    console.error("❌ Auth error:", error);
  } finally {
    await db.$disconnect();
  }
}

testAuthorize();
