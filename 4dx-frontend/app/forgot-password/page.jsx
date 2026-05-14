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
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "linear-gradient(135deg, #f7f9fd 0%, #ffffff 48%, #eef2f7 100%)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-gray-200 bg-white p-8 shadow-sm"
        style={{ borderRadius: "8px" }}
      >
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">4DX Platform</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-950">Reset password</h1>
        </div>
        <p className="text-sm leading-6 text-gray-600">
          Enter your account email and we will send a secure reset link.
        </p>

        <label className="mt-6 block text-sm font-semibold text-gray-800">
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value.toLowerCase())}
            className="mt-2 w-full border border-gray-300 px-3 py-3 text-sm outline-none focus:border-gray-900"
            style={{ borderRadius: "6px" }}
            autoComplete="email"
            aria-invalid={Boolean(error)}
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && (
          <div className="mt-4 border border-green-200 bg-green-50 p-4 text-sm text-green-800" style={{ borderRadius: "6px" }}>
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
          className="mt-6 flex w-full items-center justify-center bg-gray-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ borderRadius: "6px" }}
        >
          {isLoading ? <LoadingSpinner size="small" text="" /> : "Send reset link"}
        </button>

        <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-gray-700">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
