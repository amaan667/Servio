/**
 * Comprehensive Monitoring & Alerting
 * Integrates with Sentry and provides custom metrics tracking
 */

export type AlertLevel = "info" | "warning" | "error" | "critical";

export interface MonitoringEvent {

  metadata?: Record<string, unknown>;

}

class MonitoringService {
  private events: MonitoringEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  /**
   * Track an event
   */
  async trackEvent(

    metadata?: Record<string, unknown>
  ) {
    const event: MonitoringEvent = {
      name,
      level,
      message,
      metadata,

    };

    // Add to local events
    this.events.push(event);

    // Keep only last MAX_EVENTS
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }

    // Log based on level
    const logData = { name, message, metadata };

    switch (level) {
      case "critical":
      case "error":
        
        await this.sendToSentry(event, "error");
        await this.sendAlert(event);
        break;
      case "warning":
        
        await this.sendToSentry(event, "warning");
        break;
      case "info":

    }
  }

  /**
   * Send event to Sentry
   */
  private async sendToSentry(event: MonitoringEvent, level: "error" | "warning" | "info") {
    if (typeof window === "undefined") return;

    try {
      const Sentry = await import("@sentry/nextjs");

      if (level === "error") {
        Sentry.captureException(new Error(event.message), {

          },

      } else {
        Sentry.captureMessage(event.message, {
          level,

          },

      }
    } catch (error) {
      // Sentry not available
    }
  }

  /**
   * Send critical alert (email, Slack, etc.)
   */
  private async sendAlert(event: MonitoringEvent) {
    if (event.level !== "critical") return;

    try {
      // Send to alerting service (implement based on your needs)
      // Options: Email, Slack webhook, PagerDuty, etc.

      

      // Example: Send to Slack webhook
      if (process.env.SLACK_WEBHOOK_URL) {
        await fetch(process.env.SLACK_WEBHOOK_URL, {

          headers: { "Content-Type": "application/json" },

            text: `🚨 CRITICAL: ${event.message}`,

                  text: `*${event.name}*\n${event.message}`,
                },
              },
              {

                    text: `Metadata: \`\`\`${JSON.stringify(event.metadata, null, 2)}\`\`\``,
                  },
                ],
              },
            ],
          }),

      }
    } catch (error) {

    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): MonitoringEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events by level
   */
  getEventsByLevel(level: AlertLevel, limit: number = 100): MonitoringEvent[] {
    return this.events.filter((e) => e.level === level).slice(-limit);
  }

  /**
   * Get events by name
   */
  getEventsByName(name: string, limit: number = 100): MonitoringEvent[] {
    return this.events.filter((e) => e.name === name).slice(-limit);
  }

  /**
   * Get monitoring summary
   */
  getSummary() {
    const last24h = this.events.filter((e) => e.timestamp > Date.now() - 24 * 60 * 60 * 1000);

    return {

      },
    };
  }
}

// Singleton instance
const monitoring = new MonitoringService();

/**
 * Quick alert helpers
 */
export const alerts = {
  info: (name: string, message: string, metadata?: Record<string, unknown>) =>
    monitoring.trackEvent(name, "info", message, metadata),

  warning: (name: string, message: string, metadata?: Record<string, unknown>) =>
    monitoring.trackEvent(name, "warning", message, metadata),

  error: (name: string, message: string, metadata?: Record<string, unknown>) =>
    monitoring.trackEvent(name, "error", message, metadata),

  critical: (name: string, message: string, metadata?: Record<string, unknown>) =>
    monitoring.trackEvent(name, "critical", message, metadata),
};

/**
 * Domain-specific monitors
 */
export const monitors = {
  // Menu extraction monitoring

    started: (venueId: string, mode: string) =>
      alerts.info("menu-extraction-started", "Menu extraction started", { venueId, mode }),

    completed: (venueId: string, itemCount: number, duration: number) =>
      alerts.info("menu-extraction-completed", "Menu extraction completed", {
        venueId,
        itemCount,
        duration,
      }),

    failed: (venueId: string, error: string) =>
      alerts.error("menu-extraction-failed", "Menu extraction failed", { venueId, error }),

    slow: (venueId: string, duration: number) =>
      alerts.warning("menu-extraction-slow", "Menu extraction took longer than expected", {
        venueId,
        duration,
        threshold: 300000, // 5 minutes
      }),
  },

  // Order monitoring

    placed: (orderId: string, venueId: string, amount: number) =>
      alerts.info("order-placed", "New order placed", { orderId, venueId, amount }),

    failed: (venueId: string, reason: string) =>
      alerts.error("order-failed", "Order submission failed", { venueId, reason }),

    paymentFailed: (orderId: string, reason: string) =>
      alerts.error("payment-failed", "Payment processing failed", { orderId, reason }),
  },

  // System health monitoring

      alerts.warning("high-memory-usage", "High memory usage detected", { usage }),

    databaseSlow: (query: string, duration: number) =>
      alerts.warning("database-slow-query", "Slow database query detected", { query, duration }),

    apiError: (endpoint: string, error: string, statusCode: number) =>
      alerts.error("api-error", `API error on ${endpoint}`, { endpoint, error, statusCode }),

    rateLimitExceeded: (identifier: string, endpoint: string) =>
      alerts.warning("rate-limit-exceeded", "Rate limit exceeded", { identifier, endpoint }),
  },

  // AI monitoring

    highCost: (operation: string, cost: number) =>
      alerts.warning("ai-high-cost", "AI operation cost is high", { operation, cost }),

    lowConfidence: (operation: string, confidence: number) =>
      alerts.warning("ai-low-confidence", "AI returned low confidence result", {
        operation,
        confidence,
      }),

    timeout: (operation: string, duration: number) =>
      alerts.error("ai-timeout", "AI operation timed out", { operation, duration }),
  },
};

/**
 * Health check function
 */
export async function performHealthCheck(): Promise<{

  checks: Record<string, boolean>;

}> {
  const checks: Record<string, boolean> = {};
  const details: string[] = [];

  // Check database connectivity
  try {
    const { createAdminClient } = await import("./supabase");
    const supabase = createAdminClient();
    const { error } = await supabase.from("venues").select("id").limit(1);
    checks.database = !error;

    if (error) {
      details.push(`Database: ${error.message}`);
    }
  } catch (error) {
    checks.database = false;
    details.push("Database: Connection failed");
  }

  // Check OpenAI API
  try {
    const { getOpenAI } = await import("./openai");
    const openai = getOpenAI();
    // Simple API check (doesn't consume credits)
    checks.openai = !!openai;
  } catch (error) {
    checks.openai = false;
    details.push("OpenAI: Configuration error");
  }

  // Determine overall status
  const allPassing = Object.values(checks).every((check) => check);
  const someFailing = Object.values(checks).some((check) => !check);

  const status = allPassing ? "healthy" : someFailing ? "degraded" : "unhealthy";

  return {
    status,
    checks,
    details,
  };
}

/**
 * Export monitoring instance
 */
export { monitoring };
