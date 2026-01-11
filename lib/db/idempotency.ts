/**
 * Idempotency Utilities
 *
 * Ensures operations can be safely retried by storing idempotency keys
 * and returning cached results for duplicate requests.
 */

import { createServerSupabase } from "@/lib/supabase";

export interface IdempotencyRecord {

}

/**
 * Generate idempotency key from request
 */
export function generateIdempotencyKey(

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
       + "...",

      return { exists: false };
    }

    if (data) {
       + "...",

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

    const { error } = await supabase.from("idempotency_keys").insert({

    if (error) {
      // If it's a unique constraint violation, that's okay - key already exists
      if (error.code === "23505") {
        ", {
          key: idempotencyKey.substring(0, 20) + "...",

        return;
      }

       + "...",

      throw error;
    }

     + "...",

  } catch (error) {
    // Don't fail the request if idempotency storage fails
    ", {

  }
}

/**
 * Wrapper for idempotent operations
 */
export async function withIdempotency<T>(

  operation: () => Promise<{ data: T; statusCode: number }>,
  ttlSeconds?: number
): Promise<{ data: T; statusCode: number; cached: boolean }> {
  // Check if key exists
  const existing = await checkIdempotency(idempotencyKey);

  if (existing.exists) {
    return {

    };
  }

  // Execute operation
  const result = await operation();

  // Store result
  await storeIdempotency(idempotencyKey, requestHash, result.data, result.statusCode, ttlSeconds);

  return {
    ...result,

  };
}

