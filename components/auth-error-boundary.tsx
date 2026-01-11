"use client";

import React from "react";

interface AuthErrorBoundaryState {

}

interface AuthErrorBoundaryProps {

  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,

    // Log to external service if needed
    // logErrorToService(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h1>

              <p className="text-gray-900 mb-6">
                Something went wrong with the authentication process.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <h2 className="text-sm font-medium text-red-800 mb-2">Error Details:</h2>
                <p className="text-sm text-red-700 mb-2">
                  {this.state.error?.message || "An unknown error occurred"}
                </p>
                {this.state.error?.name && (
                  <p className="text-xs text-red-600">Error Type: {this.state.error.name}</p>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={this.resetError}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>

                <button
                  onClick={() => (window.location.href = "/sign-in")}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Go to Sign In
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition-colors"
                >
                  Reload Page
                </button>
              </div>

              <div className="mt-6 text-xs text-gray-900">
                <p>If this error persists, please:</p>
                <ul className="mt-2 space-y-1 text-left">
                  <li>• Clear your browser cache and cookies</li>
                  <li>• Try using a different browser</li>
                  <li>• Check your internet connection</li>
                  <li>• Contact support if the issue continues</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to use error boundary
export const useAuthErrorHandler = () => {
  const handleAuthError = (error: Error) => {
    // You can add custom error handling logic here
    // For example, redirect to sign-in page for specific errors
    if (error.message?.includes("auth") || error.message?.includes("session")) {
      window.location.href = "/sign-in?error=auth_error";
    }
  };

  return { handleAuthError };
};
