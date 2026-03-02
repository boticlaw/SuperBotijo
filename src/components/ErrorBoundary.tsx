"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            minHeight: "200px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <h2 style={{ color: "var(--text-primary)", margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
