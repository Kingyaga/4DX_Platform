"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSignIn = async () => {
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!result) {
        setError("Login failed. Please try again.");
        return;
      }

      if (!result.ok || result.error) {
        const backendError = result.error?.includes("Unable to reach auth backend")
          ? "Unable to reach the authentication service. Please try again later."
          : result.error?.includes("CredentialsSignin")
          ? "Unable to sign in. Please verify your email and password and try again."
          : "Unable to sign in. Please verify your credentials and try again.";

        setError(backendError);
        return;
      }

      router.push(result.url || "/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed. Please try again. If the backend server is not running, start it and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setError("");
    await signIn("azure-ad", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="container">
      <div className="left-panel">
        <div className="brand">4DX</div>
        <p className="tagline">Execution made simple.<br />Results that matter.</p>
        <div className="wave-wrapper">
          <svg viewBox="0 0 700 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" height="220">
            <path
              d="M0,160 C80,120 160,200 280,155 C400,110 480,185 600,150 C650,135 680,128 700,125 L700,220 L0,220 Z"
              fill="rgba(255,255,255,0.07)"
            />
            <path
              d="M0,185 C60,165 140,210 260,185 C380,160 460,200 580,175 C630,163 670,158 700,155 L700,220 L0,220 Z"
              fill="rgba(255,255,255,0.10)"
            />
          </svg>
        </div>
      </div>

      <div className="right-panel">
        <div className="form-card">
          <h1>Welcome Back</h1>
          <p className="subtitle">Sign in to your account</p>

          {error && (
            <p style={{ color: "red", textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
              {error}
            </p>
          )}

          <div className="fields">
            <div className="input-wrapper">
              <input
                name="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.toLowerCase());
                  if (error === "Enter a valid email address.") setError("");
                }}
                onBlur={() => {
                  if (email && !emailPattern.test(email.trim().toLowerCase())) {
                    setError("Enter a valid email address.");
                  }
                }}
                aria-invalid={Boolean(email && !emailPattern.test(email.trim().toLowerCase()))}
              />
            </div>

            <div className="input-wrapper">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="eye-toggle"
                onClick={togglePassword}
                aria-label="Toggle password visibility"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="forgot">
            <a href="/forgot-password">Forgot password?</a>
          </div>

          <button
            className="btn-signin"
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <LoadingSpinner size="small" text="" />
                <span>Signing in...</span>
              </div>
            ) : (
              "Sign In"
            )}
          </button>

          <button
            className="btn-signin"
            type="button"
            onClick={handleMicrosoftSignIn}
            style={{ marginTop: "12px", backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d4d4d8" }}
          >
            Sign in with Outlook
          </button>

          <p className="signup-prompt">
            Access to this platform is invite only. Ask your administrator to create your account or send an invite.
          </p>
        </div>
      </div>
    </div>
  );
}
