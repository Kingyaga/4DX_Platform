"use client";

import { useState } from "react";
import Link from "next/link";
import { useRequestPasswordReset } from "@/lib/hooks";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const { requestPasswordReset, isLoading } = useRequestPasswordReset();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setResetUrl("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      const result = await requestPasswordReset({ email: normalizedEmail });
      setMessage(result?.message || "If that account exists, a reset link has been sent.");
      setResetUrl(result?.resetUrl || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a password reset.");
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(15, 23, 42, 0.08), transparent 28%), linear-gradient(135deg, #f8fafc 0%, #ffffff 46%, #eef2f7 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full border border-gray-200 bg-white shadow-sm"
        style={{
          maxWidth: "560px",
          borderRadius: "8px",
          padding: "44px",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "8px 12px", border: "1px solid #e4e4e7", borderRadius: "999px", color: "#52525b", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>lock_reset</span>
            4DX Platform
          </div>
          <h1 style={{ margin: "22px 0 0 0", fontSize: "38px", lineHeight: 1.05, fontWeight: 750, letterSpacing: "-0.03em", color: "#111827" }}>
            Reset your password
          </h1>
        </div>
        <p style={{ fontSize: "16px", lineHeight: 1.7, color: "#52525b", margin: 0 }}>
          Enter your account email and we will send a secure reset link.
        </p>

        <label style={{ display: "block", marginTop: "32px", fontSize: "14px", fontWeight: 700, color: "#27272a" }}>
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value.toLowerCase())}
            className="w-full border border-gray-300 outline-none focus:border-gray-900"
            style={{ marginTop: "10px", borderRadius: "8px", padding: "16px 18px", fontSize: "17px", color: "#111827" }}
            autoComplete="email"
            aria-invalid={Boolean(error)}
          />
        </label>

        {error && <p style={{ marginTop: "14px", fontSize: "14px", color: "#b91c1c", fontWeight: 600 }}>{error}</p>}
        {message && (
          <div className="border border-green-200 bg-green-50 text-sm text-green-800" style={{ marginTop: "18px", borderRadius: "8px", padding: "18px" }}>
            <p className="font-semibold">{message}</p>
            {resetUrl && (
              <Link href={resetUrl} className="mt-3 inline-flex font-semibold text-green-900 underline">
                Open local reset link
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center bg-gray-950 font-semibold text-white disabled:opacity-60"
          style={{ marginTop: "28px", borderRadius: "8px", padding: "16px 18px", fontSize: "15px" }}
        >
          {isLoading ? <LoadingSpinner size="small" text="" /> : "Send reset link"}
        </button>

        <Link href="/login" className="block text-center font-semibold text-gray-700" style={{ marginTop: "22px", fontSize: "14px" }}>
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
