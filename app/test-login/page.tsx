"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function TestLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function handleLogin() {
    setStatus("Logging in...");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      setStatus(
        "✅ Logged in successfully. You can now test protected endpoints.",
      );
    } else {
      setStatus("❌ Login failed. Check email and password.");
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h2>Test Login</h2>
      <input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 8, padding: 8, width: 300 }}
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 8, padding: 8, width: 300 }}
      />
      <button onClick={handleLogin} style={{ padding: "8px 16px" }}>
        Login
      </button>
      <p>{status}</p>
    </div>
  );
}
