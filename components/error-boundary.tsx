"use client";

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log detailed error information for debugging
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      errorInfo: errorInfo
    });

    // Update state with error info for display
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </p>
              
              {/* Always show error details for debugging */}
              {this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-left">
                  <p className="text-sm font-medium text-red-800">Error Details:</p>
                  <p className="text-xs text-red-600 mt-1 font-mono">{this.state.error.message}</p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-600 cursor-pointer">Stack Trace</summary>
                      <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Environment check */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4 text-left">
                <p className="text-sm font-medium text-blue-800">Environment Check:</p>
                <div className="text-xs text-blue-600 mt-1 space-y-1">
                  <div>NODE_ENV: {process.env.NODE_ENV}</div>
                  <div>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</div>
                  <div>SUPABASE_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-servio-purple text-white px-4 py-2 rounded-md hover:bg-servio-purple/90"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 