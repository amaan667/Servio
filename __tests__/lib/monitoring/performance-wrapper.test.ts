/**
 * @fileoverview Tests for performance monitoring wrapper
 * @module __tests__/lib/monitoring/performance-wrapper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { performanceMonitor } from "@/lib/monitoring/performance-wrapper";

describe("Performance Monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  describe("mark", () => {
    it("should create performance marks", () => {
      performanceMonitor.mark("test-mark-start");
      performanceMonitor.mark("test-mark-end");

      // Performance API should have the marks
      const marks = performance.getEntriesByType("mark");
      expect(marks.some((m) => m.name === "test-mark-start")).toBe(true);
      expect(marks.some((m) => m.name === "test-mark-end")).toBe(true);
    });
  });

  describe("measureBetween", () => {
    it("should measure time between marks", () => {
      performanceMonitor.mark("start-mark");

      // Simulate some work
      const now = Date.now();
      while (Date.now() - now < 5) {
        // Busy wait for 5ms
      }

      performanceMonitor.mark("end-mark");
      performanceMonitor.measureBetween("test-measure", "start-mark", "end-mark");

      const measures = performance.getEntriesByType("measure");
      const testMeasure = measures.find((m) => m.name === "test-measure");

      expect(testMeasure).toBeDefined();
      expect(testMeasure?.duration).toBeGreaterThan(0);
    });
  });

  describe("getMetrics", () => {
    it("should return performance metrics", () => {
      performanceMonitor.mark("metric-test");

      const metrics = performanceMonitor.getMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.some((m: { name: string }) => m.name === "metric-test")).toBe(true);
    });
  });

  describe("clearMetrics", () => {
    it("should clear all performance entries", () => {
      performanceMonitor.mark("clear-test");
      performanceMonitor.clearMetrics();

      const entries = performance.getEntries();
      expect(entries.length).toBe(0);
    });
  });
});
