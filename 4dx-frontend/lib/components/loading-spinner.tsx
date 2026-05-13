"use client";

import React from "react";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  text?: string;
  className?: string;
}

export function LoadingSpinner({
  size = "medium",
  text = "Loading...",
  className = ""
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: "w-4 h-4",
    medium: "w-8 h-8",
    large: "w-12 h-12"
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <p className="text-sm text-gray-600 font-medium">{text}</p>
      )}
    </div>
  );
}

export function LoadingPage({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="large" text={text} />
    </div>
  );
}

export function LoadingOverlay({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <LoadingSpinner size="large" text={text} className="bg-white p-6 rounded-lg shadow-lg" />
    </div>
  );
}