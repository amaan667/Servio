# Webhook Retry Logic with Exponential Backoff

This document describes the implementation of webhook retry logic with exponential backoff for Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Configuration](#configuration)
4. [Implementation](#implementation)
5. [Monitoring](#monitoring)
6. [Best Practices](#best-practices)

## Overview

Webhook retry logic with exponential backoff ensures reliable delivery of webhooks even when endpoints are temporarily unavailable:

- **Reliable Delivery:** Ensure webhooks are delivered reliably
- **Exponential Backoff:** Reduce load on failing endpoints
- **Configurable:** Configure retry behavior per webhook
- **Monitoring:** Monitor webhook delivery status

## Features

### Configuration

```typescript
// lib/webhooks/config.ts
export interface WebhookConfig {
  url: string;
  secret?: string;
  retryConfig: RetryConfig;
  headers?: Record<string, string>;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelay: 1000, // 1 second
  maxDelay: 60000, // 1 minute
  backoffMultiplier: 2,
  jitter: true,
};

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.updated',
  'order.deleted',
  'table.updated',
  'inventory.low',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
```

### Webhook Service

```typescript
// lib/webhooks/WebhookService.ts
import { WebhookConfig, RetryConfig, WebhookEvent } from './config';

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  data: any;
  timestamp: string;
  signature?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  error?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

export class WebhookService {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();

  registerWebhook(id: string, config: WebhookConfig): void {
    this.webhooks.set(id, config);
    console.log(`Webhook registered: ${id}`);
  }

  unregisterWebhook(id: string): void {
    this.webhooks.delete(id);
    console.log(`Webhook unregistered: ${id}`);
  }

  async deliver(event: WebhookEvent, data: any): Promise<void> {
    const payload: WebhookPayload = {
      id: this.generateId(),
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    // Deliver to all registered webhooks
    for (const [webhookId, webhook] of this.webhooks) {
      await this.deliverToWebhook(webhookId, webhook, payload);
    }
  }

  private async deliverToWebhook(
    webhookId: string,
    webhook: WebhookConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      id: this.generateId(),
      webhookId,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    };

    this.deliveries.set(delivery.id, delivery);

    // Add signature if secret is provided
    if (webhook.secret) {
      payload.signature = this.generateSignature(payload, webhook.secret);
    }

    // Deliver with retry logic
    await this.deliverWithRetry(webhook, delivery);
  }

  private async deliverWithRetry(
    webhook: WebhookConfig,
    delivery: WebhookDelivery
  ): Promise<void> {
    const { retryConfig } = webhook;
    let delay = retryConfig.initialDelay;

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      delivery.attempts = attempt;
      delivery.lastAttemptAt = new Date();

      try {
        // Deliver webhook
        await this.sendWebhook(webhook, delivery.payload);

        // Update delivery status
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();

        console.log(`Webhook delivered: ${delivery.id} (attempt ${attempt})`);

        return;
      } catch (error) {
        console.error(`Webhook delivery failed: ${delivery.id} (attempt ${attempt})`, error);

        delivery.error = error.message;

        // Check if this was the last attempt
        if (attempt === retryConfig.maxRetries) {
          delivery.status = 'failed';
          console.error(`Webhook delivery failed permanently: ${delivery.id}`);
          return;
        }

        // Calculate next delay with exponential backoff
        delay = this.calculateDelay(delay, retryConfig);

        // Add jitter if enabled
        if (retryConfig.jitter) {
          delay = this.addJitter(delay);
        }

        // Schedule next attempt
        delivery.nextAttemptAt = new Date(Date.now() + delay);

        console.log(`Retrying webhook: ${delivery.id} in ${delay}ms`);

        // Wait before retry
        await this.sleep(delay);
      }
    }
  }

  private async sendWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-ID': payload.id,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-Signature': payload.signature || '',
        ...webhook.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }
  }

  private calculateDelay(currentDelay: number, config: RetryConfig): number {
    const newDelay = currentDelay * config.backoffMultiplier;
    return Math.min(newDelay, config.maxDelay);
  }

  private addJitter(delay: number): number {
    const jitter = delay * 0.1; // 10% jitter
    const randomJitter = Math.random() * jitter * 2 - jitter;
    return Math.max(0, delay + randomJitter);
  }

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDelivery(id: string): WebhookDelivery | undefined {
    return this.deliveries.get(id);
  }

  getDeliveries(webhookId?: string): WebhookDelivery[] {
    const deliveries = Array.from(this.deliveries.values());

    if (webhookId) {
      return deliveries.filter(d => d.webhookId === webhookId);
    }

    return deliveries;
  }
}

// Singleton instance
let webhookService: WebhookService | null = null;

export function getWebhookService(): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService();
  }

  return webhookService;
}
```

## Implementation

### Webhook Middleware

```typescript
// lib/webhooks/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getWebhookService } from './WebhookService';

export async function handleWebhookEvent(event: string, data: any): Promise<void> {
  const webhookService = getWebhookService();

  // Validate event
  if (!isValidWebhookEvent(event)) {
    console.error(`Invalid webhook event: ${event}`);
    return;
  }

  // Deliver webhook
  await webhookService.deliver(event as any, data);
}

function isValidWebhookEvent(event: string): boolean {
  const validEvents = ['order.created', 'order.updated', 'order.deleted', 'table.updated', 'inventory.low'];
  return validEvents.includes(event);
}

export function webhookEventHandler(event: string) {
  return async (data: any) => {
    await handleWebhookEvent(event, data);
  };
}
```

### Webhook Registration

```typescript
// lib/webhooks/registry.ts
import { getWebhookService } from './WebhookService';
import { WebhookConfig } from './config';

export function registerWebhooks(): void {
  const webhookService = getWebhookService();

  // Register webhooks from environment variables
  const webhookUrls = process.env.WEBHOOK_URLS?.split(',') || [];

  webhookUrls.forEach((url, index) => {
    const webhookId = `webhook-${index}`;

    const config: WebhookConfig = {
      url: url.trim(),
      secret: process.env[`WEBHOOK_${index}_SECRET`],
      retryConfig: {
        maxRetries: parseInt(process.env[`WEBHOOK_${index}_MAX_RETRIES`] || '5'),
        initialDelay: parseInt(process.env[`WEBHOOK_${index}_INITIAL_DELAY`] || '1000'),
        maxDelay: parseInt(process.env[`WEBHOOK_${index}_MAX_DELAY`] || '60000'),
        backoffMultiplier: parseFloat(process.env[`WEBHOOK_${index}_BACKOFF_MULTIPLIER`] || '2'),
        jitter: process.env[`WEBHOOK_${index}_JITTER`] !== 'false',
      },
      headers: {
        'User-Agent': 'Servio-Webhook/1.0',
      },
    };

    webhookService.registerWebhook(webhookId, config);
  });

  console.log(`Registered ${webhookUrls.length} webhooks`);
}
```

## Monitoring

### Webhook Metrics

```typescript
// lib/webhooks/metrics.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export class WebhookMetrics {
  async recordDelivery(webhookId: string, success: boolean, attempts: number): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'Servio/Webhooks',
      MetricData: [
        {
          MetricName: 'WebhookDelivery',
          Dimensions: [
            {
              Name: 'WebhookId',
              Value: webhookId,
            },
            {
              Name: 'Status',
              Value: success ? 'Success' : 'Failure',
            },
          ],
          Value: 1,
          Unit: 'Count',
        },
        {
          MetricName: 'WebhookAttempts',
          Dimensions: [
            {
              Name: 'WebhookId',
              Value: webhookId,
            },
          ],
          Value: attempts,
          Unit: 'Count',
        },
      ],
    });

    await cloudwatch.send(command);
  }

  async recordError(webhookId: string, error: string): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'Servio/Webhooks',
      MetricData: [
        {
          MetricName: 'WebhookError',
          Dimensions: [
            {
              Name: 'WebhookId',
              Value: webhookId,
            },
            {
              Name: 'ErrorType',
              Value: error,
            },
          ],
          Value: 1,
          Unit: 'Count',
        },
      ],
    });

    await cloudwatch.send(command);
  }
}

// Singleton instance
let webhookMetrics: WebhookMetrics | null = null;

export function getWebhookMetrics(): WebhookMetrics {
  if (!webhookMetrics) {
    webhookMetrics = new WebhookMetrics();
  }

  return webhookMetrics;
}
```

## Best Practices

### 1. Use Exponential Backoff

Use exponential backoff:

```typescript
// Good: Use exponential backoff
const delay = this.calculateDelay(delay, retryConfig);

private calculateDelay(currentDelay: number, config: RetryConfig): number {
  const newDelay = currentDelay * config.backoffMultiplier;
  return Math.min(newDelay, config.maxDelay);
}

// Bad: No exponential backoff
const delay = 1000; // Fixed delay
```

### 2. Add Jitter

Add jitter to avoid thundering herd:

```typescript
// Good: Add jitter
if (retryConfig.jitter) {
  delay = this.addJitter(delay);
}

private addJitter(delay: number): number {
  const jitter = delay * 0.1; // 10% jitter
  const randomJitter = Math.random() * jitter * 2 - jitter;
  return Math.max(0, delay + randomJitter);
}

// Bad: No jitter
// No jitter
```

### 3. Set Max Retries

Set max retries to avoid infinite loops:

```typescript
// Good: Set max retries
for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
  // ...
}

// Bad: No max retries
while (true) {
  // ...
}
```

### 4. Set Max Delay

Set max delay to avoid excessive delays:

```typescript
// Good: Set max delay
private calculateDelay(currentDelay: number, config: RetryConfig): number {
  const newDelay = currentDelay * config.backoffMultiplier;
  return Math.min(newDelay, config.maxDelay);
}

// Bad: No max delay
private calculateDelay(currentDelay: number, config: RetryConfig): number {
  return currentDelay * config.backoffMultiplier;
}
```

### 5. Sign Webhooks

Sign webhooks for security:

```typescript
// Good: Sign webhooks
if (webhook.secret) {
  payload.signature = this.generateSignature(payload, webhook.secret);
}

private generateSignature(payload: WebhookPayload, secret: string): string {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

// Bad: No signature
// No signature
```

### 6. Monitor Webhook Delivery

Monitor webhook delivery:

```typescript
// Good: Monitor webhook delivery
await this.metrics.recordDelivery(webhookId, success, attempts);

// Bad: No monitoring
// No monitoring
```

### 7. Document Webhook Events

Document webhook events:

```markdown
# Good: Document webhook events
## Webhook Events

### order.created
Sent when a new order is created.

**Payload:**
```json
{
  "id": "string",
  "event": "order.created",
  "data": {
    "id": "string",
    "venueId": "string",
    "status": "pending"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

# Bad: No documentation
# No documentation
```

## References

- [Webhooks](https://webhooks.dev/)
- [Exponential Backoff](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhook-security)
- [Retry Strategies](https://cloud.google.com/architecture/retry-strategies)
