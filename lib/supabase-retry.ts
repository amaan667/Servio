/**
 * Supabase Query Retry Utility
 * Handles 503 Service Unavailable and other transient errors
 */

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  logContext?: string;
}

export async function retrySupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  options: RetryOptions = {
    /* Empty */
  }
): Promise<{ data: T | null; error: unknown }> {
  const { maxRetries = 5, delayMs = 500, backoffMultiplier = 1.5, logContext = "Query" } = options;

  let lastError: unknown = null;
  let currentDelay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) { /* Condition handled */ }

      const result = await queryFn();

      // If successful or has data, return immediately
      if (!result.error || result.data) {
        if (attempt > 0) { /* Condition handled */ }
        return result;
      }

      // Check if error is retryable (503, network errors, timeouts)
      const errorMessage = (result.error as Error)?.message || String(result.error);
      const errorCode =
        result.error && typeof result.error === "object" && "code" in result.error
          ? (result.error as { code: string }).code
          : undefined;
      const isRetryable =
        errorMessage.includes("503") ||
        errorMessage.includes("Service Unavailable") ||
        errorMessage.includes("network") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorCode === "503";

      if (!isRetryable || attempt === maxRetries) {

        return result;
      }

      lastError = result.error;

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay = Math.floor(currentDelay * backoffMultiplier);
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);

      lastError = _error;

      if (attempt === maxRetries) {
        return { data: null, error: lastError };
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay = Math.floor(currentDelay * backoffMultiplier);
    }
  }

  return { data: null, error: lastError };
}
