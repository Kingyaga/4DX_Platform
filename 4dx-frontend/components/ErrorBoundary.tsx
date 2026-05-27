"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard render error:", {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "32px", color: "#18181b" }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: 700 }}>
            Something went wrong.
          </h2>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
            Refresh the page or return to the dashboard.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
