/**
 * Idempotency Utilities
 *
 * Ensures operations can be safely retried by storing idempotency keys
 * and returning cached results for duplicate requests.
 */

import { createServerSupabase } from "@/lib/supabase";

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
 * Check if idempotency key exists and return cached response
 */
export async function checkIdempotency(
  idempotencyKey: string
): Promise<{ exists: true; response: IdempotencyRecord } | { exists: false }> {
  try {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from("idempotency_keys")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found - this is expected
        return { exists: false };
      }

      return { exists: false };
    }

    if (data) {

      return { exists: true, response: data as IdempotencyRecord };
    }

    return { exists: false };
  } catch (error) {

    return { exists: false };
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
    const supabase = await createServerSupabase();
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
    // Don't fail the request if idempotency storage fails

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

