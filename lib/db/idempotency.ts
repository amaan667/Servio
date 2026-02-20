/**
 * Idempotency Utilities
 *
 * Ensures operations can be safely retried by storing idempotency keys
 * and returning cached results for duplicate requests.
 */

import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/monitoring/structured-logger";

export interface IdempotencyRecord {
  id: string;
  idempotency_key: string;
  request_hash: string;
  response_data: unknown;
  status_code: number;
  created_at: string;
  expires_at: string;
}

export type IdempotencyClaimResult =
  | { status: "acquired" }
  | { status: "cached"; response: IdempotencyRecord }
  | { status: "in_progress" }
  | { status: "hash_mismatch"; response: IdempotencyRecord };

const IN_PROGRESS_STATUS_CODE = 102;
const IN_PROGRESS_RESPONSE = { __idempotency_status: "in_progress" } as const;

function isRecordExpired(record: IdempotencyRecord): boolean {
  return new Date(record.expires_at).getTime() <= Date.now();
}

function isRecordInProgress(record: IdempotencyRecord): boolean {
  if (record.status_code === IN_PROGRESS_STATUS_CODE) return true;

  if (!record.response_data || typeof record.response_data !== "object") {
    return false;
  }

  const response = record.response_data as Record<string, unknown>;
  return response.__idempotency_status === "in_progress";
}

async function getIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("idempotency_keys")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (error || !data) {
      return null;
    }

    return data as IdempotencyRecord;
  } catch (error) {
    logger.error("[idempotency] getIdempotencyRecord failed", {
      idempotencyKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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
 * Atomically claim an idempotency key.
 *
 * - First request inserts an in-progress placeholder and receives "acquired"
 * - Concurrent requests return "in_progress"
 * - Completed prior requests return "cached"
 */
export async function claimIdempotencyKey(
  idempotencyKey: string,
  requestHash: string,
  ttlSeconds: number = 3600,
  attempt: number = 0
): Promise<IdempotencyClaimResult> {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const { error: insertError } = await supabase.from("idempotency_keys").insert({
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      response_data: IN_PROGRESS_RESPONSE,
      status_code: IN_PROGRESS_STATUS_CODE,
      expires_at: expiresAt,
    });

    if (!insertError) {
      return { status: "acquired" };
    }

    if (insertError.code !== "23505") {
      logger.error("[idempotency] claim insert failed", {
        idempotencyKey,
        error: insertError.message,
        code: insertError.code,
      });
      return { status: "in_progress" };
    }

    const existing = await getIdempotencyRecord(idempotencyKey);
    if (!existing) {
      return { status: "in_progress" };
    }

    if (isRecordExpired(existing) && attempt < 1) {
      await supabase
        .from("idempotency_keys")
        .delete()
        .eq("idempotency_key", idempotencyKey)
        .lt("expires_at", now.toISOString());

      return claimIdempotencyKey(idempotencyKey, requestHash, ttlSeconds, attempt + 1);
    }

    if (existing.request_hash !== requestHash) {
      return { status: "hash_mismatch", response: existing };
    }

    if (isRecordInProgress(existing)) {
      return { status: "in_progress" };
    }

    return { status: "cached", response: existing };
  } catch (error) {
    logger.error("[idempotency] claimIdempotencyKey failed", {
      idempotencyKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "in_progress" };
  }
}

/**
 * Check if idempotency key exists and return cached response.
 * In-progress placeholders are treated as non-existent for legacy callers.
 */
export async function checkIdempotency(
  idempotencyKey: string
): Promise<{ exists: true; response: IdempotencyRecord } | { exists: false }> {
  const record = await getIdempotencyRecord(idempotencyKey);

  if (!record || isRecordExpired(record) || isRecordInProgress(record)) {
    return { exists: false };
  }

  return { exists: true, response: record };
}

/**
 * Store idempotency key with response.
 * Updates an existing in-progress claim when present, otherwise inserts a new row.
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
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const { data: updatedRows, error: updateError } = await supabase
      .from("idempotency_keys")
      .update({
        request_hash: requestHash,
        response_data: responseData,
        status_code: statusCode,
        expires_at: expiresAt,
      })
      .eq("idempotency_key", idempotencyKey)
      .select("id");

    if (updateError) {
      throw updateError;
    }

    if (updatedRows && updatedRows.length > 0) {
      return;
    }

    const { error: insertError } = await supabase.from("idempotency_keys").insert({
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      response_data: responseData,
      status_code: statusCode,
      expires_at: expiresAt,
    });

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }
  } catch (error) {
    // Don't fail the request if idempotency storage fails.
    logger.error("[idempotency] storeIdempotency failed", {
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
  const claim = await claimIdempotencyKey(idempotencyKey, requestHash, ttlSeconds);

  if (claim.status === "cached") {
    return {
      data: claim.response.response_data as T,
      statusCode: claim.response.status_code,
      cached: true,
    };
  }

  if (claim.status === "hash_mismatch") {
    return {
      data: {
        error: "Idempotency key was already used with a different payload",
      } as T,
      statusCode: 409,
      cached: true,
    };
  }

  if (claim.status === "in_progress") {
    return {
      data: {
        error: "Request with this idempotency key is already in progress",
      } as T,
      statusCode: 409,
      cached: true,
    };
  }

  const result = await operation();

  await storeIdempotency(idempotencyKey, requestHash, result.data, result.statusCode, ttlSeconds);

  return {
    ...result,
    cached: false,
  };
}
