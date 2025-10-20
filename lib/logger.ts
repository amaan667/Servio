/**
 * Unified Logger
 * Single source of truth for all logging in the application
 * Production-ready with Sentry integration
 */

export { logger, apiLogger, authLogger, dbLogger, cacheLogger, aiLogger } from './logger/production-logger';

// Re-export as default for convenience
export { logger as default } from './logger/production-logger';

// Helper for API routes
export function logApiCall(endpoint: string, method: string, duration: number, status: number) {
  const { apiLogger } = require('./logger/production-logger');
  apiLogger.apiResponse(method, endpoint, status, duration);
}

// Helper for database queries
export function logDbQuery(query: string, duration: number, rows?: number) {
  const { dbLogger } = require('./logger/production-logger');
  dbLogger.dbQuery(query, duration, { rows });
}
