/**
 * Idempotency Utilities
 *
 * Ensures operations can be safely retried by storing idempotency keys
 * and returning cached results for duplicate requests.
 * Uses service role for atomic claim/update (RLS restricts idempotency_keys to service_role).
 */

import { createAdminClient } from "@/lib/supabase";

export interface IdempotencyRecord {
  id: string;
  idempotency_key: string;
  request_hash: string;
  response_data: unknown;
  status_code: number;
  created_at: string;
  expires_at: string;
}

/**
 * Generate idempotency key from request
 */
export function generateIdempotencyKey(
  endpoint: string,
  userId: string,
  requestData: Record<string, unknown>
): string {
  const dataString = JSON.stringify(requestData);
  const hash = Buffer.from(`${endpoint}:${userId}:${dataString}`).toString("base64");
  return `${endpoint}:${hash.substring(0, 32)}`;
}

/**
 * Check if idempotency key exists and return cached response.
 * Atomic: uses single SELECT.
 */
export async function checkIdempotency(
  idempotencyKey: string
): Promise<{ exists: true; response: IdempotencyRecord } | { exists: false }> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("idempotency_keys")
      .select(
        "id, idempotency_key, request_hash, response_data, status_code, created_at, expires_at"
      )
      .eq("idempotency_key", idempotencyKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) return { exists: false };
    if (data) return { exists: true, response: data as IdempotencyRecord };
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

/**
 * Atomically claim an idempotency key via RPC. Returns true if we won the race (caller must run
 * operation and then updateIdempotencyResult). Returns false if key already exists (caller
 * should return cached response).
 */
export async function tryClaimIdempotencyKey(
  idempotencyKey: string,
  requestHash: string,
  ttlSeconds: number = 3600
): Promise<{ claimed: true } | { claimed: false; response: IdempotencyRecord }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("claim_idempotency_key", {
    p_key: idempotencyKey,
    p_request_hash: requestHash,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    // RPC may not exist if migration hasn't run - fall back to insert
    const { data: insertData, error: insertError } = await supabase
      .from("idempotency_keys")
      .insert({
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        response_data: {},
        status_code: 0,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (insertError?.code === "23505") {
      const existing = await checkIdempotency(idempotencyKey);
      if (existing.exists) return { claimed: false, response: existing.response };
      return { claimed: true };
    }
    return { claimed: true };
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    const existing = await checkIdempotency(idempotencyKey);
    if (existing.exists) return { claimed: false, response: existing.response };
    return { claimed: true };
  }
  return { claimed: true };
}

/**
 * Update a claimed idempotency key with the response. Use after tryClaimIdempotencyKey when claimed.
 */
export async function updateIdempotencyResult(
  idempotencyKey: string,
  responseData: unknown,
  statusCode: number
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("update_idempotency_result", {
      p_key: idempotencyKey,
      p_response_data: responseData as object,
      p_status_code: statusCode,
    });
    if (error) {
      const { error: updateError } = await supabase
        .from("idempotency_keys")
        .update({ response_data: responseData as object, status_code: statusCode })
        .eq("idempotency_key", idempotencyKey)
        .eq("status_code", 0);
      if (updateError) {
        const { logger } = await import("@/lib/monitoring/structured-logger");
        logger.warn("idempotency_update_failed", { idempotencyKey, error: updateError.message });
      }
    }
  } catch (err) {
    const { logger } = await import("@/lib/monitoring/structured-logger");
    logger.warn("idempotency_update_error", {
      idempotencyKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Store idempotency key with response
 */
export async function storeIdempotency(
  idempotencyKey: string,
  requestHash: string,
  responseData: unknown,
  statusCode: number,
  ttlSeconds: number = 3600 // 1 hour default
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const { error } = await supabase.from("idempotency_keys").insert({
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      response_data: responseData,
      status_code: statusCode,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      // If it's a unique constraint violation, that's okay - key already exists
      if (error.code === "23505") {
        return;
      }

      throw error;
    }
  } catch (error) {
    const { logger } = await import("@/lib/monitoring/structured-logger");
    logger.warn("idempotency_storage_failed", {
      idempotencyKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Wrapper for idempotent operations
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  requestHash: string,
  operation: () => Promise<{ data: T; statusCode: number }>,
  ttlSeconds?: number
): Promise<{ data: T; statusCode: number; cached: boolean }> {
  // Check if key exists
  const existing = await checkIdempotency(idempotencyKey);

  if (existing.exists) {
    return {
      data: existing.response.response_data as T,
      statusCode: existing.response.status_code,
      cached: true,
    };
  }

  // Execute operation
  const result = await operation();

  // Store result
  await storeIdempotency(idempotencyKey, requestHash, result.data, result.statusCode, ttlSeconds);

  return {
    ...result,
    cached: false,
  };
}
