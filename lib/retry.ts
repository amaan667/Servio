/**
 * Retry utility with exponential backoff for handling network failures
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: unknown) => boolean;
}

interface RetryableError {
  message?: string;
  code?: string;
  status?: number;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryCondition: (error: unknown) => {
    // Retry on network errors, timeouts, and 5xx server errors
    const err = error as RetryableError;
    return (
      err?.message?.includes("network") ||
      err?.message?.includes("timeout") ||
      err?.message?.includes("fetch") ||
      err?.code === "NETWORK_ERROR" ||
      err?.code === "TIMEOUT_ERROR" ||
      (err?.status !== undefined && err.status >= 500 && err.status < 600) ||
      err?.status === 429 // Rate limited
    );
  },
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {
    /* Empty */
  }
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (_error) {
      lastError = _error;

      // Don't retry if this is the last attempt or error doesn't match retry condition
      if (attempt === config.maxAttempts || !config.retryCondition(_error)) {
        throw _error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );

      const err = _error as RetryableError;

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}

export function createRetryableFetch(
  baseFetch: typeof fetch = fetch,
  options: RetryOptions = {
    /* Empty */
  }
) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return withRetry(async () => {
      const response = await baseFetch(input, init);

      // Throw error for non-2xx responses to trigger retry logic
      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        ) as RetryableError;
        error.status = response.status;
        throw error;
      }

      return response;
    }, options);
  };
}

// Utility for Supabase operations with retry
export async function withSupabaseRetry<T>(
  operation: () => Promise<{ data: T | null; error: unknown }>,
  options: RetryOptions = {
    /* Empty */
  }
): Promise<{ data: T | null; error: unknown }> {
  try {
    return await withRetry(operation, options);
  } catch (error) {
    return { data: null, error };
  }
}
