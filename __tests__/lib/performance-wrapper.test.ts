import { describe, it, expect, beforeEach } from "vitest";
import { performanceMonitor } from "@/lib/monitoring/performance-wrapper";

describe("Performance Monitor", () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  it("should measure successful operations", async () => {
    const testFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "success";
    };

    const result = await performanceMonitor.measure("test-operation", testFn);

    expect(result).toBe("success");

    const stats = performanceMonitor.getStats("test-operation");
    expect(stats).toBeTruthy();
    expect(stats?.count).toBe(1);
    expect(stats?.successRate).toBe(100);
    expect(stats?.avgDuration).toBeGreaterThan(0);
  });

  it("should measure failed operations", async () => {
    const testFn = async () => {
      throw new Error("Test error");
    };

    await expect(performanceMonitor.measure("failing-operation", testFn)).rejects.toThrow(
      "Test error"
    );

    const stats = performanceMonitor.getStats("failing-operation");
    expect(stats?.count).toBe(1);
    expect(stats?.successRate).toBe(0);
  });

  it("should calculate p95 duration correctly", async () => {
    // Run operation multiple times with varying durations
    for (let i = 0; i < 100; i++) {
      await performanceMonitor.measure("batch-operation", async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
      });
    }

    const stats = performanceMonitor.getStats("batch-operation");
    expect(stats?.count).toBe(100);
    expect(stats?.p95Duration).toBeGreaterThan(0);
    expect(stats?.avgDuration).toBeGreaterThan(0);
  });

  it("should track multiple operations separately", async () => {
    await performanceMonitor.measure("op1", async () => "result1");
    await performanceMonitor.measure("op2", async () => "result2");
    await performanceMonitor.measure("op1", async () => "result3");

    const stats1 = performanceMonitor.getStats("op1");
    const stats2 = performanceMonitor.getStats("op2");

    expect(stats1?.count).toBe(2);
    expect(stats2?.count).toBe(1);
  });

  it("should provide all stats", async () => {
    await performanceMonitor.measure("op1", async () => "r1");
    await performanceMonitor.measure("op2", async () => "r2");

    const allStats = performanceMonitor.getAllStats();

    expect(Object.keys(allStats).length).toBe(2);
    expect(allStats["op1"]).toBeTruthy();
    expect(allStats["op2"]).toBeTruthy();
  });
});
