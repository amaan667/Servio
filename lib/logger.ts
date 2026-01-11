/**
 * Silent Logger - Production Mode
 * All logging disabled - errors tracked via Sentry instrumentation only
 */

// No-op function that accepts any arguments
const noop = (..._args: unknown[]) => { /* Intentionally empty */ };

export const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  log: noop,
};

export const apiLogger = {
  apiRequest: noop,
  apiResponse: noop,
  apiError: noop,
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
};

export const authLogger = {
  authSuccess: noop,
  authFailure: noop,
  authAttempt: noop,
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
};

export const dbLogger = {
  dbQuery: noop,
  dbError: noop,
  dbConnection: noop,
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
};

export const cacheLogger = {
  cacheHit: noop,
  cacheMiss: noop,
  cacheSet: noop,
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
};

export const aiLogger = {
  aiRequest: noop,
  aiResponse: noop,
  aiError: noop,
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
};

export default logger;

// No-op helpers
export function logApiCall(..._args: unknown[]) {}
export function logDbQuery(..._args: unknown[]) {}
