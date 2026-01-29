/**
 * Enhanced Structured Logger
 * Provides consistent, structured logging with context for production observability
 */

import { isDevelopment } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  requestId?: string;
  userId?: string;
  venueId?: string;
  orderId?: string;
  sessionId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

class StructuredLogger {
  private formatLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): StructuredLog {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      log.context = context;
    }

    if (error) {
      log.error = {
        name: error.name,
        message: error.message,
        stack: isDevelopment() ? error.stack : undefined,
        code: (error as { code?: string }).code,
      };
    }

    return log;
  }

  private shouldLog(level: LogLevel): boolean {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() || (isDevelopment() ? "debug" : "info");
    const levels: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];
    const envIndex = levels.indexOf(envLevel as LogLevel);
    const logIndex = levels.indexOf(level);
    return logIndex >= envIndex;
  }

  private output(log: StructuredLog): void {
    if (!this.shouldLog(log.level)) {
      return;
    }

    const jsonLog = JSON.stringify(log);

    // In production, log to stdout (captured by Railway/logging services)
    // In development, use console with colors
    if (isDevelopment()) {
      const colors = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m", // Green
        warn: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
        fatal: "\x1b[35m", // Magenta
        reset: "\x1b[0m",
      };

      const color = colors[log.level] || colors.reset;

      console.log(`${color}[${log.level.toUpperCase()}]${colors.reset} ${log.message}`);
      if (log.context) {
        console.log("  Context:", log.context);
      }
      if (log.error) {
        console.error("  Error:", log.error);
      }
    } else {
      // Production: structured JSON logging

      console.log(jsonLog);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.formatLog("debug", message, context));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatLog("info", message, context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.output(this.formatLog("warn", message, context, error));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.output(this.formatLog("error", message, context, error));
  }

  fatal(message: string, context?: LogContext, error?: Error): void {
    this.output(this.formatLog("fatal", message, context, error));
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, context?: LogContext, duration?: number): void {
    this.info(`${method} ${path}`, {
      ...context,
      duration,
      type: "api_request",
    });
  }

  /**
   * Log API response
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    context?: LogContext,
    duration?: number
  ): void {
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    this[level](`${method} ${path} ${statusCode}`, {
      ...context,
      statusCode,
      duration,
      type: "api_response",
    });
  }

  /**
   * Log database operation
   */
  logDatabase(operation: string, table: string, context?: LogContext, duration?: number): void {
    this.debug(`DB ${operation} ${table}`, {
      ...context,
      operation,
      table,
      duration,
      type: "database",
    });
  }

  /**
   * Log cache operation
   */
  logCache(operation: "hit" | "miss" | "set" | "delete", key: string, context?: LogContext): void {
    this.debug(`Cache ${operation}: ${key}`, {
      ...context,
      operation,
      key,
      type: "cache",
    });
  }

  /**
   * Log external service call
   */
  logExternalService(
    service: string,
    operation: string,
    context?: LogContext,
    duration?: number,
    error?: Error
  ): void {
    if (error) {
      this.error(
        `External ${service}.${operation} failed`,
        {
          ...context,
          service,
          operation,
          duration,
          type: "external_service",
        },
        error
      );
    } else {
      this.info(`External ${service}.${operation}`, {
        ...context,
        service,
        operation,
        duration,
        type: "external_service",
      });
    }
  }
}

// Export singleton instance
export const logger = new StructuredLogger();
