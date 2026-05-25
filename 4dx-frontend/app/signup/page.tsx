"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  const inviteQuery = trpc.invites.validate.useQuery(
    { token: token ?? "" },
    {
      enabled: !!token,
      retry: false,
      staleTime: 0,
    },
  );

  useEffect(() => {
    if (inviteQuery.data?.email) {
      setEmail(inviteQuery.data.email);
    }
  }, [inviteQuery.data?.email]);

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: () => {
      router.push("/login?registered=true");
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Unable to create account. Please try again.");
      setLoading(false);
    },
  });

  if (!token) {
    return (
      <div className="container">
        <div className="left-panel">
          <div className="brand">4DX</div>
          <p className="tagline">
            Execution made simple.
            <br />
            Results that matter.
          </p>
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
            <h1>Sign up is invite only</h1>
            <p className="subtitle">Ask your admin for an invite link to create an account.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSignup = async () => {
    setError("");

    if (!token) {
      setError("Signup is invite-only. Use the invite link from your admin.");
      return;
    }

    if (!name || !email || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (inviteQuery.isLoading) {
      setError("Validating your invite. Please wait.");
      return;
    }

    if (inviteQuery.error) {
      setError("Invite token is invalid or expired.");
      return;
    }

    setLoading(true);
    signupMutation.mutate({ name, email: email.toLowerCase(), password, token });
  };

  return (
    <div className="container">
      {/* Left Panel */}
      <div className="left-panel">
        <div className="brand">4DX</div>
        <p className="tagline">
          Execution made simple.
          <br />
          Results that matter.
        </p>
        <div className="wave-wrapper">
          <svg
            viewBox="0 0 700 220"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            height="220"
          >
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

      {/* Right Panel */}
      <div className="right-panel">
        <div className="form-card">
          <h1>Create Account</h1>
          <p className="subtitle">Sign up to get started with 4DX</p>

          {error && (
            <p
              style={{
                color: "#ba1a1a",
                textAlign: "center",
                marginTop: "12px",
                fontSize: "14px",
                padding: "10px",
                backgroundColor: "#ffdad6",
                border: "1px solid #ffdad6",
              }}
            >
              {error}
            </p>
          )}

          <div className="fields">
            {/* Full Name */}
            <div className="input-wrapper">
              <input
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="input-wrapper">
              <input
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
              />
            </div>

            {/* Password */}
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="eye-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
                type="button"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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

            {/* Confirm Password */}
            <div className="input-wrapper">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm your password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                className="eye-toggle"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label="Toggle confirm password visibility"
                type="button"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {showConfirm ? (
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

          <button
            className="btn-signin"
            type="button"
            onClick={handleSignup}
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, marginTop: "28px" }}
          >
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <LoadingSpinner size="small" />
                Creating Account...
              </div>
            ) : (
              "Create Account"
            )}
          </button>

          <p className="signup-prompt">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
