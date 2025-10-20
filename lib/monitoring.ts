/**
 * Monitoring and error tracking
 * Provides production visibility and error tracking
 */

import * as Sentry from '@sentry/nextjs';

// Initialize Sentry
export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: process.env.NODE_ENV === 'development',
      beforeSend(event) {
        // Filter out non-critical errors in production
        if (process.env.NODE_ENV === 'production') {
          if (event.exception) {
            const error = event.exception.values?.[0];
            if (error?.value?.includes('ResizeObserver loop limit exceeded')) {
              return null; // Ignore ResizeObserver errors
            }
          }
        }
        return event;
      },
    });
  }
}

// Error tracking helpers
export const errorTracking = {
  /**
   * Capture exception
   */
  captureException(error: Error, context?: Record<string, unknown>) {
    Sentry.captureException(error, {
      extra: context,
    });
  },

  /**
   * Capture message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'error', context?: Record<string, unknown>) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  },

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }) {
    Sentry.setUser(user);
  },

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }) {
    Sentry.addBreadcrumb(breadcrumb);
  },

  /**
   * Start transaction (deprecated in Sentry v8+)
   */
  startTransaction(name: string, op: string) {
    // Transactions are deprecated, use spans instead
    return null;
  },
};

// Performance monitoring
export const performanceMonitoring = {
  /**
   * Track API call performance
   */
  trackApiCall(endpoint: string, method: string, duration: number, status: number) {
    // Log slow requests
    if (duration > 1000) {
      errorTracking.captureMessage('Slow API request', 'warning', {
        endpoint,
        method,
        duration,
        status,
      });
    }
  },

  /**
   * Track database query performance
   */
  trackDbQuery(query: string, duration: number, rows?: number) {
    // Log slow queries
    if (duration > 500) {
      errorTracking.captureMessage('Slow database query', 'warning', {
        query: query.substring(0, 100),
        duration,
        rows,
      });
    }
  },

  /**
   * Track page load performance
   */
  trackPageLoad(page: string, duration: number) {
    // Log slow page loads
    if (duration > 2000) {
      errorTracking.captureMessage('Slow page load', 'warning', {
        page,
        duration,
      });
    }
  },
};

