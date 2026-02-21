"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { clearAuthStorage } from "@/lib/supabase";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleClearAuth = async () => {
    try {
      if (typeof window !== "undefined") {
        clearAuthStorage();
        window.location.reload();
      }
    } catch {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const isAuthError =
        this.state.error?.message?.includes("auth") ||
        this.state.error?.message?.includes("session") ||
        this.state.error?.message?.includes("token");

      const isConfigError =
        this.state.error?.message?.includes("NEXT_PUBLIC_SUPABASE") ||
        this.state.error?.message?.includes("Supabase configuration");

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                {isConfigError ? "Configuration required" : "Something went wrong"}
              </h1>
              <p className="text-gray-900 mb-4">
                {isConfigError ? (
                  <>
                    Supabase environment variables are not set. Add{" "}
                    <code className="text-sm bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                    <code className="text-sm bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                    in Railway Variables, then redeploy.
                  </>
                ) : isAuthError ? (
                  "There was an authentication error. This might be due to a session issue."
                ) : (
                  "An unexpected error occurred. Please try again."
                )}
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mb-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-900 hover:text-gray-700">
                    Error Details (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-32">
                    <div className="mb-2">
                      <strong>Message:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-3">
              {isConfigError && (
                <Button
                  onClick={() => (window.location.href = "/env-check")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Check Environment Variables
                </Button>
              )}
              {isAuthError && (
                <Button
                  onClick={this.handleClearAuth}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  Clear Session & Reload
                </Button>
              )}

              <Button
                onClick={this.handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Try Again
              </Button>

              <Button onClick={this.handleGoHome} variant="outline" className="w-full">
                Go to Home
              </Button>
            </div>

            <div className="mt-6 text-xs text-gray-900">
              <p>If this problem persists, please contact support.</p>
              <p className="mt-1">Error ID: {this.state.error?.name || "unknown"}</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
