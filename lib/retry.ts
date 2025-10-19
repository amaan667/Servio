/**
import { logger } from '@/lib/logger';
 * Retry utility with exponential backoff for handling network failures
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryCondition: (error: any) => {
    // Retry on network errors, timeouts, and 5xx server errors
    return (
      error?.message?.includes('network') ||
      error?.message?.includes('timeout') ||
      error?.message?.includes('fetch') ||
      error?.code === 'NETWORK_ERROR' ||
      error?.code === 'TIMEOUT_ERROR' ||
      (error?.status >= 500 && error?.status < 600) ||
      error?.status === 429 // Rate limited
    );
  }
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or error doesn't match retry condition
      if (attempt === config.maxAttempts || !config.retryCondition(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );

      aiLogger.warn(`[RETRY] Attempt ${attempt} failed, retrying in ${delay}ms:`, (error as any)?.message);
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}

export function createRetryableFetch(
  baseFetch: typeof fetch = fetch,
  options: RetryOptions = {}
) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return withRetry(async () => {
      const response = await baseFetch(input, init);
      
      // Throw error for non-2xx responses to trigger retry logic
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }
      
      return response;
    }, options);
  };
}

// Utility for Supabase operations with retry
export async function withSupabaseRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    return await withRetry(operation, options);
  } catch (error) {
    return { data: null, error };
  }
}
