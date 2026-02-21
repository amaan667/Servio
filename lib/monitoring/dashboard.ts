/**
 * @fileoverview Monitoring Dashboard
 * Provides real-time metrics and alerting
 */

import { logger } from "@/lib/monitoring/structured-logger";

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

export interface Alert {
  id: string;
  name: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: number;
  resolved: boolean;
}

export interface DashboardConfig {
  refreshInterval: number;
  retentionPeriod: number;
  alertThresholds: Record<string, { warning: number; critical: number }>;
}

/**
 * Monitoring Dashboard
 * Provides real-time monitoring capabilities
 */
export class MonitoringDashboard {
  private metrics = new Map<string, Metric[]>();
  private alerts = new Map<string, Alert>();
  private config: DashboardConfig;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      refreshInterval: 60000, // 1 minute
      retentionPeriod: 3600000, // 1 hour
      alertThresholds: {
        error_rate: { warning: 5, critical: 10 },
        response_time: { warning: 500, critical: 1000 },
        cpu_usage: { warning: 70, critical: 90 },
        memory_usage: { warning: 80, critical: 95 },
      },
      ...config,
    };
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    const metric: Metric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Check alert thresholds
    this.checkAlertThresholds(name, value, tags);

    // Clean old metrics
    this.cleanOldMetrics(name);
  }

  /**
   * Get metrics for a name
   */
  getMetrics(name: string, timeRange?: number): Metric[] {
    const metrics = this.metrics.get(name) || [];

    if (!timeRange) {
      return metrics;
    }

    const now = Date.now();
    return metrics.filter((m) => now - m.timestamp <= timeRange);
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    name: string,
    timeRange?: number
  ): {
    min: number;
    max: number;
    avg: number;
    count: number;
  } | null {
    const metrics = this.getMetrics(name, timeRange);

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map((m) => m.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    return { min, max, avg, count: values.length };
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(name: string, value: number, tags: Record<string, string>): void {
    const threshold = this.config.alertThresholds[name];

    if (!threshold) {
      return;
    }

    if (value >= threshold.critical) {
      this.createAlert(
        name,
        "critical",
        `Value ${value} exceeds critical threshold ${threshold.critical}`,
        tags
      );
    } else if (value >= threshold.warning) {
      this.createAlert(
        name,
        "warning",
        `Value ${value} exceeds warning threshold ${threshold.warning}`,
        tags
      );
    }
  }

  /**
   * Create an alert
   */
  createAlert(
    name: string,
    severity: "info" | "warning" | "error" | "critical",
    message: string,
    _tags: Record<string, string> = {}
  ): Alert {
    const alert: Alert = {
      id: this.generateId(),
      name,
      severity,
      message,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.set(alert.id, alert);

    logger.warn("Alert created", { alertId: alert.id, name, severity, message });

    // Send notification (placeholder)
    this.sendNotification(alert);

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);

    if (!alert) {
      return false;
    }

    alert.resolved = true;

    logger.info("Alert resolved", { alertId });

    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Clean old metrics
   */
  private cleanOldMetrics(name: string): void {
    const metrics = this.metrics.get(name);

    if (!metrics) {
      return;
    }

    const now = Date.now();
    const filtered = metrics.filter((m) => now - m.timestamp <= this.config.retentionPeriod);

    this.metrics.set(name, filtered);
  }

  /**
   * Send notification (placeholder)
   */
  private sendNotification(alert: Alert): void {
    // Placeholder for notification implementation
    // Could send to Slack, PagerDuty, email, etc.

    if (alert.severity === "critical") {
      // Send critical alerts immediately
      logger.error("Critical alert notification", { alertId: alert.id, message: alert.message });
    }
  }

  /**
   * Start automatic refresh
   */
  startRefresh(): void {
    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.config.refreshInterval);

    logger.info("Monitoring dashboard refresh started");
  }

  /**
   * Stop automatic refresh
   */
  stopRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      logger.info("Monitoring dashboard refresh stopped");
    }
  }

  /**
   * Refresh dashboard
   */
  private refresh(): void {
    // Clean old metrics
    for (const name of this.metrics.keys()) {
      this.cleanOldMetrics(name);
    }

    // Clean old alerts
    const now = Date.now();
    const oldAlerts = Array.from(this.alerts.entries()).filter(
      ([_, alert]) => now - alert.timestamp > this.config.retentionPeriod
    );

    for (const [alertId] of oldAlerts) {
      this.alerts.delete(alertId);
    }
  }

  /**
   * Get dashboard summary
   */
  getSummary(): {
    totalMetrics: number;
    totalAlerts: number;
    activeAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
  } {
    const totalMetrics = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.length, 0);
    const totalAlerts = this.alerts.size;
    const activeAlerts = this.getActiveAlerts().length;
    const criticalAlerts = this.getActiveAlerts().filter((a) => a.severity === "critical").length;
    const warningAlerts = this.getActiveAlerts().filter((a) => a.severity === "warning").length;

    return {
      totalMetrics,
      totalAlerts,
      activeAlerts,
      criticalAlerts,
      warningAlerts,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    metrics: Record<string, Metric[]>;
    alerts: Alert[];
    summary: ReturnType<MonitoringDashboard["getSummary"]>;
  } {
    const metrics: Record<string, Metric[]> = {};

    for (const [name, data] of this.metrics.entries()) {
      metrics[name] = data;
    }

    return {
      metrics,
      alerts: this.getAllAlerts(),
      summary: this.getSummary(),
    };
  }
}

// Export singleton instance
export const monitoringDashboard = new MonitoringDashboard();

// Auto-start refresh on module load
if (typeof window === "undefined") {
  monitoringDashboard.startRefresh();
}
