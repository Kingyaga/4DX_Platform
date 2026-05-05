"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSignIn = async () => {
  setError("");
  setLoading(true);

  const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
    callbackUrl: "http://localhost:3001/dashboard",
  });

  setLoading(false);

  if (result?.error) {
    setError("Invalid email or password. Please try again.");
  } else {
    router.push("/dashboard");
  }
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
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-wrapper">
              <input
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
            <a href="#">Forgot password?</a>
          </div>

          <button
            className="btn-signin"
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="signup-prompt">
            Don't have an account? <a href="#">Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}