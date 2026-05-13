"use client";

import { useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useResetPassword } from "@/lib/hooks";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const { resetPassword, isLoading } = useResetPassword();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await resetPassword({ token, password });
      setDone(true);
      window.setTimeout(() => router.push("/login"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold text-gray-950">Choose a new password</h1>
        <p className="mt-2 text-sm text-gray-600">Use at least 8 characters.</p>

        <label className="mt-6 block text-sm font-medium text-gray-800">
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-3 text-sm outline-none focus:border-gray-900"
            autoComplete="new-password"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-gray-800">
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-3 text-sm outline-none focus:border-gray-900"
            autoComplete="new-password"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {done && <p className="mt-3 text-sm text-green-700">Password updated. Sending you back to sign in.</p>}

        <button
          type="submit"
          disabled={isLoading || done}
          className="mt-6 flex w-full items-center justify-center rounded-md bg-gray-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isLoading ? <LoadingSpinner size="small" text="" /> : "Update password"}
        </button>

        <Link href="/login" className="mt-5 block text-center text-sm font-medium text-gray-700">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
          <LoadingSpinner size="large" text="" />
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
