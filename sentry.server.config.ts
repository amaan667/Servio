// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Never hardcode DSNs. Configure via environment only.

  // debug option removed - only works with debug bundles, causes warning with production bundles

  // Default: do NOT send PII unless explicitly enabled.
