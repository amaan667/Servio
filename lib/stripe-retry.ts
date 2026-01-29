/**
 * Stripe API Retry Logic with Circuit Breaker Pattern
 *
 * Handles transient failures, rate limits, and implements circuit breaker
 * to prevent cascading failures.
 */

import { Stripe } from "stripe";

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    state: "closed",
    failureCount: 0,
    lastFailureTime: 0,
    successCount: 0,
  };

  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 60 seconds
  private readonly halfOpenMaxAttempts = 3;

  canAttempt(): boolean {
    const now = Date.now();

    switch (this.state.state) {
      case "closed":
        return true;

      case "open":
        if (now - this.state.lastFailureTime > this.timeout) {
          // Transition to half-open
          this.state.state = "half-open";
          this.state.successCount = 0;
          return true;
        }
        return false;

      case "half-open":
        return this.state.successCount < this.halfOpenMaxAttempts;

      default:
        return false;
    }
  }

  recordSuccess(): void {
    if (this.state.state === "half-open") {
      this.state.successCount++;
      if (this.state.successCount >= this.halfOpenMaxAttempts) {
        // Transition back to closed
        this.state.state = "closed";
        this.state.failureCount = 0;
        this.state.successCount = 0;
      }
    } else if (this.state.state === "closed") {
      this.state.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= this.failureThreshold) {
      this.state.state = "open";
    }
  }

  getState(): CircuitBreakerState["state"] {
    return this.state.state;
  }
}

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker();

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    "StripeConnectionError",
    "StripeAPIError",
    "rate_limit",
    "idempotency",
    "timeout",
  ],
};

function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorType = error instanceof Error ? error.constructor.name : "";

  // Check if it's a Stripe error
  if (errorType.includes("Stripe")) {
    // Retry on connection errors, rate limits, and certain API errors
    if (
      errorMessage.includes("rate_limit") ||
      errorMessage.includes("idempotency") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("connection")
    ) {
      return true;
    }

    // Don't retry on client errors (4xx) except rate limits
    if (errorMessage.includes("card_declined") || errorMessage.includes("invalid_request_error")) {
      return false;
    }
  }

  return false;
}

function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = Math.min(
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt),
    options.maxDelay
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}

/**
 * Retry wrapper for Stripe API calls
 *
 * @param fn - Function that returns a Promise (Stripe API call)
 * @param options - Retry configuration options
 * @returns Promise with the result of the function
 */
export async function withStripeRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  // Check circuit breaker
  if (!circuitBreaker.canAttempt()) {
    const error = new Error("Circuit breaker is open. Stripe API temporarily unavailable.");

    throw error;
  }

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn();

      // Record success in circuit breaker
      circuitBreaker.recordSuccess();

      if (attempt > 0) {
        /* Condition handled */
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        circuitBreaker.recordFailure();
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === config.maxRetries) {
        circuitBreaker.recordFailure();

        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  circuitBreaker.recordFailure();
  throw lastError || new Error("Unknown error in retry logic");
}

/**
 * Get current circuit breaker state (for monitoring)
 */
export function getCircuitBreakerState(): {
  state: "closed" | "open" | "half-open";
} {
  return {
    state: circuitBreaker.getState(),
  };
}

/**
 * Reset circuit breaker (for testing or manual recovery)
 */
export function resetCircuitBreaker(): void {
  circuitBreaker.recordSuccess();
}
