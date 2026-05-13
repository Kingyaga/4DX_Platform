import { checkBooleanRateLimit } from "@/server/rateLimit";

async function testRateLimit() {
  console.log("Testing rate limit...");
  
  const ip = "127.0.0.1"; // localhost
  const email = "test@example.com";
  
  for (let i = 0; i < 6; i++) {
    const allowed = checkBooleanRateLimit({
      key: `login:${ip}:${email}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    
    console.log(`Attempt ${i + 1}: ${allowed ? "✅ Allowed" : "❌ Blocked"}`);
  }
}

testRateLimit();
