import Stripe from 'stripe';

// ============================================================================
// STRIPE WEBHOOK SIGNATURE VERIFICATION
// Critical for preventing webhook replay attacks and forged events
// ============================================================================

// Maximum age of a webhook timestamp to prevent replay attacks
const MAX_TIMESTAMP_AGE_SECONDS = 300; // 5 minutes

export interface VerifiedWebhookEvent {
  event: Stripe.Event;
  tenantId: string | null;
  venueId: string | null;
}

export class WebhookError extends Error {
  code: string;
  timestamp: number;
  isRetryable: boolean;

  constructor(message: string, code: string, isRetryable = false) {
    super(message);
    this.name = 'WebhookError';
    this.code = code;
    this.timestamp = Date.now();
    this.isRetryable = isRetryable;
  }
}

/**
 * Verify Stripe webhook signature with timestamp validation
 * This prevents replay attacks and ensures the webhook came from Stripe
 */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
  options?: {
    timestampTolerance?: number;
    tenantId?: string;
    venueId?: string;
  }
): VerifiedWebhookEvent {
  if (!signature) {
    throw new WebhookError('Missing stripe-signature header', 'SIGNATURE_MISSING');
  }

  // Parse the signature header
  const elements = signature.split(',');
  const signatureMap: Record<string, string> = {};
  
  for (const element of elements) {
    const [key, value] = element.split('=');
    if (key && value) {
      signatureMap[key] = value;
    }
  }

  const timestamp = signatureMap['t'];
  const expectedSignature = signatureMap['v1'];

  if (!timestamp || !expectedSignature) {
    throw new WebhookError(
      'Invalid stripe-signature format',
      'SIGNATURE_INVALID_FORMAT'
    );
  }

  // Validate timestamp to prevent replay attacks
  const timestampAgeSeconds = Math.floor(
    (Date.now() / 1000) - parseInt(timestamp, 10)
  );
  
  const tolerance = options?.timestampTolerance ?? MAX_TIMESTAMP_AGE_SECONDS;
  
  if (timestampAgeSeconds > tolerance) {
    throw new WebhookError(
      `Webhook timestamp is too old (${timestampAgeSeconds}s > ${tolerance}s). Possible replay attack.`,
      'SIGNATURE_TIMESTAMP_EXPIRED'
    );
  }

  if (timestampAgeSeconds < -60) {
    throw new WebhookError(
      'Webhook timestamp is in the future',
      'SIGNATURE_TIMESTAMP_FUTURE'
    );
  }

  // Construct the signed payload
  const signedPayload = `${timestamp}.${payload}`;

  // Verify the signature using HMAC SHA-256
  const crypto = require('crypto');
  const computedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(expectedSignature, 'hex');
  const computedBuffer = Buffer.from(computedSignature, 'hex');

  if (signatureBuffer.length !== computedBuffer.length) {
    throw new WebhookError(
      'Signature length mismatch',
      'SIGNATURE_INVALID'
    );
  }

  const signatureMatches = crypto.timingSafeEqual(signatureBuffer, computedBuffer);

  if (!signatureMatches) {
    throw new WebhookError(
      'Signature verification failed',
      'SIGNATURE_INVALID'
    );
  }

  // Parse the event
  let event: Stripe.Event;
  try {
    event = JSON.parse(payload.toString()) as Stripe.Event;
  } catch {
    throw new WebhookError(
      'Invalid JSON in webhook payload',
      'PAYLOAD_INVALID_JSON'
    );
  }

  // Validate tenant and venue isolation if provided
  const eventData = event.data.object as unknown as Record<string, unknown>;
  
  if (options?.tenantId && (eventData.tenant_id as string) !== options.tenantId) {
    throw new WebhookError(
      'Tenant ID mismatch - possible cross-tenant data access',
      'TENANT_ISOLATION_VIOLATION'
    );
  }

  if (options?.venueId && (eventData.venue_id as string) !== options.venueId) {
    throw new WebhookError(
      'Venue ID mismatch - possible cross-venue data access',
      'VENUE_ISOLATION_VIOLATION'
    );
  }

  return {
    event,
    tenantId: (eventData.tenant_id as string) ?? null,
    venueId: (eventData.venue_id as string) ?? null,
  };
}

/**
 * Verify webhook using Stripe's official library (recommended for production)
 */
export function verifyStripeWebhookWithLibrary(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
  options?: {
    tenantId?: string;
    venueId?: string;
  }
): VerifiedWebhookEvent {
  let event: Stripe.Event;

  try {
    event = Stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (err) {
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      throw new WebhookError(
        `Stripe signature verification failed: ${err.message}`,
        'SIGNATURE_INVALID'
      );
    }
    throw err;
  }

  // Validate tenant and venue isolation
  const eventData = event.data.object as unknown as Record<string, unknown>;
  
  if (options?.tenantId && (eventData.tenant_id as string) !== options.tenantId) {
    throw new WebhookError(
      'Tenant ID mismatch',
      'TENANT_ISOLATION_VIOLATION'
    );
  }

  if (options?.venueId && (eventData.venue_id as string) !== options.venueId) {
    throw new WebhookError(
      'Venue ID mismatch',
      'VENUE_ISOLATION_VIOLATION'
    );
  }

  return {
    event,
    tenantId: (eventData.tenant_id as string) ?? null,
    venueId: (eventData.venue_id as string) ?? null,
  };
}

// ============================================================================
// WEBHOOK EVENT TYPE GUARDS
// ============================================================================

export type StripeEventType = 
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'charge.refunded'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed';

export interface PaymentIntentSucceeded {
  id: string;
  amount: number;
  currency: string;
  metadata: {
    tenant_id: string;
    venue_id: string;
    order_id: string;
  };
}

export function isPaymentIntentSucceeded(event: Stripe.Event): event is Stripe.Event {
  return event.type === 'payment_intent.succeeded';
}

export interface ChargeRefunded {
  id: string;
  amount_refunded: number;
  metadata: {
    tenant_id: string;
    venue_id: string;
  };
}

export function isChargeRefunded(event: Stripe.Event): event is Stripe.Event {
  return event.type === 'charge.refunded';
}

// ============================================================================
// WEBHOOK PROCESSING WITH IDEMPOTENCY
// ============================================================================

import { getIdempotencyResult, storeIdempotencyResult } from './idempotency';

/**
 * Process a webhook event with idempotency protection
 */
export async function processWebhookWithIdempotency<T>(
  eventId: string,
  tenantId: string,
  handler: () => Promise<T>
): Promise<{ result: T; wasIdempotent: boolean }> {
  const key = `webhook:${tenantId}:${eventId}`;
  const cached = getIdempotencyResult(key);

  if (cached) {
    if (cached.success && cached.data) {
      return { result: cached.data as T, wasIdempotent: true };
    }
    throw new WebhookError(
      cached.error ?? 'Previous webhook processing failed',
      'WEBHOOK_ALREADY_PROCESSED',
      false
    );
  }

  try {
    const result = await handler();

    storeIdempotencyResult(key, tenantId, 'webhook_processing', {
      success: true,
      data: result,
    });

    return { result, wasIdempotent: false };
  } catch (error) {
    storeIdempotencyResult(key, tenantId, 'webhook_processing', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================================================
// SECURITY EVENT LOGGING
// ============================================================================

export function logWebhookSecurityEvent(
  type: 'verification_success' | 'verification_failure' | 'tenant_violation',
  details: {
    eventId?: string;
    eventType?: string;
    tenantId?: string;
    venueId?: string;
    errorCode?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): void {
  const logEntry = {
    type: `webhook_security_${type}`,
    timestamp: new Date().toISOString(),
    service: 'webhook-verification',
    severity: type === 'verification_failure' || type === 'tenant_violation' ? 'HIGH' : 'INFO',
    details: {
      ...details,
      hasPayload: details.eventId !== undefined,
    },
  };

  if (typeof console !== 'undefined') {
    console.log(JSON.stringify(logEntry));
  }
}
