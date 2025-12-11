/**
 * Sentry client configuration
 */

import * as Sentry from "@sentry/nextjs";

// Avoid double-initializing on the client. instrumentation-client.ts already
// calls Sentry.init. Bail out if a client is already registered or if we
// previously flagged initialization on window.
const hub = (
  Sentry as unknown as { getCurrentHub?: () => { getClient?: () => unknown } }
).getCurrentHub?.();
const alreadyHasClient = !!hub?.getClient?.();
const windowFlag =
  typeof window !== "undefined" &&
  (window as unknown as { __sentryInitialized?: boolean }).__sentryInitialized;

if (!alreadyHasClient && !windowFlag) {
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

  if (typeof window !== "undefined") {
    (window as unknown as { __sentryInitialized?: boolean }).__sentryInitialized = true;
  }
}
