/**
 * Production Logger Service
 * Replaces 759+ console.log statements with structured logging
 */

import * as Sentry from '@sentry/nextjs';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export { ProductionLogger };

interface LogContext {
  [key: string]: unknown;
}

class ProductionLogger {
  private level: LogLevel;
  private serviceName: string;

  constructor(serviceName: string = 'servio') {
    this.serviceName = serviceName;
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] [${this.serviceName}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(levelName, message, context);

    // Console output
    switch (level) {
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV !== 'production') {
          console.debug(formatted);
        }
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }

    // Sentry integration for errors and warnings
    if (level >= LogLevel.WARN && process.env.NODE_ENV === 'production') {
      if (level === LogLevel.ERROR) {
        Sentry.captureException(new Error(message), {
          tags: {
            service: this.serviceName,
            level: levelName,
          },
          extra: context,
        });
      } else if (level === LogLevel.WARN) {
        Sentry.captureMessage(message, {
          level: 'warning',
          tags: {
            service: this.serviceName,
          },
          extra: context,
        });
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, 'ERROR', message, context);
  }

  // Convenience methods for common scenarios
  apiRequest(method: string, path: string, context?: LogContext) {
    this.info(`API Request: ${method} ${path}`, context);
  }

  apiResponse(method: string, path: string, status: number, duration: number, context?: LogContext) {
    this.info(`API Response: ${method} ${path} ${status} (${duration}ms)`, context);
  }

  authEvent(event: string, userId: string, context?: LogContext) {
    this.info(`Auth Event: ${event}`, { userId, ...context });
  }

  dbQuery(query: string, duration: number, context?: LogContext) {
    this.debug(`DB Query: ${query} (${duration}ms)`, context);
  }

  cacheHit(key: string) {
    this.debug(`Cache Hit: ${key}`);
  }

  cacheMiss(key: string) {
    this.debug(`Cache Miss: ${key}`);
  }

  performance(metric: string, value: number, context?: LogContext) {
    this.info(`Performance: ${metric} = ${value}ms`, context);
  }
}

// Singleton instances for different services
export const logger = new ProductionLogger('servio');
export const apiLogger = new ProductionLogger('api');
export const authLogger = new ProductionLogger('auth');
export const dbLogger = new ProductionLogger('db');
export const cacheLogger = new ProductionLogger('cache');
export const aiLogger = new ProductionLogger('ai');

// Export default logger
export default logger;

