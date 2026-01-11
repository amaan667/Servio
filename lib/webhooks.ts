/**
 * Webhook Service
 * Provides webhook management, delivery, and third-party integrations
 */

import crypto from "crypto";

interface Webhook {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface WebhookEvent {
  id: string;
  webhook_id: string;
  event_type: string;
  _payload: unknown;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  last_attempt: string;
  created_at: string;
}

interface WebhookDelivery {
  webhook_id: string;
  event_type: string;
  payload: unknown;
  signature: string;
  timestamp: string;
}

class WebhookService {
  private webhooks = new Map<string, Webhook>();
  private events = new Map<string, WebhookEvent>();

  /**
   * Create new webhook
   */
  async createWebhook(data: {
    organization_id: string;
    name: string;
    url: string;
    events: string[];
  }): Promise<Webhook> {
    const webhook: Webhook = {
      id: `webhook_${Date.now()}`,
      organization_id: data.organization_id,
      name: data.name,
      url: data.url,
      events: data.events,
      secret: this.generateSecret(),
      is_active: true,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  /**
   * Send webhook event
   */
  async sendWebhook(organizationId: string, eventType: string, _payload: unknown): Promise<void> {
    const webhooks = Array.from(this.webhooks.values()).filter(
      (w) => w.organization_id === organizationId && w.is_active && w.events.includes(eventType)
    );

    for (const webhook of webhooks) {
      await this.deliverWebhook(webhook, eventType, _payload);
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    webhook: Webhook,
    eventType: string,
    _payload: unknown
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      webhook_id: webhook.id,
      event_type: eventType,
      payload: _payload,
      signature: this.generateSignature(_payload, webhook.secret),
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": delivery.signature,
          "X-Webhook-Event": eventType,
          "X-Webhook-Timestamp": delivery.timestamp,
        },
        body: JSON.stringify(delivery),
      });

      if (response.ok) {
        // Webhook delivered successfully
      } else {
        throw new Error(`Webhook delivery failed: ${response.status}`);
      }
    } catch (_error) {
      await this.logWebhookFailure(webhook.id, _error);
    }
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(_payload: unknown, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(JSON.stringify(_payload));
    return hmac.digest("hex");
  }

  /**
   * Generate webhook secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Log webhook failure
   */
  private async logWebhookFailure(webhookId: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const event: WebhookEvent = {
      id: `event_${Date.now()}`,
      webhook_id: webhookId,
      event_type: "webhook_failure",
      _payload: { error: errorMessage },
      status: "failed",
      attempts: 1,
      last_attempt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    this.events.set(event.id, event);
  }

  /**
   * Get webhook events
   */
  getWebhookEvents(webhookId: string): WebhookEvent[] {
    return Array.from(this.events.values()).filter((e) => e.webhook_id === webhookId);
  }

  /**
   * Retry failed webhook
   */
  async retryWebhook(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) return;

    const webhook = this.webhooks.get(event.webhook_id);
    if (!webhook) return;

    event.attempts++;
    event.last_attempt = new Date().toISOString();

    try {
      await this.deliverWebhook(webhook, event.event_type, event._payload);
      event.status = "delivered";
    } catch (_error) {
      event.status = "failed";
      await this.logWebhookFailure(webhook.id, _error);
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhookId: string): Promise<boolean> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return false;

    const testPayload = {
      event: "webhook.test",
      data: { message: "This is a test webhook" },
      timestamp: new Date().toISOString(),
    };

    try {
      await this.deliverWebhook(webhook, "test", testPayload);
      return true;
    } catch (_error) {
      return false;
    }
  }
}

export const webhookService = new WebhookService();
