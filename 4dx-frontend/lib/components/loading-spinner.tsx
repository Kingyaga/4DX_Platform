"use client";

import React from "react";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large" | "xlarge";
  text?: string;
  className?: string;
}

export function LoadingSpinner({
  size = "medium",
  text = "Loading...",
  className = ""
}: LoadingSpinnerProps) {
  const dimensions = {
    small: { shell: 28, text: 9 },
    medium: { shell: 54, text: 11 },
    large: { shell: 78, text: 13 },
    xlarge: { shell: 112, text: 18 },
  };
  const currentSize = dimensions[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="fourdx-loader" role="status" aria-label="Loading" style={{ width: currentSize.shell, height: currentSize.shell }}>
        <div className="fourdx-loader__ring" />
        <div className="fourdx-loader__core">
          <span style={{ fontSize: currentSize.text }}>4DX</span>
        </div>
      </div>
      {text && (
        <p className="text-sm text-gray-600 font-medium">{text}</p>
      )}
      <style jsx>{`
        .fourdx-loader {
          position: relative;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background:
            radial-gradient(circle at 35% 28%, rgba(17, 24, 39, 0.16), transparent 34%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(241, 245, 249, 0.82));
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95);
          animation: fourdx-breathe 1.25s ease-in-out infinite;
          overflow: hidden;
        }

        .fourdx-loader__ring {
          position: absolute;
          inset: 8%;
          border-radius: inherit;
          border: 2px solid rgba(15, 23, 42, 0.08);
          border-top-color: rgba(17, 24, 39, 0.92);
          border-right-color: rgba(17, 24, 39, 0.58);
          animation: fourdx-spin 0.95s linear infinite;
        }

        .fourdx-loader__core {
          position: relative;
          z-index: 2;
          display: grid;
          place-items: center;
          width: 58%;
          height: 58%;
          border-radius: inherit;
          background: #111827;
          color: #ffffff;
          font-weight: 800;
          letter-spacing: 0;
          box-shadow: 0 10px 24px rgba(17, 24, 39, 0.26);
        }

        @keyframes fourdx-breathe {
          0%, 100% {
            transform: scale(0.92);
            opacity: 0.9;
          }
          45% {
            transform: scale(1.08);
            opacity: 1;
          }
        }

        @keyframes fourdx-spin {
          to {
            transform: rotate(360deg);
          }
        }

      `}</style>
    </div>
  );
}

export function LoadingPage({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <LoadingSpinner size="xlarge" text={text} className="min-h-screen w-full" />
    </div>
  );
}

export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <main style={{ flex: 1, minHeight: "calc(100vh - 48px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}>
      <LoadingSpinner size="xlarge" text={text} />
    </main>
  );
}

export function LoadingOverlay({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <LoadingSpinner size="large" text={text} className="bg-white p-6 rounded-lg shadow-lg" />
    </div>
  );
}
