"use client";

import React from 'react';
import { clearInvalidSession } from '@/lib/supabaseClient';

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
    console.log('[ERROR_BOUNDARY] getDerivedStateFromError called with:', error.message);
    
    // Check if this is an authentication error
    const isAuthError = error.message?.includes('refresh_token_not_found') || 
                       error.message?.includes('Invalid Refresh Token') ||
                       error.message?.includes('auth');
    
    if (isAuthError) {
      // Clear invalid session for auth errors
      clearInvalidSession();
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ERROR_BOUNDARY] ErrorBoundary caught an error:', error, errorInfo);
    
    // Log detailed error information for debugging
    console.error('[ERROR_BOUNDARY] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      errorInfo: errorInfo
    });

    // Check if this is an authentication error
    const isAuthError = error.message?.includes('refresh_token_not_found') || 
                       error.message?.includes('Invalid Refresh Token') ||
                       error.message?.includes('auth');
    
    if (isAuthError) {
      console.warn('[ERROR_BOUNDARY] Authentication error detected, clearing session');
      clearInvalidSession();
      this.setState({ hasError: true, error });
      return;
    }

    // Check if this is a temporary error that might resolve itself
    const isTemporaryError = error.message.includes('Supabase') || 
                            error.message.includes('environment variables') ||
                            error.message.includes('network') ||
                            error.message.includes('fetch');

    if (isTemporaryError) {
      console.log('[ERROR_BOUNDARY] Detected temporary error, not showing error state immediately');
      // Don't set hasError for temporary errors, let them resolve
      return;
    }

    // For Supabase configuration errors, we want to show the error state
    // so the user can see the configuration screen
    if (error.message.includes('Supabase') || error.message.includes('environment variables')) {
      console.log('[ERROR_BOUNDARY] Setting error state for Supabase configuration issue');
      this.setState({ hasError: true, error });
      return;
    }
  }

  render() {
    if (this.state.hasError) {
      console.log('[ERROR_BOUNDARY] Rendering error state');
      
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Check if this is an authentication error
      const isAuthError = this.state.error?.message?.includes('refresh_token_not_found') || 
                         this.state.error?.message?.includes('Invalid Refresh Token') ||
                         this.state.error?.message?.includes('auth');

      // Check if this is a Supabase configuration error
      const isSupabaseError = this.state.error?.message?.includes('Supabase') || 
                             this.state.error?.message?.includes('environment variables');

      if (isAuthError) {
        // Custom fallback for auth errors
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
                <p className="text-gray-600 mb-4">Your session has expired. Please sign in again.</p>
                <button
                  onClick={() => {
                    this.setState({ hasError: false });
                    window.location.href = '/sign-in';
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                >
                  Sign In Again
                </button>
              </div>
            </div>
          </div>
        );
      }

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