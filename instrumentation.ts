/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js on server startup
 * Perfect place to initialize global error handling and Sentry
 */

import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Initialize Sentry based on runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }

  // Initialize error suppression (only on server)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initErrorSuppression } = await import("./lib/error-suppression");
    initErrorSuppression();
  }
}

export const onRequestError = Sentry.captureRequestError;
