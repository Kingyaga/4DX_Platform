"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

async function fetchCsrfToken() {
  const response = await fetch("/api/auth/csrf", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Unable to reach authentication service (${response.status}).`);
  }

  const data = await response.json();
  if (!data?.csrfToken) {
    throw new Error("Unable to start the login session.");
  }

  return data.csrfToken;
}

async function fetchCurrentSession() {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Unable to verify session (${response.status}).`);
  }

  return response.json();
}

function getLoginFailureMessage(result, status) {
  if (status === 401 || result?.url?.includes("error=CredentialsSignin")) {
    return "The email or password you entered is incorrect.";
  }

  if (status === 429) {
    return "Too many login attempts. Wait a few minutes and try again.";
  }

  if (result?.url?.includes("csrf=true")) {
    return "Your login session expired. Refresh the page and try again.";
  }

  return "We could not sign you in right now. Please try again.";
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [outlookEnabled, setOutlookEnabled] = useState(false);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      try {
        const response = await fetch("/api/auth/providers", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const providers = response.ok ? await response.json() : {};
        if (!cancelled) {
          setOutlookEnabled(Boolean(providers?.["azure-ad"]));
        }
      } catch {
        if (!cancelled) setOutlookEnabled(false);
      } finally {
        if (!cancelled) setProvidersLoaded(true);
      }
    }

    loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

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
      const csrfToken = await fetchCsrfToken();
      const response = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          csrfToken,
          email: normalizedEmail,
          password,
          redirect: "false",
          json: "true",
        }),
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.url?.includes("error=")) {
        setError(getLoginFailureMessage(result, response.status));
        return;
      }

      const session = await fetchCurrentSession();
      if (!session?.user?.id) {
        setError("Your details were accepted, but the secure session could not be loaded. Please try again.");
        return;
      }

      window.location.assign("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setError("");
    if (!outlookEnabled) {
      setError("Outlook sign-in is not configured. Add Microsoft OAuth credentials to enable it.");
      return;
    }

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
            <p
              role="alert"
              style={{
                color: "#991b1b",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                textAlign: "left",
                marginTop: "16px",
                padding: "12px 14px",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
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
                  if (error) setError("");
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
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
            disabled={!providersLoaded || !outlookEnabled}
            style={{
              marginTop: "12px",
              backgroundColor: "#ffffff",
              color: !providersLoaded || !outlookEnabled ? "#71717a" : "#111827",
              border: "1px solid #d4d4d8",
              cursor: !providersLoaded || !outlookEnabled ? "not-allowed" : "pointer",
              opacity: !providersLoaded || !outlookEnabled ? 0.75 : 1,
            }}
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
