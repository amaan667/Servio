/**
 * Sentry Integration for Error Monitoring
 * Provides centralized error tracking and monitoring
 */

import * as Sentry from "@sentry/nextjs";

// Initialize Sentry if DSN is provided
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === "development" && !process.env.SENTRY_ENABLE_DEV) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Capture exception to Sentry
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: {
        custom: context || {},
      },
    });
  }
}

/**
 * Capture message to Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info", context?: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      contexts: {
        custom: context || {},
      },
    });
  }
}

/**
 * Set user context for Sentry
 */
export function setUserContext(userId: string, email?: string, metadata?: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser({
      id: userId,
      email,
      ...metadata,
    });
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, level: Sentry.SeverityLevel = "info", data?: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
    });
  }
}
