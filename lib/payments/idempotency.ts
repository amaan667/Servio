import { createClient } from '@supabase/supabase-js';

// ============================================================================
// IDEMPOTENCY KEY GENERATION & VALIDATION
// Critical for preventing duplicate charges in payment flows
// ============================================================================

export interface IdempotencyKey {
  key: string;
  tenantId: string;
  operation: string;
  createdAt: Date;
  expiresAt: Date;
  result?: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

// In-memory store with TTL (replace with Redis in production)
const idempotencyStore = new Map<string, IdempotencyKey>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a cryptographically secure idempotency key
 */
export function generateIdempotencyKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a namespaced idempotency key for multi-tenant safety
 */
export function createNamespacedKey(
  tenantId: string,
  operation: string,
  ...scope: string[]
): string {
  const scopeStr = scope.join(':');
  return `idem:${tenantId}:${operation}:${scopeStr}`;
}

/**
 * Check if an idempotency key is valid and not expired
 */
export function isValidIdempotencyKey(key: string): boolean {
  const entry = idempotencyStore.get(key);
  if (!entry) return false;
  if (new Date() > entry.expiresAt) {
    idempotencyStore.delete(key);
    return false;
  }
  return true;
}

/**
 * Store an idempotency key with its result
 */
export function storeIdempotencyResult(
  key: string,
  tenantId: string,
  operation: string,
  result: { success: boolean; data?: unknown; error?: string }
): void {
  const entry: IdempotencyKey = {
    key,
    tenantId,
    operation,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
    result,
  };
  idempotencyStore.set(key, entry);
  
  // Clean up expired entries periodically
  if (idempotencyStore.size > 10000) {
    cleanupExpiredKeys();
  }
}

/**
 * Get a cached result for an idempotency key
 */
export function getIdempotencyResult(key: string): { success: boolean; data?: unknown; error?: string } | null {
  const entry = idempotencyStore.get(key);
  if (!entry) return null;
  if (new Date() > entry.expiresAt) {
    idempotencyStore.delete(key);
    return null;
  }
  return entry.result ?? null;
}

/**
 * Clean up expired idempotency keys
 */
function cleanupExpiredKeys(): void {
  const now = new Date();
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now > entry.expiresAt) {
      idempotencyStore.delete(key);
    }
  }
}

// ============================================================================
// STRIPE IDEMPOTENCY INTEGRATION
// ============================================================================

export interface StripePaymentIntentParams {
  amount: number;
  currency: string;
  tenantId: string;
  venueId: string;
  orderId: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

/**
 * Create idempotent Stripe payment intent
 */
export async function createIdempotentPaymentIntent(
  stripeClient: import('stripe').Stripe,
  params: StripePaymentIntentParams
): Promise<{
  clientSecret: string;
  paymentIntentId: string;
  idempotencyKey: string;
}> {
  const idempotencyKey = createNamespacedKey(
    params.tenantId,
    'create_payment_intent',
    params.venueId,
    params.orderId
  );

  // Check for existing result
  const cached = getIdempotencyResult(idempotencyKey);
  if (cached) {
    if (cached.success && cached.data) {
      const data = cached.data as { clientSecret: string; paymentIntentId: string };
      return { ...data, idempotencyKey };
    }
    throw new Error(cached.error ?? 'Previous attempt failed');
  }

  try {
    const paymentIntent = await stripeClient.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency,
        metadata: {
          tenant_id: params.tenantId,
          venue_id: params.venueId,
          order_id: params.orderId,
          idempotency_key: idempotencyKey,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        idempotencyKey,
      }
    );

    const result = {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };

    storeIdempotencyResult(idempotencyKey, params.tenantId, 'create_payment_intent', {
      success: true,
      data: result,
    });

    return { ...result, idempotencyKey };
  } catch (error) {
    storeIdempotencyResult(idempotencyKey, params.tenantId, 'create_payment_intent', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Verify and process idempotent refund
 */
export async function createIdempotentRefund(
  stripeClient: import('stripe').Stripe,
  paymentIntentId: string,
  amount?: number,
  tenantId?: string
): Promise<{
  refundId: string;
  amount: number;
  status: string;
}> {
  const idempotencyKey = `idem:${tenantId ?? 'unknown'}:refund:${paymentIntentId}:${amount ?? 'full'}`;

  const cached = getIdempotencyResult(idempotencyKey);
  if (cached) {
    if (cached.success && cached.data) {
      return cached.data as { refundId: string; amount: number; status: string };
    }
    throw new Error(cached.error ?? 'Previous refund attempt failed');
  }

  try {
    const refund = await stripeClient.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount,
      },
      { idempotencyKey }
    );

    const result = {
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status ?? 'pending',
    };

    storeIdempotencyResult(idempotencyKey, tenantId ?? 'unknown', 'refund', {
      success: true,
      data: result,
    });

    return result;
  } catch (error) {
    storeIdempotencyResult(idempotencyKey, tenantId ?? 'unknown', 'refund', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================================================
// SUPABASE INTEGRATION FOR PERSISTENT IDEMPOTENCY
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const IDEMPOTENCY_TABLE = 'idempotency_keys';

/**
 * Initialize idempotency table (run migration)
 */
export async function initializeIdempotencyTable(): Promise<void> {
  const { error } = await supabase.rpc('execute_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS ${IDEMPOTENCY_TABLE} (
        key VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        operation VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        result_success BOOLEAN,
        result_data JSONB,
        result_error TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_${IDEMPOTENCY_TABLE.replace(/[^a-z0-9]/gi, '_')}_tenant_op 
      ON ${IDEMPOTENCY_TABLE}(tenant_id, operation);
      
      CREATE INDEX IF NOT EXISTS idx_${IDEMPOTENCY_TABLE.replace(/[^a-z0-9]/gi, '_')}_expires 
      ON ${IDEMPOTENCY_TABLE}(expires_at);
    `,
  });

  if (error) {
    throw new Error(`Failed to initialize idempotency table: ${error.message}`);
  }
}

/**
 * Store idempotency result in database (production use)
 */
export async function storeIdempotencyResultDb(
  key: string,
  tenantId: string,
  operation: string,
  result: { success: boolean; data?: unknown; error?: string }
): Promise<void> {
  const { error } = await supabase.from(IDEMPOTENCY_TABLE).upsert(
    {
      key,
      tenant_id: tenantId,
      operation,
      expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
      result_success: result.success,
      result_data: result.data,
      result_error: result.error,
    },
    { onConflict: 'key' }
  );

  if (error) {
    throw new Error(`Failed to store idempotency result: ${error.message}`);
  }
}

/**
 * Get idempotency result from database (production use)
 */
export async function getIdempotencyResultDb(
  key: string
): Promise<{ success: boolean; data?: unknown; error?: string } | null> {
  const { data, error } = await supabase
    .from(IDEMPOTENCY_TABLE)
    .select('result_success, result_data, result_error, expires_at')
    .eq('key', key)
    .single();

  if (error || !data) return null;

  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  return {
    success: data.result_success,
    data: data.result_data,
    error: data.result_error,
  };
}

/**
 * Cleanup expired idempotency keys (run as scheduled job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  // First get count of keys to be deleted
  const { count, error: countError } = await supabase
    .from(IDEMPOTENCY_TABLE)
    .select('key', { count: 'exact', head: true })
    .lt('expires_at', new Date().toISOString());

  if (countError) {
    throw new Error(`Failed to count expired idempotency keys: ${countError.message}`);
  }

  // Then delete them
  const { error: deleteError } = await supabase
    .from(IDEMPOTENCY_TABLE)
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (deleteError) {
    throw new Error(`Failed to cleanup expired idempotency keys: ${deleteError.message}`);
  }

  return count ?? 0;
}
