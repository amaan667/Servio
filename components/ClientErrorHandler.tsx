'use client';

import { useEffect } from 'react';

/**
 * Client-side error handler component
 * Sets up error handling for client-side errors that aren't caught by React Error Boundaries
 */
export function ClientErrorHandler() {
  useEffect(() => {
    console.log('🚀 Setting up client-side error handlers...');

    // Handle global JavaScript errors
    const handleError = (event: ErrorEvent) => {
      console.error('💥 CLIENT-SIDE ERROR:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    };

    // Handle unhandled promise rejections on client
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('💥 CLIENT-SIDE UNHANDLED PROMISE REJECTION:', {
        reason: event.reason?.toString() || 'Unknown reason',
        stack: event.reason?.stack || 'No stack trace',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      
      // Prevent the default behavior (logging to console)
      event.preventDefault();
    };

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    console.log('✅ Client-side error handlers configured');

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // This component doesn't render anything
  return null;
}