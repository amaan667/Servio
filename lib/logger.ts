/**
 * Silent Logger - Production Mode
 * All logging disabled - errors tracked via Sentry instrumentation only
 */

// No-op function that accepts any arguments
const noop = (..._args: unknown[]) => {};

export const logger = {

};

export const apiLogger = {

};

export const authLogger = {

};

export const dbLogger = {

};

export const cacheLogger = {

};

export const aiLogger = {

};

export default logger;

// No-op helpers
export function logApiCall(..._args: unknown[]) {}
export function logDbQuery(..._args: unknown[]) {}
