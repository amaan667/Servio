 
/**
 * @fileoverview Tests for performance monitoring wrapper
 * @module __tests__/lib/monitoring/performance-wrapper
 */

import { describe, it, expect } from "vitest";
import { performanceMonitor } from "@/lib/monitoring/performance-wrapper";

describe("Performance Monitor", () => {

  describe("measure", () => {
    it("should execute function and return result", async () => {
      const testFn = vi.fn().mockResolvedValue("test result");

      const result = await performanceMonitor.measure("test-operation", testFn);

      expect(testFn).toHaveBeenCalledTimes(1);
      expect(result).toBe("test result");
    });

    it("should measure execution time", async () => {
      const testFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "result";
      });

      const startTime = Date.now();
      await performanceMonitor.measure("test-operation", testFn);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });

    it("should handle function errors", async () => {
      const testError = new Error("Test error");
      const testFn = vi.fn().mockRejectedValue(testError);

      await expect(performanceMonitor.measure("test-operation", testFn)).rejects.toThrow(
        "Test error"
      );
    });

    it("should work with synchronous functions", async () => {
      const testFn = vi.fn().mockReturnValue("sync result");

      const result = await performanceMonitor.measure("test-operation", testFn);

      expect(result).toBe("sync result");
    });

    it("should measure nested operations", async () => {
      const innerFn = vi.fn().mockResolvedValue("inner result");
      const outerFn = vi.fn().mockImplementation(async () => {
        const inner = await performanceMonitor.measure("inner-operation", innerFn);
        return `outer: ${inner}`;
      });

      const result = await performanceMonitor.measure("outer-operation", outerFn);

      expect(result).toBe("outer: inner result");
      expect(innerFn).toHaveBeenCalledTimes(1);
      expect(outerFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStats", () => {
    it("should return stats for an operation", async () => {
      await performanceMonitor.measure("test-stats", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "result";
      });

      const stats = performanceMonitor.getStats("test-stats");

      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avgDuration).toBeGreaterThan(0);
      expect(stats?.successRate).toBe(100);
    });

    it("should return null for non-existent operation", () => {
      const stats = performanceMonitor.getStats("non-existent");
      expect(stats).toBeNull();
    });
  });

  describe("getAllStats", () => {
    it("should return all operation stats", async () => {
      await performanceMonitor.measure("op1", async () => "result1");
      await performanceMonitor.measure("op2", async () => "result2");

      const allStats = performanceMonitor.getAllStats();

      expect(allStats).toBeDefined();
      expect(allStats.op1).toBeDefined();
      expect(allStats.op2).toBeDefined();
    });
  });

  describe("clear", () => {
    it("should clear all metrics", async () => {
      await performanceMonitor.measure("test-clear", async () => "result");

      let stats = performanceMonitor.getStats("test-clear");
      expect(stats).toBeDefined();

      performanceMonitor.clear();

      stats = performanceMonitor.getStats("test-clear");
      expect(stats).toBeNull();
    });
  });
});
