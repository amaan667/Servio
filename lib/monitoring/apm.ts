/**
 * APM (Application Performance Monitoring) Integration
 * Supports Datadog and New Relic
 */

import { isDevelopment } from "@/lib/env";

export interface APMConfig {
  provider: "datadog" | "newrelic" | "none";
  serviceName?: string;
  environment?: string;
  version?: string;
}

let apmInitialized = false;

/**
 * Initialize APM based on environment variables
 */
export function initializeAPM(): void {
  if (apmInitialized) return;

  const provider = (process.env.APM_PROVIDER || "none").toLowerCase() as APMConfig["provider"];

  if (provider === "datadog") {
    initializeDatadog();
  } else if (provider === "newrelic") {
    initializeNewRelic();
  }

  apmInitialized = true;
}

/**
 * Initialize Datadog APM
 */
function initializeDatadog(): void {
  try {
    // Dynamic import to avoid breaking if package not installed
    const tracer = require("dd-trace");

    tracer.init({
      service: process.env.DD_SERVICE || "servio-api",
      env: process.env.DD_ENV || process.env.NODE_ENV || "development",
      version: process.env.DD_VERSION || "0.1.6",
      logInjection: true,
      runtimeMetrics: true,
      profiling: process.env.DD_PROFILING_ENABLED === "true",
      tags: {
        component: "api",
      },
    });

  } catch (_error) {
    // Datadog package not installed - graceful degradation
  }
}

/**
 * Initialize New Relic APM
 */
function initializeNewRelic(): void {
  try {
    // Dynamic import to avoid breaking if package not installed

    require("newrelic");

  } catch (_error) {
    // New Relic package not installed - graceful degradation
  }
}

/**
 * Start APM transaction
 */
export function startTransaction(
  name: string,
  type: "web" | "db" | "cache" | "external" = "web"
): {
  finish: () => void;
  setTag: (key: string, value: string) => void;
  addError: (error: Error) => void;
} {
  const provider = (process.env.APM_PROVIDER || "none").toLowerCase();

  // Return no-op if APM not configured
  if (provider === "none") {
    return {
      finish: () => {},
      setTag: () => {},
      addError: () => {},
    };
  }

  // For Datadog
  if (provider === "datadog") {
    try {
      const tracer = require("dd-trace");
      const span = tracer.startSpan(name, {
        service: process.env.DD_SERVICE || "servio-api",
        resource: name,
        type,
      });

      return {
        finish: () => span.finish(),
        setTag: (key: string, value: string) => span.setTag(key, value),
        addError: (error: Error) =>
          span.setTag("error", true).setTag("error.message", error.message),
      };
    } catch {
      return { finish: () => {}, setTag: () => {}, addError: () => {} };
    }
  }

  // For New Relic
  if (provider === "newrelic") {
    try {
      const newrelic = require("newrelic");
      return {
        finish: () => {},
        setTag: (key: string, value: string) => newrelic.addCustomAttribute(key, value),
        addError: (error: Error) => newrelic.noticeError(error),
      };
    } catch {
      return { finish: () => {}, setTag: () => {}, addError: () => {} };
    }
  }

  return { finish: () => {}, setTag: () => {}, addError: () => {} };
}

/**
 * Record APM metric
 */
export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  const provider = (process.env.APM_PROVIDER || "none").toLowerCase();

  if (provider === "datadog") {
    try {
      const tracer = require("dd-trace");
      tracer.dogstatsd.histogram(
        name,
        value,
        tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : []
      );
    } catch {
      // Datadog not available
    }
  }

  if (provider === "newrelic") {
    try {
      const newrelic = require("newrelic");
      newrelic.recordMetric(name, value);
    } catch {
      // New Relic not available
    }
  }
}

// Auto-initialize on import (only in production)
if (!isDevelopment() && typeof window === "undefined") {
  initializeAPM();
}
