type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private log(entry: LogEntry) {
    if (this.isDevelopment) {
      const contextStr = entry.context
        ? ` ${JSON.stringify(entry.context)}`
        : "";
      console.log(
        `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`,
      );
    }
  }

  info(message: string, context?: Record<string, any>) {
    this.log(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(this.formatMessage("warn", message, context));
  }

  error(message: string, context?: Record<string, any>) {
    this.log(this.formatMessage("error", message, context));

    // In production, you might want to send errors to a service like Sentry
    if (!this.isDevelopment && typeof window !== "undefined") {
      // Send to error tracking service
    }
  }

  debug(message: string, context?: Record<string, any>) {
    if (this.isDevelopment) {
      this.log(this.formatMessage("debug", message, context));
    }
  }
}

export const logger = new Logger();
