/**
 * Comprehensive Error Tracking
 * Integrates with Sentry and provides structured error reporting
 */

import * as Sentry from "@sentry/nextjs";

// Sentry severity levels
type SentrySeverity = "fatal" | "error" | "warning" | "log" | "info" | "debug";

export interface ErrorContext {
  userId?: string;
  venueId?: string;
  organizationId?: string;
  requestId?: string;
  endpoint?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  context?: ErrorContext;
  isOperational?: boolean;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Track error with full context
 */
export function trackError(
  error: Error | AppError,
  context?: ErrorContext,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
): void {
  // Log to structured logger

  // Send to Sentry with context
  const sentryLevel: SentrySeverity =
    severity === ErrorSeverity.CRITICAL
      ? "fatal"
      : severity === ErrorSeverity.HIGH
        ? "error"
        : severity === ErrorSeverity.MEDIUM
          ? "warning"
          : "info";

  Sentry.captureException(error, {
    level: sentryLevel,
    tags: {
      error_code: (error as AppError).code,
      venue_id: context?.venueId,
      user_id: context?.userId,
      endpoint: context?.endpoint,
    },
    extra: context,
  });

  // Alert for critical errors
  if (severity === ErrorSeverity.CRITICAL) {
    alertCriticalError(error, context);
  }
}

/**
 * Track handled errors (expected errors)
 */
export function trackHandledError(message: string, context?: ErrorContext): void {

  Sentry.captureMessage(message, {
    level: "warning",
    tags: {
      type: "handled",
      venue_id: context?.venueId,
    },
    extra: context,
  });
}

/**
 * Create application error with context
 */
export function createAppError(
  message: string,
  code: string,
  statusCode = 500,
  context?: ErrorContext
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.statusCode = statusCode;
  error.context = context;
  error.isOperational = true; // Expected error vs programmer error
  return error;
}

/**
 * Alert for critical errors
 */
async function alertCriticalError(error: Error, _context?: ErrorContext): Promise<void> {
  // In production, this could:
  // - Send PagerDuty alert
  // - Post to Slack
  // - Send SMS to on-call engineer
  // - Trigger incident response

  // Send to Sentry with critical flag
  Sentry.captureException(error, {
    level: "fatal",
    tags: { critical: "true" },
  });
}

/**
 * Performance tracking decorator
 */
export function trackPerformance(threshold = 1000) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const targetName =
      (target &&
        typeof target === "object" &&
        "constructor" in target &&
        target.constructor?.name) ||
      "Unknown";

    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        if (duration > threshold) { /* Condition handled */ }

        return result;
      } catch (_error) {
        const duration = Date.now() - startTime;
        trackError(_error as Error, {
          method: propertyKey,
          duration,
        });
        throw _error;
      }
    };

    return descriptor;
  };
}

/**
 * Track user action
 */
export function trackUserAction(
  action: string,
  _userId: string,
  metadata?: Record<string, unknown>
): void {
  // Send to analytics
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, metadata);
  }
}

/**
 * Track API endpoint performance
 */
export class APIPerformanceTracker {
  private endpoint: string;
  private startTime: number;
  private context: ErrorContext;

  constructor(endpoint: string, context?: ErrorContext) {
    this.endpoint = endpoint;
    this.startTime = Date.now();
    this.context =
      context ||
      {
        /* Empty */
      };
  }

  success(statusCode: number): void {
    const duration = Date.now() - this.startTime;

    // Track in Sentry as breadcrumb
    Sentry.addBreadcrumb({
      category: "api",
      message: `${this.endpoint} - ${statusCode}`,
      level: "info",
      data: {
        duration,
        ...this.context,
      },
    });
  }

  error(error: Error, statusCode: number): void {
    const duration = Date.now() - this.startTime;

    trackError(error, {
      ...this.context,
      endpoint: this.endpoint,
      statusCode,
      duration,
    });
  }
}

/**
 * Error boundary helper for React components
 */
export function reportComponentError(
  error: Error,
  errorInfo: { componentStack: string },
  componentName: string
): void {
  trackError(
    error,
    {
      component: componentName,
      componentStack: errorInfo.componentStack,
    },
    ErrorSeverity.HIGH
  );
}

// Global error handlers
if (typeof window !== "undefined") {
  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    trackError(
      new Error(`Unhandled Promise Rejection: ${event.reason}`),
      { type: "unhandled_rejection" },
      ErrorSeverity.HIGH
    );
  });

  // Catch global errors
  window.addEventListener("error", (event) => {
    trackError(
      event.error || new Error(event.message),
      {
        type: "global_error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      ErrorSeverity.HIGH
    );
  });
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
