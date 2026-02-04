// ============================================================================
// CIRCUIT BREAKER PATTERN IMPLEMENTATION
// Prevents cascading failures when external services are down
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes in HALF_OPEN to close
  timeout: number; // Time in ms before trying again
  volumeThreshold: number; // Minimum requests before evaluating
  windowMs: number; // Time window for failure counting
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
  totalRequests: number;
  recentFailures: number;
}

export interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  fromCache: boolean;
  state: CircuitState;
}

// Default configuration
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000, // 30 seconds
  volumeThreshold: 10,
  windowMs: 60000, // 1 minute
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private recentFailures: number[] = [];
  private totalRequests = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<CircuitBreakerResult<T>> {
    this.totalRequests++;

    // Check if we should allow the request based on state
    if (this.state === 'OPEN') {
      if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        this.failureCount = 0;
      } else {
        return {
          success: false,
          error: new Error(`Circuit breaker '${this.name}' is OPEN`),
          fromCache: false,
          state: this.state,
        };
      }
    }

    // Clean up old failures from the window
    this.cleanupOldFailures();

    try {
      const result = await fn();
      this.recordSuccess();
      
      return {
        success: true,
        data: result,
        fromCache: false,
        state: this.state,
      };
    } catch (error) {
      this.recordFailure();
      
      if (fallback) {
        try {
          const fallbackResult = await fallback();
          return {
            success: true,
            data: fallbackResult,
            fromCache: true,
            state: this.state,
          };
        } catch (fallbackError) {
          return {
            success: false,
            error: fallbackError as Error,
            fromCache: false,
            state: this.state,
          };
        }
      }

      return {
        success: false,
        error: error as Error,
        fromCache: false,
        state: this.state,
      };
    }
  }

  /**
   * Record a successful execution
   */
  private recordSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.successCount++;

    if (this.state === 'HALF_OPEN' && this.successCount >= this.config.successThreshold) {
      this.close();
    }
  }

  /**
   * Record a failed execution
   */
  private recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.recentFailures.push(Date.now());

    // Check if we should open the circuit
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      if (this.shouldOpen()) {
        this.open();
      }
    }
  }

  /**
   * Determine if circuit should open based on thresholds
   */
  private shouldOpen(): boolean {
    // Must have minimum volume of requests
    if (this.recentFailures.length < this.config.volumeThreshold) {
      return false;
    }

    // Calculate failure rate in the current window
    const windowStart = Date.now() - this.config.windowMs;
    const windowedFailures = this.recentFailures.filter((t) => t >= windowStart);
    const windowedTotal = this.config.volumeThreshold; // Approximation
    const failureRate = windowedFailures.length / windowedTotal;

    return failureRate >= (this.config.failureThreshold / this.config.volumeThreshold);
  }

  /**
   * Open the circuit (fail fast)
   */
  private open(): void {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.timeout;
    
    // Emit event (could integrate with monitoring)
    this.emitStateChange('OPEN');
  }

  /**
   * Close the circuit (allow requests)
   */
  private close(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.recentFailures = [];
    this.nextAttemptTime = null;
    
    this.emitStateChange('CLOSED');
  }

  /**
   * Clean up old failures outside the window
   */
  private cleanupOldFailures(): void {
    const windowStart = Date.now() - this.config.windowMs;
    this.recentFailures = this.recentFailures.filter((t) => t >= windowStart);
  }

  /**
   * Emit state change event
   */
  private emitStateChange(_newState: CircuitState): void {
    // In production, emit to monitoring/observability
    // State change events would be logged via structured logging system
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    this.cleanupOldFailures();
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests,
      recentFailures: this.recentFailures.length,
    };
  }

  /**
   * Force the circuit to a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.state = state;
    if (state === 'OPEN') {
      this.nextAttemptTime = Date.now() + this.config.timeout;
    } else if (state === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
      this.recentFailures = [];
      this.nextAttemptTime = null;
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.recentFailures = [];
    this.totalRequests = 0;
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// Manages multiple circuit breakers for different services
// ============================================================================

export interface CircuitBreakerRegistry {
  get(name: string): CircuitBreaker | null;
  register(name: string, config?: CircuitBreakerConfig): CircuitBreaker;
  remove(name: string): void;
  getAll(): Map<string, CircuitBreaker>;
  getMetrics(): Record<string, CircuitBreakerMetrics>;
}

export class CircuitBreakerRegistryImpl implements CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: CircuitBreakerConfig;

  constructor(defaultConfig?: CircuitBreakerConfig) {
    this.defaultConfig = defaultConfig ?? DEFAULT_CIRCUIT_BREAKER_CONFIG;
  }

  get(name: string): CircuitBreaker | null {
    return this.breakers.get(name) ?? null;
  }

  register(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    const existing = this.breakers.get(name);
    if (existing) {
      return existing;
    }

    const breaker = new CircuitBreaker(
      name,
      config ?? this.defaultConfig
    );
    this.breakers.set(name, breaker);
    return breaker;
  }

  remove(name: string): void {
    this.breakers.delete(name);
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistryImpl();

// Pre-configured circuit breakers for common services
export const SERVICE_CIRCUIT_BREAKERS = {
  STRIPE: circuitBreakerRegistry.register('stripe', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000, // 1 minute for payments
    volumeThreshold: 5,
    windowMs: 120000,
  }),
  SUPABASE: circuitBreakerRegistry.register('supabase', {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 30000,
    volumeThreshold: 20,
    windowMs: 60000,
  }),
  OPENAI: circuitBreakerRegistry.register('openai', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000,
    volumeThreshold: 10,
    windowMs: 120000,
  }),
  REDIS: circuitBreakerRegistry.register('redis', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
    volumeThreshold: 5,
    windowMs: 30000,
  }),
} as const;

// ============================================================================
// DECORATOR FOR EASY INTEGRATION
// ============================================================================

type Constructor = new (...args: unknown[]) => unknown;

/**
 * Apply circuit breaker protection to a class method
 */
export function withCircuitBreaker(
  breaker: CircuitBreaker,
  fallback?: (...args: unknown[]) => unknown
) {
  return function <T extends Constructor>(
    _target: T,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      return breaker.execute(
        () => originalMethod.apply(this, args),
        fallback as () => Promise<unknown>
      );
    };

    return descriptor;
  };
}
