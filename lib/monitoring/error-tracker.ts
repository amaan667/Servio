/**
 * Enhanced Error Tracking
 * Centralized error tracking and reporting
 */

import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  userId?: string;
  venueId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

/**
 * Track error with context
 */
export function trackError(
  error: Error | unknown,
  context?: ErrorContext
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log to console
  logger.error('Error tracked:', {
    message: errorMessage,
    stack: errorStack,
    context,
  });

  // Send to Sentry
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        component: context?.action || 'unknown',
        venueId: context?.venueId,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.metadata,
    });
  }
}

/**
 * Track API errors
 */
export function trackAPIError(
  endpoint: string,
  error: Error | unknown,
  request?: Request
) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`[API ERROR] ${endpoint}:`, {
    message: errorMessage,
    url: request?.url,
    method: request?.method,
  });

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        type: 'api_error',
        endpoint,
      },
      extra: {
        url: request?.url,
        method: request?.method,
      },
    });
  }
}

/**
 * Track component errors
 */
export function trackComponentError(
  componentName: string,
  error: Error | unknown,
  props?: Record<string, any>
) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`[COMPONENT ERROR] ${componentName}:`, {
    message: errorMessage,
    props,
  });

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        type: 'component_error',
        component: componentName,
      },
      extra: {
        props,
      },
    });
  }
}

/**
 * Track database errors
 */
export function trackDatabaseError(
  operation: string,
  error: Error | unknown,
  table?: string
) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`[DATABASE ERROR] ${operation}:`, {
    message: errorMessage,
    table,
  });

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        type: 'database_error',
        operation,
        table,
      },
    });
  }
}

/**
 * Track authentication errors
 */
export function trackAuthError(
  action: string,
  error: Error | unknown,
  userId?: string
) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`[AUTH ERROR] ${action}:`, {
    message: errorMessage,
    userId,
  });

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        type: 'auth_error',
        action,
      },
      user: userId ? { id: userId } : undefined,
    });
  }
}

/**
 * Track payment errors
 */
export function trackPaymentError(
  action: string,
  error: Error | unknown,
  orderId?: string,
  amount?: number
) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`[PAYMENT ERROR] ${action}:`, {
    message: errorMessage,
    orderId,
    amount,
  });

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        type: 'payment_error',
        action,
      },
      extra: {
        orderId,
        amount,
      },
    });
  }
}

/**
 * Set user context for error tracking
 */
export function setErrorContext(context: ErrorContext) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setUser(context.userId ? { id: context.userId } : null);
    Sentry.setContext('application', {
      venueId: context.venueId,
      action: context.action,
      metadata: context.metadata,
    });
  }
}

/**
 * Clear error context
 */
export function clearErrorContext() {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setUser(null);
  }
}

/**
 * Track performance issues
 */
export function trackPerformanceIssue(
  metric: string,
  value: number,
  threshold: number
) {
  logger.warn(`[PERFORMANCE ISSUE] ${metric}:`, {
    value,
    threshold,
    delta: value - threshold,
  });

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureMessage(`Performance issue: ${metric}`, {
      level: 'warning',
      tags: {
        type: 'performance_issue',
        metric,
      },
      extra: {
        value,
        threshold,
      },
    });
  }
}

/**
 * Track security events
 */
export function trackSecurityEvent(
  event: string,
  details: Record<string, any>
) {
  logger.warn(`[SECURITY EVENT] ${event}:`, details);

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureMessage(`Security event: ${event}`, {
      level: 'warning',
      tags: {
        type: 'security_event',
        event,
      },
      extra: details,
    });
  }
}

