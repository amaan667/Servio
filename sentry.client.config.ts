/**
 * Sentry client configuration
 */

import * as Sentry from "@sentry/nextjs";

// Avoid double-initializing on the client. Instrumentation-client.ts already
// calls Sentry.init, so only initialize here if no client exists (e.g. when
// instrumentation-client is removed). This prevents the runtime warning.
if (!Sentry.getCurrentHub().getClient()) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === "development",
    beforeSend(event) {
      if (process.env.NODE_ENV === "production") {
        if (event.exception) {
          const error = event.exception.values?.[0];
          if (error?.value?.includes("ResizeObserver loop limit exceeded")) {
            return null;
          }
        }
      }
      return event;
    },
  });
}

