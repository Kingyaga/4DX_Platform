// Test login by calling the NextAuth credentials endpoint directly

async function testLogin() {
  const baseUrl = "http://localhost:3000";

  // Step 1: Get the CSRF token
  console.log("1️⃣  Fetching CSRF token...");
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  console.log("   CSRF token:", csrfData.csrfToken ? "✅ received" : "❌ missing");

  if (!csrfData.csrfToken) {
    console.error("   Response:", csrfData);
    return;
  }

  // Step 2: Attempt login
  console.log("\n2️⃣  Attempting login with test@example.com / password123...");
  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrfData.csrfToken,
      email: "test@example.com",
      password: "password123",
      json: "true",
    }),
    redirect: "manual",
  });

  console.log("   Status:", loginRes.status);
  console.log("   Location:", loginRes.headers.get("location") || "(none)");
  
  const setCookies = loginRes.headers.getSetCookie?.() || [];
  const hasSessionCookie = setCookies.some((c: string) =>
    c.includes("next-auth.session-token")
  );
  console.log("   Session cookie set:", hasSessionCookie ? "✅ YES" : "❌ NO");

  if (hasSessionCookie) {
    // Step 3: Verify the session
    const sessionCookie = setCookies
      .find((c: string) => c.includes("next-auth.session-token"))!
      .split(";")[0];

    console.log("\n3️⃣  Verifying session...");
    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: sessionCookie },
    });
    const sessionData = await sessionRes.json();
    console.log("   Session data:", JSON.stringify(sessionData, null, 2));

    if (sessionData?.user?.email) {
      console.log("\n✅ LOGIN TEST PASSED — authenticated as", sessionData.user.email);
    } else {
      console.log("\n❌ LOGIN TEST FAILED — session has no user data");
    }
  } else {
    console.log("\n❌ LOGIN TEST FAILED — no session cookie received");
    try {
      const body = await loginRes.text();
      console.log("   Response body:", body.substring(0, 500));
    } catch {}
  }
}

testLogin().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
