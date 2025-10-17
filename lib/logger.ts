/**
 * Production-ready logging utility
 * Replaces console.log with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In development, use console for readability
    if (this.isDevelopment) {
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level];

      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context || '');
    }

    // In production, send to logging service
    if (this.isProduction) {
      // TODO: Send to logging service (e.g., LogRocket, Datadog, etc.)
      // For now, only log errors in production
      if (level === 'error') {
        console.error(JSON.stringify(logEntry));
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    const errorContext = {
      ...context,
      error: error?.message,
      stack: error?.stack,
    };
    this.log('error', message, errorContext);
  }
}

export const logger = new Logger();

// Helper for API routes
export function logApiCall(endpoint: string, method: string, duration: number, status: number) {
  logger.info('API Call', {
    endpoint,
    method,
    duration: `${duration}ms`,
    status,
  });
}

// Helper for database queries
export function logDbQuery(query: string, duration: number, rows?: number) {
  logger.debug('Database Query', {
    query: query.substring(0, 100),
    duration: `${duration}ms`,
    rows,
  });
}
