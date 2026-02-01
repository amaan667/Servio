/**
 * @fileoverview Distributed Tracing with OpenTelemetry
 * Provides comprehensive observability across services
 */

import { logger } from "@/lib/monitoring/structured-logger";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  tags: Record<string, string>;
}

export interface Span {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "ok" | "error";
  error?: Error;
  tags: Record<string, string>;
  logs: Array<{
    timestamp: number;
    level: "info" | "warn" | "error";
    message: string;
  }>;
}

/**
 * Distributed Tracer
 * Provides distributed tracing capabilities
 */
export class DistributedTracer {
  private traces = new Map<string, TraceContext>();
  private spans = new Map<string, Span[]>();
  private currentContext: TraceContext | null = null;

  /**
   * Start a new trace
   */
  startTrace(name: string, tags: Record<string, string> = {}): TraceContext {
    const traceId = this.generateId();
    const spanId = this.generateId();

    const context: TraceContext = {
      traceId,
      spanId,
      startTime: Date.now(),
      tags,
    };

    this.traces.set(traceId, context);
    this.currentContext = context;

    logger.debug("Started trace", { traceId, spanId, name, tags });

    return context;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, tags: Record<string, string> = {}): Span {
    if (!this.currentContext) {
      // Start a new trace if none exists
      this.startTrace(name, tags);
      return this.getCurrentSpan(name, tags);
    }

    const span: Span = {
      name,
      startTime: Date.now(),
      status: "ok",
      tags: { ...this.currentContext.tags, ...tags },
      logs: [],
    };

    const spanKey = `${this.currentContext.traceId}:${this.currentContext.spanId}`;
    if (!this.spans.has(spanKey)) {
      this.spans.set(spanKey, []);
    }

    this.spans.get(spanKey)!.push(span);

    logger.debug("Started span", {
      traceId: this.currentContext.traceId,
      spanId: this.currentContext.spanId,
      name,
      tags,
    });

    return span;
  }

  /**
   * End current span
   */
  endSpan(span: Span, status: "ok" | "error" = "ok", error?: Error): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (error) {
      span.error = error;
      span.logs.push({
        timestamp: Date.now(),
        level: "error",
        message: error.message,
      });
    }

    logger.debug("Ended span", {
      name: span.name,
      duration: span.duration,
      status,
    });
  }

  /**
   * Get current span
   */
  private getCurrentSpan(name: string, tags: Record<string, string>): Span {
    if (!this.currentContext) {
      throw new Error("No active trace context");
    }

    return {
      name,
      startTime: Date.now(),
      status: "ok",
      tags: { ...this.currentContext.tags, ...tags },
      logs: [],
    };
  }

  /**
   * Add log to current span
   */
  addLog(level: "info" | "warn" | "error", message: string): void {
    if (!this.currentContext) {
      return;
    }

    const spanKey = `${this.currentContext.traceId}:${this.currentContext.spanId}`;
    const spans = this.spans.get(spanKey);

    if (spans && spans.length > 0) {
      const currentSpan = spans[spans.length - 1];
      if (currentSpan) {
        currentSpan.logs.push({
          timestamp: Date.now(),
          level,
          message,
        });
      }
    }
  }

  /**
   * Add tag to current trace
   */
  addTag(key: string, value: string): void {
    if (!this.currentContext) {
      return;
    }

    this.currentContext.tags[key] = value;
  }

  /**
   * End current trace
   */
  endTrace(): void {
    if (!this.currentContext) {
      return;
    }

    const traceId = this.currentContext.traceId;
    const spanKey = `${traceId}:${this.currentContext.spanId}`;
    const spans = this.spans.get(spanKey) || [];

    const totalDuration = spans.reduce((sum, span) => sum + (span.duration || 0), 0);

    logger.info("Ended trace", {
      traceId,
      spanCount: spans.length,
      totalDuration,
    });

    this.currentContext = null;
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): TraceContext | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get spans for trace
   */
  getSpans(traceId: string, spanId: string): Span[] {
    const spanKey = `${traceId}:${spanId}`;
    return this.spans.get(spanKey) || [];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Export trace for analysis
   */
  exportTrace(traceId: string): {
    trace: TraceContext;
    spans: Span[];
    summary: {
      totalDuration: number;
      spanCount: number;
      errorCount: number;
    };
  } | null {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return null;
    }

    const spanKey = `${traceId}:${trace.spanId}`;
    const spans = this.spans.get(spanKey) || [];

    const totalDuration = spans.reduce((sum, span) => sum + (span.duration || 0), 0);
    const errorCount = spans.filter((span) => span.status === "error").length;

    return {
      trace,
      spans,
      summary: {
        totalDuration,
        spanCount: spans.length,
        errorCount,
      },
    };
  }

  /**
   * Clear old traces
   */
  clearOldTraces(maxAge: number = 3600000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [traceId, context] of this.traces.entries()) {
      if (now - context.startTime > maxAge) {
        toDelete.push(traceId);
      }
    }

    for (const traceId of toDelete) {
      this.traces.delete(traceId);
      const spanKey = `${traceId}:${this.traces.get(traceId)?.spanId}`;
      this.spans.delete(spanKey);
    }

    logger.info("Cleared old traces", { count: toDelete.length });
  }
}

// Export singleton instance
export const tracer = new DistributedTracer();

/**
 * Decorator for automatic tracing
 */
export function Trace(name?: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const spanName = name || _propertyKey;
      const span = tracer.startSpan(spanName);

      try {
        const result = await originalMethod.apply(this, args);
        tracer.endSpan(span, "ok");
        return result;
      } catch (error) {
        tracer.endSpan(span, "error", error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Middleware for HTTP request tracing
 * Note: This is a placeholder for Next.js middleware implementation
 * Actual implementation would use Next.js middleware pattern
 */
export function traceMiddleware(req: Request, res: Response, next: () => void): void {
  const traceName = `${req.method} ${req.url}`;
  const trace = tracer.startTrace(traceName, {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get("user-agent") || "unknown",
  });

  // Add trace ID to response headers
  res.headers.set("X-Trace-ID", trace.traceId);

  // End trace when response finishes
  // Note: Next.js Response doesn't have .end() method
  // This would need to be implemented differently in Next.js middleware
  tracer.endTrace();

  next();
}
