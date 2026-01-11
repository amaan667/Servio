/**
 * Sentry Integration for Error Monitoring
 * Provides centralized error tracking and monitoring
 */

import * as Sentry from "@sentry/nextjs";

// Initialize Sentry if DSN is provided
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({

    beforeSend(event) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === "development" && !process.env.SENTRY_ENABLE_DEV) {
        return null;
      }
      return event;
    },

}

/**
 * Capture exception to Sentry
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {

        custom: context || {},
      },

  }
}

/**
 * Capture message to Sentry
 */
export function captureMessage(

  context?: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,

        custom: context || {},
      },

  }
}

/**
 * Set user context for Sentry
 */
export function setUserContext(

  email?: string,
  metadata?: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser({

      email,
      ...metadata,

  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(

  data?: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,

  }
}
