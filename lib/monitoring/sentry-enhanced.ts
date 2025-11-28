/**
 * @fileoverview Enhanced Sentry monitoring with custom context
 * @module lib/monitoring/sentry-enhanced
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Enhanced error tracking with custom context
 */
export class EnhancedErrorTracker {
  /**
   * Capture exception with rich context
   */
  static captureException(
    error: Error,
    context?: {
      user?: { id: string; email?: string; username?: string };
      venue?: { id: string; name?: string };
      order?: { id: string; amount?: number };
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
      level?: Sentry.SeverityLevel;
    }
  ) {
    Sentry.withScope((scope) => {
      // Set user context
      if (context?.user) {
        scope.setUser(context.user);
      }

      // Set venue context
      if (context?.venue) {
        scope.setContext("venue", context.venue);
      }

      // Set order context
      if (context?.order) {
        scope.setContext("order", context.order);
      }

      // Set custom tags
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      // Set extra data
      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Set severity level
      if (context?.level) {
        scope.setLevel(context.level);
      }

      Sentry.captureException(error);
    });
  }

  /**
   * Capture message with context
   */
  static captureMessage(
    message: string,
    level: Sentry.SeverityLevel = "info",
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
    }
  ) {
    Sentry.withScope((scope) => {
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  }

  /**
   * Start a transaction for performance monitoring
   */
  static startTransaction(name: string, operation: string, data?: Record<string, unknown>) {
    // Note: Using type assertion for Sentry v7 API compatibility
    interface SentryTransaction {
      setStatus(status: string): void;
      finish(): void;
      startChild(context: { op: string; description: string }): SentrySpan | undefined;
    }
    interface SentrySpan {
      setStatus(status: string): void;
      finish(): void;
    }
    interface SentryWithTransaction {
      startTransaction(context: { name: string; op: string; data?: Record<string, unknown> }): SentryTransaction;
    }
    return (Sentry as unknown as SentryWithTransaction).startTransaction({
      name,
      op: operation,
      data,
    });
  }

  /**
   * Track API request performance
   */
  static async trackAPIRequest<T>(
    route: string,
    method: string,
    handler: () => Promise<T>
  ): Promise<T> {
    const transaction = this.startTransaction(`${method} ${route}`, "http.server");

    try {
      const result = await handler();
      transaction.setStatus("ok");
      return result;
    } catch (_error) {
      transaction.setStatus("internal_error");
      this.captureException(_error as Error, {
        tags: {
          route,
          method,
        },
        level: "error",
      });
      throw _error;
    } finally {
      transaction.finish();
    }
  }

  /**
   * Track database query performance
   */
  static async trackDatabaseQuery<T>(
    operation: string,
    table: string,
    handler: () => Promise<T>
  ): Promise<T> {
    interface SentrySpan {
      setStatus(status: string): void;
      finish(): void;
    }
    interface SentryTransaction {
      startChild(context: { op: string; description: string }): SentrySpan | undefined;
    }
    interface ScopeWithTransaction {
      getTransaction?(): SentryTransaction | undefined;
    }
    const scope = Sentry.getCurrentScope() as unknown as ScopeWithTransaction;
    const transaction = scope?.getTransaction?.();
    const span = transaction?.startChild({
      op: "db.query",
      description: `${operation} ${table}`,
    });

    try {
      const result = await handler();
      span?.setStatus("ok");
      return result;
    } catch (_error) {
      span?.setStatus("internal_error");
      throw _error;
    } finally {
      span?.finish();
    }
  }

  /**
   * Set user context globally
   */
  static setUser(user: { id: string; email?: string; username?: string } | null) {
    if (user) {
      Sentry.setUser(user);
    } else {
      Sentry.setUser(null);
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  static addBreadcrumb(
    message: string,
    category: string,
    level: Sentry.SeverityLevel = "info",
    data?: Record<string, unknown>
  ) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
    });
  }
}

/**
 * Decorator for automatic error tracking
 */
export function TrackErrors(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (_error) {
      EnhancedErrorTracker.captureException(_error as Error, {
        tags: {
          method: propertyKey,
          class: ((target &&
            typeof target === "object" &&
            "constructor" in target &&
            target.constructor?.name) ||
            "Unknown") as string,
        },
      });
      throw _error;
    }
  };

  return descriptor;
}
