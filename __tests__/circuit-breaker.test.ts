/**
 * Unit Tests for Circuit Breaker Pattern
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker, CircuitBreakerRegistry } from "../lib/patterns/circuit-breaker";

describe("CircuitBreaker", () => {
  describe("Initial State", () => {
    it("should start in CLOSED state", () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 3,
        resetTimeout: 1000,
        successThreshold: 2,
        windowSize: 5000,
      });

      expect(breaker.getState()).toBe("CLOSED");
    });

    it("should have zero failure count initially", () => {
      const breaker = new CircuitBreaker({ service: "stripe" });
      const metrics = breaker.getMetrics();

      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });
  });

  describe("Successful Executions", () => {
    it("should record success", async () => {
      const breaker = new CircuitBreaker({ service: "stripe" });

      const result = await breaker.execute(async () => "success");

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.circuitOpen).toBe(false);
      expect(result.state).toBe("CLOSED");

      const metrics = breaker.getMetrics();
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(0);
    });

    it("should handle multiple successful executions", async () => {
      const breaker = new CircuitBreaker({ service: "stripe" });

      await breaker.execute(async () => "result1");
      await breaker.execute(async () => "result2");
      await breaker.execute(async () => "result3");

      const metrics = breaker.getMetrics();
      expect(metrics.successCount).toBe(3);
    });
  });

  describe("Failed Executions", () => {
    it("should record failure", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 3,
        resetTimeout: 1000,
        successThreshold: 2,
        windowSize: 5000,
      });

      const result = await breaker.execute(async () => {
        throw new Error("Test error");
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Test error");
      expect(result.circuitOpen).toBe(false);
      expect(result.state).toBe("CLOSED");

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
    });

    it("should open circuit after failure threshold", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 2,
        resetTimeout: 1000,
        successThreshold: 1,
        windowSize: 5000,
      });

      // First failure
      await breaker.execute(async () => {
        throw new Error("Error 1");
      });
      // Second failure - should open circuit
      await breaker.execute(async () => {
        throw new Error("Error 2");
      });

      expect(breaker.getState()).toBe("OPEN");

      // Circuit should be open - next call should fail fast
      const result = await breaker.execute(async () => "should not reach here");
      expect(result.success).toBe(false);
      expect(result.circuitOpen).toBe(true);
      expect(result.error).toBe("Circuit breaker is open");
    });
  });

  describe("Fallback Support", () => {
    it("should call fallback when circuit is open", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 1,
        resetTimeout: 1000,
        successThreshold: 1,
        windowSize: 5000,
      });

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error("Error");
      });

      // Call with fallback
      const result = await breaker.execute(
        async () => "original",
        async () => "fallback"
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("fallback");
    });

    it("should return fallback error when both fail", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 1,
        resetTimeout: 1000,
        successThreshold: 1,
        windowSize: 5000,
      });

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error("Error");
      });

      // Call where fallback also fails
      const result = await breaker.execute(
        async () => "original",
        async () => {
          throw new Error("Fallback error");
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Fallback also failed");
    });
  });

  describe("Recovery from OPEN state", () => {
    it("should transition to HALF_OPEN after reset timeout", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 1,
        resetTimeout: 50, // Short timeout for testing
        successThreshold: 1,
        windowSize: 5000,
      });

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error("Error");
      });
      expect(breaker.getState()).toBe("OPEN");

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should now be HALF_OPEN
      expect(breaker.getState()).toBe("HALF_OPEN");
    });

    it("should close circuit after successful call in HALF_OPEN", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 1,
        resetTimeout: 50,
        successThreshold: 1,
        windowSize: 5000,
      });

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error("Error");
      });

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Success in HALF_OPEN should close circuit
      const result = await breaker.execute(async () => "recovery");

      expect(breaker.getState()).toBe("CLOSED");
      expect(result.success).toBe(true);
      expect(result.data).toBe("recovery");
      // Implementation clears success/failure arrays on transition to CLOSED, so we only assert state
    });

    it("should re-open circuit on failure in HALF_OPEN", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 1,
        resetTimeout: 50,
        successThreshold: 1,
        windowSize: 5000,
      });

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error("Error");
      });

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Failure in HALF_OPEN should re-open circuit
      await breaker.execute(async () => {
        throw new Error("Error again");
      });

      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("Reset", () => {
    it("should reset all state", async () => {
      const breaker = new CircuitBreaker({
        service: "stripe",
        failureThreshold: 2,
        resetTimeout: 1000,
        successThreshold: 1,
        windowSize: 5000,
      });

      // Accumulate some state
      await breaker.execute(async () => "success");
      await breaker.execute(async () => {
        throw new Error("Error");
      });

      expect(breaker.getMetrics().successCount).toBe(1);
      expect(breaker.getMetrics().failureCount).toBe(1);

      // Reset
      breaker.reset();

      const metrics = breaker.getMetrics();
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.state).toBe("CLOSED");
    });
  });

  describe("Force State", () => {
    it("should force circuit to OPEN state", () => {
      const breaker = new CircuitBreaker({ service: "stripe" });

      breaker.forceState("OPEN");

      expect(breaker.getState()).toBe("OPEN");
    });

    it("should force circuit to CLOSED state", () => {
      const breaker = new CircuitBreaker({ service: "stripe" });
      breaker.forceState("OPEN");

      breaker.forceState("CLOSED");

      expect(breaker.getState()).toBe("CLOSED");
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  beforeEach(() => {
    // Reset the singleton for each test
    CircuitBreakerRegistry["instance"] = undefined as unknown as CircuitBreakerRegistry;
  });

  it("should create default circuit breakers", () => {
    const registry = CircuitBreakerRegistry.getInstance();

    expect(registry.getBreaker("stripe").getState()).toBe("CLOSED");
    expect(registry.getBreaker("openai").getState()).toBe("CLOSED");
    expect(registry.getBreaker("supabase").getState()).toBe("CLOSED");
    expect(registry.getBreaker("redis").getState()).toBe("CLOSED");
  });

  it("should return same instance on multiple calls", () => {
    const instance1 = CircuitBreakerRegistry.getInstance();
    const instance2 = CircuitBreakerRegistry.getInstance();

    expect(instance1).toBe(instance2);
  });

  it("should allow creating custom breakers", () => {
    const registry = CircuitBreakerRegistry.getInstance();
    const breaker = registry.createBreaker("email", {
      failureThreshold: 10,
      resetTimeout: 5000,
    });

    expect(breaker.getState()).toBe("CLOSED");
    expect(registry.getBreaker("email").getState()).toBe("CLOSED");
  });

  it("should reset all breakers", async () => {
    const registry = CircuitBreakerRegistry.getInstance();

    // Open stripe breaker
    const stripe = registry.getBreaker("stripe");
    await stripe.execute(async () => {
      throw new Error("Error");
    });
    await stripe.execute(async () => {
      throw new Error("Error");
    });

    // Reset all
    registry.resetAll();

    expect(stripe.getState()).toBe("CLOSED");
  });
});

describe("Circuit Breaker Metrics", () => {
  it("should track last failure time", async () => {
    const breaker = new CircuitBreaker({ service: "stripe" });

    await breaker.execute(async () => {
      throw new Error("Error");
    });

    const metrics = breaker.getMetrics();
    expect(metrics.lastFailure).toBeInstanceOf(Date);
  });

  it("should track last success time", async () => {
    const breaker = new CircuitBreaker({ service: "stripe" });

    await breaker.execute(async () => "success");

    const metrics = breaker.getMetrics();
    expect(metrics.lastSuccess).toBeInstanceOf(Date);
  });

  it("should track last state change", async () => {
    const breaker = new CircuitBreaker({
      service: "stripe",
      failureThreshold: 1,
      resetTimeout: 50,
    });

    await breaker.execute(async () => {
      throw new Error("Error");
    });

    const beforeChange = breaker.getMetrics().lastStateChange;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // State changed to HALF_OPEN after timeout
    const afterChange = breaker.getMetrics().lastStateChange;

    expect(beforeChange).toBeInstanceOf(Date);
    expect(afterChange).toBeInstanceOf(Date);
    expect(afterChange!.getTime()).toBeGreaterThanOrEqual(beforeChange!.getTime());
  });
});
