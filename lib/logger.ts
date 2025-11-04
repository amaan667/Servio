/**
 * Silent Logger - Production Mode
 * All logging disabled - errors tracked via Sentry instrumentation only
 */

const noop = () => {};

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
export function logApiCall(
  _endpoint: string,
  _method: string,
  _duration: number,
  _status: number
) {}
export function logDbQuery(_query: string, _duration: number, _rows?: number) {}
