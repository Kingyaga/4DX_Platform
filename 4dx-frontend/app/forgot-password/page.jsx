"use client";

import { useState } from "react";
import Link from "next/link";
import { useRequestPasswordReset } from "@/lib/hooks";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { requestPasswordReset, isLoading } = useRequestPasswordReset();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      const result = await requestPasswordReset({ email: normalizedEmail });
      setMessage(result?.message || "If that account exists, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a password reset.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold text-gray-950">Reset password</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter your account email and we will send a secure reset link.
        </p>

        <label className="mt-6 block text-sm font-medium text-gray-800">
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value.toLowerCase())}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-3 text-sm outline-none focus:border-gray-900"
            autoComplete="email"
            aria-invalid={Boolean(error)}
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 flex w-full items-center justify-center rounded-md bg-gray-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isLoading ? <LoadingSpinner size="small" text="" /> : "Send reset link"}
        </button>

        <Link href="/login" className="mt-5 block text-center text-sm font-medium text-gray-700">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
