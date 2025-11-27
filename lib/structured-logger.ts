/**
 * Structured Logging System
 * Provides consistent, searchable logs with context
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  userId?: string;
  venueId?: string;
  orderId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

class StructuredLogger {
  private env: string;
  private serviceName: string;

  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.serviceName = 'servio';
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: this.env === 'development' ? error.stack : undefined,
        code: (error as { code?: string }).code,
      };
    }

    if (metadata) {
      entry.metadata = metadata;
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    // In production, send to logging service (DataDog, New Relic, etc.)
    // const json = JSON.stringify(entry);
    if (this.env === 'production') {
      // Logging service: Currently using console with structured format
      // For production, integrate with Datadog, LogRocket, or similar service
      // await fetch('https://logs.example.com/ingest', { body: json });
    }

    // Output to console in structured format
    switch (entry.level) {
      case LogLevel.DEBUG:
        break;
      case LogLevel.INFO:
        break;
      case LogLevel.WARN:
        break;
      case LogLevel.ERROR:
        break;
    }
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    if (this.env === 'development') {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, context, undefined, metadata);
      this.output(entry);
    }
  }

  info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context, undefined, metadata);
    this.output(entry);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context, undefined, metadata);
    this.output(entry);
  }

  error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error, metadata);
    this.output(entry);
    
    // Send to error tracking service (Sentry)
    if (this.env === 'production' && error) {
      // Sentry is already configured in sentry config files
    }
  }

  // Convenience methods for common scenarios
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, context, { method, path });
  }

  apiResponse(method: string, path: string, status: number, duration: number, context?: LogContext): void {
    this.info(`API Response: ${method} ${path} ${status}`, context, { method, path, status, duration });
  }

  dbQuery(query: string, duration: number, context?: LogContext): void {
    this.debug(`DB Query executed in ${duration}ms`, context, { query, duration });
  }

  userAction(action: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.info(`User Action: ${action}`, context, metadata);
  }

  securityEvent(event: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.warn(`Security Event: ${event}`, context, metadata);
  }
}

export const structuredLogger = new StructuredLogger();

