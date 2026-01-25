# APM (Application Performance Monitoring) Setup Guide

## Overview

The platform supports APM integration with Datadog and New Relic for production monitoring.

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# APM Provider: "datadog", "newrelic", or "none" (default)
APM_PROVIDER=datadog

# Datadog Configuration
DD_SERVICE=servio-api
DD_ENV=production
DD_VERSION=0.1.6
DD_PROFILING_ENABLED=true

# New Relic Configuration
# New Relic uses its own configuration file (newrelic.js)
# See: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/install-nodejs-agent/
```

## Installation

### Datadog

```bash
pnpm add dd-trace
```

### New Relic

```bash
pnpm add newrelic
```

Create `newrelic.js` in project root:

```javascript
exports.config = {
  app_name: ['servio-api'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  application_logging: {
    forwarding: {
      enabled: true,
    },
  },
};
```

## Features

- **Automatic Transaction Tracking**: All API requests are tracked
- **Error Tracking**: Errors are automatically sent to APM
- **Performance Metrics**: Request duration, database queries, external calls
- **Custom Tags**: Request ID, user ID, venue ID automatically tagged

## Usage

APM is automatically initialized on server startup via `instrumentation.ts`. No additional code changes needed.

## Monitoring

- **Datadog**: View in Datadog APM dashboard
- **New Relic**: View in New Relic APM dashboard

Both providers will automatically track:
- API endpoint performance
- Database query performance
- External service calls (Stripe, etc.)
- Error rates and stack traces
