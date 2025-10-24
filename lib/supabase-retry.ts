/**
 * Supabase Query Retry Utility
 * Handles 503 Service Unavailable and other transient errors
 */

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

export async function retrySupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: unknown }> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2
  } = options;

  let lastError: unknown = null;
  let currentDelay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn();
      
      // If successful or has data, return immediately
      if (!result.error || result.data) {
        return result;
      }
      
      // Check if error is retryable (503, network errors, timeouts)
      const errorMessage = (result.error as Error)?.message || String(result.error);
      const isRetryable = 
        errorMessage.includes('503') ||
        errorMessage.includes('Service Unavailable') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNRESET');

      if (!isRetryable || attempt === maxRetries) {
        return result;
      }

      lastError = result.error;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
      
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        return { data: null, error };
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  return { data: null, error: lastError };
}

