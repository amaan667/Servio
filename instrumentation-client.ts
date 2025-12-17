/**
 * Client-side instrumentation (Next.js file convention)
 *
 * Intentionally minimal.
 *
 * The Sentry Next.js integration injects client initialization during build.
 * Keeping this file present (and empty) satisfies the Next.js convention and
 * prevents relying on `sentry.client.config.ts` (which may stop working with
 * Turbopack).
 */
export {};

// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Never hardcode DSNs. Configure via environment only.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  // Default: do NOT send PII unless explicitly enabled.
  sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
