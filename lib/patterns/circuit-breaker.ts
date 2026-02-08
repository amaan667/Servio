/**
 * Circuit Breaker Pattern for External Services
 * Provides resilience for external service calls (Stripe, OpenAI, Supabase, etc.)
 */

import { logger } from "@/lib/monitoring/structured-logger";

export type ServiceName = "stripe" | "openai" | "supabase" | "redis" | "email" | "sentry";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Service name for identification */
  service: ServiceName;
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms to wait before trying again when open */
  resetTimeout: number;
  /** Success count needed to close circuit from half-open */
  successThreshold: number;
  /** Time window for failure counting (in ms) */
  windowSize: number;
  /** Callback when circuit opens */
  onOpen?: (service: ServiceName, failureCount: number) => void;
  /** Callback when circuit closes */
  onClose?: (service: ServiceName) => void;
  /** Callback when circuit half-opens (testing recovery) */
  onHalfOpen?: (service: ServiceName) => void;
}

export interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  circuitOpen: boolean;
  state: CircuitState;
}

export interface CircuitBreakerMetrics {
  service: ServiceName;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  lastStateChange?: Date;
}

/**
 * Circuit Breaker State Manager
 * Manages state transitions and metrics
 */
class CircuitBreakerState {
  private state: CircuitState = "CLOSED";
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private lastStateChange: Date | null = null;
  private failures: number[] = [];
  private successes: number[] = [];

  constructor(private config: CircuitBreakerConfig) {}

  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === "OPEN" && this.lastStateChange) {
      if (Date.now() - this.lastStateChange.getTime() > this.config.resetTimeout) {
        this.transitionTo("HALF_OPEN");
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    const now = Date.now();

    if (this.state === "HALF_OPEN") {
      this.successCount++;
      this.successes.push(now);

      // Check if we should close the circuit
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo("CLOSED");
      }
    } else {
      // Clean old successes and record new one
      this.cleanOldEntries(now);
      this.successes.push(now);
    }

    this.lastSuccess = new Date();
  }

  recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailure = new Date();

    if (this.state === "HALF_OPEN") {
      // Any failure in half-open state re-opens the circuit
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED") {
      // Clean old failures and check threshold
      this.cleanOldEntries(now);

      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo("OPEN");
      }
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      service: this.config.service,
      state: this.getState(),
      failureCount: this.failures.length,
      successCount: this.successes.length,
      totalRequests: this.failures.length + this.successes.length,
      lastFailure: this.lastFailure || undefined,
      lastSuccess: this.lastSuccess || undefined,
      lastStateChange: this.lastStateChange || undefined,
    };
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    // Reset counters based on new state
    if (newState === "CLOSED") {
      this.failureCount = 0;
      this.successCount = 0;
      this.failures = [];
      this.successes = [];
      this.config.onClose?.(this.config.service);
    } else if (newState === "OPEN") {
      this.config.onOpen?.(this.config.service, this.failureCount);
    } else if (newState === "HALF_OPEN") {
      this.successCount = 0;
      this.config.onHalfOpen?.(this.config.service);
    }

    logger.info(`Circuit breaker state changed`, {
      service: this.config.service,
      previousState,
      newState,
      type: "circuit_breaker",
    });
  }

  private cleanOldEntries(now: number): void {
    const windowStart = now - this.config.windowSize;
    this.failures = this.failures.filter((timestamp) => timestamp > windowStart);
    this.successes = this.successes.filter((timestamp) => timestamp > windowStart);
  }
}

/**
 * Circuit Breaker for External Service Calls
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    const serviceName = (config.service as ServiceName) || "stripe";
    this.state = new CircuitBreakerState({
      service: serviceName,
      failureThreshold: config.failureThreshold || 5,
      resetTimeout: config.resetTimeout || 30000, // 30 seconds
      successThreshold: config.successThreshold || 3,
      windowSize: config.windowSize || 60000, // 1 minute
      onOpen: config.onOpen,
      onClose: config.onClose,
      onHalfOpen: config.onHalfOpen,
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<CircuitBreakerResult<T>> {
    const state = this.state.getState();

    // If circuit is open, reject immediately
    if (state === "OPEN") {
      logger.warn(`Circuit breaker is open for ${this.state.getMetrics().service}`, {
        service: this.state.getMetrics().service,
        type: "circuit_breaker",
      });

      if (fallback) {
        try {
          const result = await fallback();
          return {
            success: true,
            data: result,
            circuitOpen: true,
            state: "OPEN",
          };
        } catch {
          return {
            success: false,
            error: "Fallback also failed",
            circuitOpen: true,
            state: "OPEN",
          };
        }
      }

      return {
        success: false,
        error: "Circuit breaker is open",
        circuitOpen: true,
        state: "OPEN",
      };
    }

    try {
      const result = await fn();
      this.state.recordSuccess();

      return {
        success: true,
        data: result,
        circuitOpen: false,
        state: this.state.getState(),
      };
    } catch (error) {
      this.state.recordFailure();

      if (fallback) {
        try {
          const fallbackResult = await fallback();
          return {
            success: true,
            data: fallbackResult,
            circuitOpen: false,
            state: this.state.getState(),
            error: error instanceof Error ? error.message : String(error),
          };
        } catch {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            circuitOpen: false,
            state: this.state.getState(),
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        circuitOpen: this.state.getState() === "OPEN",
        state: this.state.getState(),
      };
    }
  }

  /**
   * Force the circuit to a specific state
   */
  forceState(state: CircuitState): void {
    const breaker = (this.state as unknown as { transitionTo: (s: CircuitState) => void });
    breaker.transitionTo(state);
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return this.state.getMetrics();
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state.getState();
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = new CircuitBreakerState({
      service: this.state.getMetrics().service,
      failureThreshold: 5,
      resetTimeout: 30000,
      successThreshold: 3,
      windowSize: 60000,
    });
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers: Map<ServiceName, CircuitBreaker> = new Map();

  private constructor() {
    // Initialize with default circuit breakers
    this.createBreaker("stripe", { failureThreshold: 3, resetTimeout: 60000 });
    this.createBreaker("openai", { failureThreshold: 5, resetTimeout: 60000 });
    this.createBreaker("supabase", { failureThreshold: 3, resetTimeout: 30000 });
    this.createBreaker("redis", { failureThreshold: 3, resetTimeout: 30000 });
    this.createBreaker("email", { failureThreshold: 5, resetTimeout: 60000 });
    this.createBreaker("sentry", { failureThreshold: 10, resetTimeout: 60000 });
  }

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getBreaker(service: ServiceName): CircuitBreaker {
    if (!this.breakers.has(service)) {
      this.createBreaker(service);
    }
    return this.breakers.get(service)!;
  }

  /**
   * Create a new circuit breaker
   */
  createBreaker(service: ServiceName, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    const breaker = new CircuitBreaker({
      service,
      ...config,
      onOpen: (s, count) => {
        logger.error(`Circuit breaker opened for ${s}`, {
          service: s,
          failureCount: count,
          type: "circuit_breaker",
        });
      },
      onClose: (s) => {
        logger.info(`Circuit breaker closed for ${s}`, {
          service: s,
          type: "circuit_breaker",
        });
      },
    });

    this.breakers.set(service, breaker);
    return breaker;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<ServiceName, CircuitBreakerMetrics> {
    const metrics = new Map<ServiceName, CircuitBreakerMetrics>();
    this.breakers.forEach((breaker, service) => {
      metrics.set(service, breaker.getMetrics());
    });
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }
}

/**
 * Execute with circuit breaker protection using the registry
 */
export async function withCircuitBreaker<T>(
  service: ServiceName,
  fn: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<CircuitBreakerResult<T>> {
  const registry = CircuitBreakerRegistry.getInstance();
  const breaker = registry.getBreaker(service);
  return breaker.execute(fn, fallback);
}

/**
 * Get metrics for a service
 */
export function getCircuitBreakerMetrics(service: ServiceName): CircuitBreakerMetrics {
  const registry = CircuitBreakerRegistry.getInstance();
  return registry.getBreaker(service).getMetrics();
}

/**
 * Get all circuit breaker metrics
 */
export function getAllCircuitBreakerMetrics(): Map<ServiceName, CircuitBreakerMetrics> {
  return CircuitBreakerRegistry.getInstance().getAllMetrics();
}

// Export singleton registry instance
export const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
