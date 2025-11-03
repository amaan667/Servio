/**
 * Production Logger Service
 * Replaces 759+ console.log statements with structured logging
 */

import * as Sentry from "@sentry/nextjs";

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

// Allow flexible context types for logging
type FlexibleLogContext = LogContext | Error | object | string | null | undefined | unknown;

class ProductionLogger {
  private level: LogLevel;
  private serviceName: string;

  constructor(serviceName: string = "servio") {
    this.serviceName = serviceName;

    // Production-ready log level control via environment variable
    // Set LOG_LEVEL=error in Railway to reduce logging by 90%
    // Supported values: debug, info, warn, error
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLogLevel === "ERROR") {
      this.level = LogLevel.ERROR;
    } else if (envLogLevel === "WARN") {
      this.level = LogLevel.WARN;
    } else if (envLogLevel === "DEBUG") {
      this.level = LogLevel.DEBUG;
    } else {
      // Default: INFO in production, DEBUG in development
      this.level = process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, context?: FlexibleLogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level}] [${this.serviceName}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, context?: FlexibleLogContext) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(levelName, message, context);

    // ALWAYS output to console for Railway logs
    // Railway captures stdout/stderr for log viewing
    if (level === LogLevel.ERROR) {
      console.error(formattedMessage);
    } else if (level === LogLevel.WARN) {
      console.warn(formattedMessage);
    } else if (level === LogLevel.INFO) {
      console.info(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // Sentry integration for errors and warnings in production
    const isProduction = process.env.NODE_ENV === "production";
    if (level >= LogLevel.WARN && isProduction) {
      if (level === LogLevel.ERROR) {
        Sentry.captureException(new Error(message), {
          tags: {
            service: this.serviceName,
            level: levelName,
          },
          extra: context as any,
        } as any);
      } else if (level === LogLevel.WARN) {
        Sentry.captureMessage(message, {
          level: "warning",
          tags: {
            service: this.serviceName,
          },
          extra: context as any,
        } as any);
      }
    }
  }

  debug(message: string, context?: FlexibleLogContext) {
    this.log(LogLevel.DEBUG, "DEBUG", message, context);
  }

  info(message: string, context?: FlexibleLogContext) {
    this.log(LogLevel.INFO, "INFO", message, context);
  }

  warn(message: string, context?: FlexibleLogContext) {
    this.log(LogLevel.WARN, "WARN", message, context);
  }

  error(message: string, context?: FlexibleLogContext) {
    this.log(LogLevel.ERROR, "ERROR", message, context);
  }

  // Convenience methods for common scenarios
  apiRequest(method: string, path: string, context?: FlexibleLogContext) {
    this.info(`API Request: ${method} ${path}`, context);
  }

  apiResponse(
    method: string,
    path: string,
    status: number,
    duration: number,
    context?: FlexibleLogContext
  ) {
    this.info(`API Response: ${method} ${path} ${status} (${duration}ms)`, context);
  }

  authEvent(event: string, userId: string, context?: FlexibleLogContext) {
    const contextObj =
      context && typeof context === "object" ? (context as Record<string, unknown>) : {};
    this.info(`Auth Event: ${event}`, { userId, ...contextObj });
  }

  dbQuery(query: string, duration: number, context?: FlexibleLogContext) {
    this.debug(`DB Query: ${query} (${duration}ms)`, context);
  }

  cacheHit(key: string) {
    this.debug(`Cache Hit: ${key}`);
  }

  cacheMiss(key: string) {
    this.debug(`Cache Miss: ${key}`);
  }

  performance(metric: string, value: number, context?: FlexibleLogContext) {
    this.info(`Performance: ${metric} = ${value}ms`, context);
  }
}

// Singleton instances for different services
export const logger = new ProductionLogger("servio");
export const apiLogger = new ProductionLogger("api");
export const authLogger = new ProductionLogger("auth");
export const dbLogger = new ProductionLogger("db");
export const cacheLogger = new ProductionLogger("cache");
export const aiLogger = new ProductionLogger("ai");

// Export default logger
export default logger;
