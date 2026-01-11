"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clearAuthStorage } from "@/lib/supabase";

interface EnhancedErrorBoundaryState {

}

interface EnhancedErrorBoundaryProps {

  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
}

export class EnhancedErrorBoundary extends React.Component<
  EnhancedErrorBoundaryProps,
  EnhancedErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = {

    };
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    return {

      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console with more context
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;

    if (this.state.retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // Clear the error state after a short delay
    this.retryTimeoutId = setTimeout(() => {
      this.setState({

    }, 1000);
  };

  handleClearAuth = async () => {
    try {
      await clearAuthStorage();
      window.location.reload();
    } catch (_err) {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  isAuthError = (): boolean => {
    const { error } = this.state;
    if (!error) return false;

    const authErrorKeywords = [
      "auth",
      "session",
      "token",
      "unauthorized",
      "forbidden",
      "invalid_grant",
      "refresh_token",
      "authentication",
    ];

    return authErrorKeywords.some(
      (keyword) =>
        error.message.toLowerCase().includes(keyword) ||
        error.stack?.toLowerCase().includes(keyword)
    );
  };

  isNetworkError = (): boolean => {
    const { error } = this.state;
    if (!error) return false;

    const networkErrorKeywords = [
      "network",
      "fetch",
      "timeout",
      "connection",
      "offline",
      "failed to fetch",
      "net::",
      "socket",
    ];

    return networkErrorKeywords.some(
      (keyword) =>
        error.message.toLowerCase().includes(keyword) ||
        error.stack?.toLowerCase().includes(keyword)
    );
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;
      const { error, isRetrying, retryCount } = this.state;

      // Use custom fallback if provided
      if (Fallback) {
        return <Fallback error={error!} retry={this.handleRetry} />;
      }

      const isAuthError = this.isAuthError();
      const isNetworkError = this.isNetworkError();

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                {isNetworkError ? (
                  <WifiOff className="w-8 h-8 text-red-600" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                )}
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                {isAuthError
                  ? "Authentication Error"

                    : "Something went wrong"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-gray-900 mb-4">
                  {isAuthError
                    ? "Your session has expired or there was an authentication error."

                      : "An unexpected error occurred. We're working to fix it."}
                </p>

                {retryCount > 0 && (
                  <p className="text-sm text-gray-900 mb-4">Retry attempt: {retryCount}</p>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  onClick={this.handleRetry}
                  disabled={isRetrying || retryCount >= (this.props.maxRetries || 3)}
                  className="w-full"
                  variant="default"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>

                {isAuthError && (
                  <Button onClick={this.handleClearAuth} variant="outline" className="w-full">
                    Clear Session & Reload
                  </Button>
                )}

                <Button onClick={this.handleGoHome} variant="ghost" className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Home
                </Button>
              </div>

              {process.env.NODE_ENV === "development" && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-900 cursor-pointer">
                    Error Details (Development)
                  </summary>
                  <pre className="text-xs text-gray-900 mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-32">
                    {error?.message}
                    {"\n\n"}
                    {error?.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for using error boundary functionality
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
}
