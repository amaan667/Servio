/**
 * Error tracking and monitoring utilities
 * Integrates with Sentry for comprehensive error tracking
 */

import React from "react";

interface ErrorContext {
  userId?: string;
  venueId?: string;
  userRole?: string;
  url: string;
  timestamp: number;
  userAgent: string;
  sessionId: string;
  customData?: Record<string, unknown>;
}

// interface ErrorBoundaryState {
//   hasError: boolean;
//   error?: Error;
//   errorInfo?: React.ErrorInfo;
// }

class ErrorTracker {
  private isEnabled: boolean = true;
  private sentryDsn: string | null = null;
  private environment: string = "development";

  constructor() {
    this.initializeSentry();
  }

  private initializeSentry() {
    // Initialize Sentry if DSN is provided
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      this.sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      this.environment = process.env.NODE_ENV || "development";

      // Initialize Sentry client
      this.setupSentry();
    }
  }

  private async setupSentry() {
    // Dynamic import to avoid SSR issues
    try {
      const Sentry = await import("@sentry/nextjs");

      Sentry.init({
        dsn: this.sentryDsn || undefined,
        environment: this.environment,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        // Integrations are automatically included by @sentry/nextjs
        // BrowserTracing and Replay are enabled by default when configured
        beforeSend(event) {
          // Filter out development errors
          if (this.environment === "development") {
            return null;
          }
          return event;
        },
      });
    } catch (_error) {
      // Ignore Sentry initialization errors
    }
  }

  public captureError(error: Error, context?: Partial<ErrorContext>) {
    if (!this.isEnabled) return;

    const errorContext: ErrorContext = {
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      timestamp: Date.now(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      sessionId: this.getSessionId(),
      ...context,
    };

    // Log to console in development
    if (this.environment === "development") {
      //
    }

    // Send to Sentry
    if (this.sentryDsn) {
      this.sendToSentry(error, errorContext);
    }

    // Send to custom endpoint
    this.sendToCustomEndpoint(error, errorContext);
  }

  public captureMessage(
    message: string,
    level: "info" | "warning" | "error" = "info",
    context?: Partial<ErrorContext>
  ) {
    if (!this.isEnabled) return;

    const errorContext: ErrorContext = {
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      timestamp: Date.now(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      sessionId: this.getSessionId(),
      ...context,
    };

    // Log to console in development
    if (this.environment === "development") {
      //
    }

    // Send to Sentry
    if (this.sentryDsn) {
      this.sendMessageToSentry(message, level, errorContext);
    }

    // Send to custom endpoint
    this.sendMessageToCustomEndpoint(message, level, errorContext);
  }

  public setUser(userId: string, userRole?: string, venueId?: string) {
    if (this.sentryDsn) {
      import("@sentry/nextjs")
        .then((Sentry) => {
          Sentry.setUser({
            id: userId,
            role: userRole,
            venueId: venueId,
          });
        })
        .catch(() => {
          // Sentry not available
        });
    }
  }

  public setContext(key: string, value: unknown) {
    if (this.sentryDsn) {
      import("@sentry/nextjs")
        .then((Sentry) => {
          const contextValue = value as Record<string, unknown> | null;
          Sentry.setContext(key, contextValue);
        })
        .catch(() => {
          // Sentry not available
        });
    }
  }

  public addBreadcrumb(
    message: string,
    category: string,
    level: "info" | "warning" | "error" = "info"
  ) {
    if (this.sentryDsn) {
      import("@sentry/nextjs")
        .then((Sentry) => {
          Sentry.addBreadcrumb({
            message,
            category,
            level,
            timestamp: Date.now(),
          });
        })
        .catch(() => {
          // Sentry not available
        });
    }
  }

  private async sendToSentry(error: Error, context: ErrorContext) {
    try {
      const { captureException, setContext } = await import("@sentry/nextjs");

      setContext("error", {
        url: context.url,
        timestamp: context.timestamp,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        ...context.customData,
      });

      if (context.userId) {
        setContext("user", {
          id: context.userId,
          role: context.userRole,
          venueId: context.venueId,
        });
      }

      captureException(error);
    } catch {
      // Failed to send error to Sentry
    }
  }

  private async sendMessageToSentry(message: string, level: string, context: ErrorContext) {
    try {
      const { captureMessage, setContext } = await import("@sentry/nextjs");

      setContext("message", {
        url: context.url,
        timestamp: context.timestamp,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        ...context.customData,
      });

      if (context.userId) {
        setContext("user", {
          id: context.userId,
          role: context.userRole,
          venueId: context.venueId,
        });
      }

      captureMessage(message, level as "info" | "warning" | "error");
    } catch (_error) {
      // Error handled silently
    }
  }

  private async sendToCustomEndpoint(error: Error, context: ErrorContext) {
    try {
      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          context,
        }),
      });
    } catch (_error) {
      // Error handled silently
    }
  }

  private async sendMessageToCustomEndpoint(message: string, level: string, context: ErrorContext) {
    try {
      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            text: message,
            level,
          },
          context,
        }),
      });
    } catch (_error) {
      // Error handled silently
    }
  }

  private getSessionId(): string {
    if (typeof window === "undefined") return "server";

    let sessionId = sessionStorage.getItem("error-session-id");
    if (!sessionId) {
      sessionId = Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("error-session-id", sessionId);
    }
    return sessionId;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
}

// Singleton instance
let errorTracker: ErrorTracker | null = null;

export function getErrorTracker(): ErrorTracker {
  if (!errorTracker) {
    errorTracker = new ErrorTracker();
  }
  return errorTracker;
}

// React hook for error tracking
export function useErrorTracking() {
  const [errorTracker] = React.useState(() => getErrorTracker());

  const captureError = React.useCallback(
    (error: Error, context?: Partial<ErrorContext>) => {
      errorTracker.captureError(error, context);
    },
    [errorTracker]
  );

  const captureMessage = React.useCallback(
    (message: string, level?: "info" | "warning" | "error", context?: Partial<ErrorContext>) => {
      errorTracker.captureMessage(message, level, context);
    },
    [errorTracker]
  );

  const setUser = React.useCallback(
    (userId: string, userRole?: string, venueId?: string) => {
      errorTracker.setUser(userId, userRole, venueId);
    },
    [errorTracker]
  );

  const setContext = React.useCallback(
    (key: string, value: unknown) => {
      errorTracker.setContext(key, value);
    },
    [errorTracker]
  );

  const addBreadcrumb = React.useCallback(
    (message: string, category: string, level: "info" | "warning" | "error" = "info") => {
      errorTracker.addBreadcrumb(message, category, level);
    },
    [errorTracker]
  );

  return {
    captureError,
    captureMessage,
    setUser,
    setContext,
    addBreadcrumb,
  };
}

export default ErrorTracker;
