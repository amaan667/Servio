/**
 * Centralized error tracking for production
 * Integrates with Sentry or similar error tracking services
 */

interface ErrorContext {
  user_id?: string;
  venue_id?: string;
  route?: string;
  [key: string]: unknown;
}

export function trackError(error: Error, context?: ErrorContext) {
  if (typeof window === 'undefined') return;
  
  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    return;
  }
  
  // In production, send to error tracking service
  // Example: Sentry.captureException(error, { extra: context });
  
  // For now, send to our API
  fetch('/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
    keepalive: true,
  }).catch(() => {
    // Silent fail - don't break the app if error tracking fails
  });
}

export function setupGlobalErrorHandling() {
  if (typeof window === 'undefined') return;
  
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError(
      new Error(`Unhandled promise rejection: ${event.reason}`),
      { type: 'unhandled_rejection' }
    );
  });
  
  // Catch global errors
  window.addEventListener('error', (event) => {
    trackError(
      event.error || new Error(event.message),
      { 
        type: 'global_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    );
  });
}

