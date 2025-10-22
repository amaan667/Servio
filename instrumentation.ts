/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js on server startup
 * Perfect place to initialize global error handling
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initErrorSuppression } = await import("./lib/error-suppression");
    initErrorSuppression();
  }
}
