(async () => {
  const base = "http://localhost:3000";
  try {
    const csrfR = await fetch(`${base}/api/auth/csrf`, {
      credentials: "include",
    });
    const csrf = await csrfR.json();
    console.log("CSRF", csrf.csrfToken);

    const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email: "admin@test.local",
        password: "password123",
        redirect: "false",
        json: "true",
      }),
      credentials: "include",
    });

    console.log("LOGIN", loginRes.status);
    const loginJson = await loginRes.json().catch(() => null);
    console.log("LOGIN_BODY", JSON.stringify(loginJson));

    const sessionRes = await fetch(`${base}/api/auth/session`, {
      credentials: "include",
    });
    console.log("SESSION", sessionRes.status);
    console.log(await sessionRes.text());

    const trpcUrl = `${base}/api/trpc/wigs.getByTeam?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: { teamSlug: "labs-team" } } }))}`;
    const trpcRes = await fetch(trpcUrl, { credentials: "include" });
    console.log("TRPC", trpcRes.status);
    console.log(await trpcRes.text());
  } catch (e) {
    console.error("ERR", e);
    process.exit(1);
  }
})();
