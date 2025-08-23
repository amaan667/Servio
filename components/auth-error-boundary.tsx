'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { clearInvalidSession } from '@/lib/supabaseClient';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AUTH_ERROR_BOUNDARY] Caught error:', error);
    console.error('[AUTH_ERROR_BOUNDARY] Error info:', errorInfo);
    
    // Check if this is an authentication error
    const isAuthError = error.message?.includes('refresh_token_not_found') || 
                       error.message?.includes('Invalid Refresh Token') ||
                       error.message?.includes('auth');
    
    if (isAuthError) {
      console.warn('[AUTH_ERROR_BOUNDARY] Authentication error detected, clearing session');
      clearInvalidSession();
    }
  }

  render() {
    if (this.state.hasError) {
      // Check if this is an authentication error
      const isAuthError = this.state.error?.message?.includes('refresh_token_not_found') || 
                         this.state.error?.message?.includes('Invalid Refresh Token') ||
                         this.state.error?.message?.includes('auth');
      
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
      
      // Default fallback for other errors
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
              <p className="text-gray-600 mb-4">An unexpected error occurred. Please try refreshing the page.</p>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
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