"use client";

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
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
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Check if this is a Supabase configuration error
      const isSupabaseError = this.state.error?.message?.includes('Supabase') || 
                             this.state.error?.message?.includes('environment variables');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {isSupabaseError ? 'Configuration Required' : 'Something went wrong'}
              </h2>
              <p className="text-gray-600 mb-6">
                {isSupabaseError 
                  ? 'This application requires Supabase configuration. Please set up your environment variables and try again.'
                  : 'We\'re sorry, but something unexpected happened. Please try refreshing the page.'
                }
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-left">
                  <p className="text-sm font-medium text-red-800">Error Details:</p>
                  <p className="text-xs text-red-600 mt-1">{this.state.error.message}</p>
                  {isSupabaseError && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs text-blue-800">
                        <strong>Setup Instructions:</strong><br/>
                        1. Create a .env.local file in the project root<br/>
                        2. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY<br/>
                        3. Restart the development server
                      </p>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => window.location.reload()}
                className="bg-servio-purple text-white px-4 py-2 rounded-md hover:bg-servio-purple/90"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 