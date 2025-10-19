/**
 * Production-ready logging utility
 * Replaces console.log with structured logging
 * Now uses production logger with Sentry integration
 */

export { logger, apiLogger, authLogger, dbLogger, cacheLogger, aiLogger } from './logger/production-logger';
export { default } from './logger/production-logger';

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
