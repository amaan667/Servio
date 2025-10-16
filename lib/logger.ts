/**
 * Production-safe logging utility
 * Replaces console.log statements throughout the app
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

interface LogData {
  [key: string]: any;
}

export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (message: string, data?: LogData) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  },

  /**
   * Info logs - shown in all environments
   */
  info: (message: string, data?: LogData) => {
    console.log(`[INFO] ${message}`, data || '');
  },

  /**
   * Warning logs - shown in all environments
   */
  warn: (message: string, data?: LogData) => {
    console.warn(`[WARN] ${message}`, data || '');
  },

  /**
   * Error logs - shown in all environments
   * TODO: Send to error tracking service (Sentry) in production
   */
  error: (message: string, error?: Error | any, data?: LogData) => {
    console.error(`[ERROR] ${message}`, error || '', data || '');
    
    // In production, send to error tracking
    if (isProduction && typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error || new Error(message), {
        extra: data,
      });
    }
  },

  /**
   * Performance timing logs
   */
  perf: (operation: string, startTime: number) => {
    const duration = Date.now() - startTime;
    if (isDevelopment || duration > 1000) { // Log slow operations in production
      console.log(`[PERF] ${operation}: ${duration}ms`);
    }
  },
};

export default logger;
