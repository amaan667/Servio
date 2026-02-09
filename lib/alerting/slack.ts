/**
 * Slack Alerting Integration
 *
 * Sends structured alerts to a Slack webhook.
 * Set SLACK_ALERT_WEBHOOK_URL in env to enable.
 * Falls back to structured logging when webhook is not configured.
 */

import { env } from "@/lib/env";

export type AlertSeverity = "critical" | "warning" | "info" | "resolved";

interface AlertPayload {
  title: string;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, string | number | boolean>;
  timestamp?: string;
}

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: ":rotating_light:",
  warning: ":warning:",
  info: ":information_source:",
  resolved: ":white_check_mark:",
};

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",
  resolved: "#22c55e",
};

/**
 * Send an alert to the configured Slack webhook.
 * Non-blocking: errors are swallowed so alerting never crashes the app.
 */
export async function sendAlert(payload: AlertPayload): Promise<boolean> {
  const webhookUrl = env("SLACK_ALERT_WEBHOOK_URL");
  const ts = payload.timestamp || new Date().toISOString();

  // Always log the alert for Railway stdout capture
  const logLine = `[ALERT:${payload.severity.toUpperCase()}] ${payload.title}: ${payload.message}`;
  if (payload.severity === "critical") {
    process.stderr.write(logLine + "\n");
  } else {
    process.stdout.write(logLine + "\n");
  }

  if (!webhookUrl) {
    return false; // No webhook configured
  }

  try {
    const detailFields = Object.entries(payload.details || {}).map(([key, value]) => ({
      type: "mrkdwn" as const,
      text: `*${key}:* ${String(value)}`,
    }));

    const slackPayload = {
      text: `${SEVERITY_EMOJI[payload.severity]} ${payload.title}`,
      attachments: [
        {
          color: SEVERITY_COLOR[payload.severity],
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: payload.message },
            },
            ...(detailFields.length > 0
              ? [
                  {
                    type: "section",
                    fields: detailFields.slice(0, 10), // Slack limit
                  },
                ]
              : []),
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Servio | ${process.env.NODE_ENV || "development"} | ${ts}`,
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    return response.ok;
  } catch {
    // Alerting must never crash the application
    return false;
  }
}

// ─── Convenience alert functions ────────────────────────────────────

export async function alertCritical(title: string, message: string, details?: Record<string, string | number | boolean>) {
  return sendAlert({ title, severity: "critical", message, details });
}

export async function alertWarning(title: string, message: string, details?: Record<string, string | number | boolean>) {
  return sendAlert({ title, severity: "warning", message, details });
}

export async function alertResolved(title: string, message: string, details?: Record<string, string | number | boolean>) {
  return sendAlert({ title, severity: "resolved", message, details });
}
