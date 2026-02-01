/**
 * @fileoverview Performance Benchmarking
 * Provides utilities for measuring and tracking performance metrics
 */

export interface BenchmarkResult {
  name: string;
  duration: number;
  memory: number;
  timestamp: number;
}

export interface BenchmarkOptions {
  iterations?: number;
  warmup?: boolean;
  memory?: boolean;
}

/**
 * Performance Benchmarking Utility
 */
export class PerformanceBenchmark {
  private results: Map<string, BenchmarkResult[]> = new Map();

  /**
   * Run a benchmark
   */
  async benchmark<T>(
    name: string,
    fn: () => Promise<T> | T,
    options: BenchmarkOptions = {}
  ): Promise<BenchmarkResult> {
    const { iterations = 1, warmup = true, memory = true } = options;

    // Warmup run
    if (warmup) {
      await fn();
    }

    // Measure memory before
    const memoryBefore = memory ? this.getMemoryUsage() : 0;

    // Run benchmark
    const startTime = performance.now();
    let result: T;

    for (let i = 0; i < iterations; i++) {
      result = await fn();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Measure memory after
    const memoryAfter = memory ? this.getMemoryUsage() : 0;
    const memoryUsed = memoryAfter - memoryBefore;

    const benchmarkResult: BenchmarkResult = {
      name,
      duration: duration / iterations, // Average duration
      memory: memoryUsed,
      timestamp: Date.now(),
    };

    // Store result
    if (!this.results.has(name)) {
      this.results.set(name, []);
    }
    this.results.get(name)!.push(benchmarkResult);

    return benchmarkResult;
  }

  /**
   * Run multiple benchmarks
   */
  async benchmarkSuite<T>(
    name: string,
    benchmarks: Record<string, () => Promise<T> | T>,
    options: BenchmarkOptions = {}
  ): Promise<Record<string, BenchmarkResult>> {
    const results: Record<string, BenchmarkResult> = {};

    for (const [benchmarkName, fn] of Object.entries(benchmarks)) {
      const fullName = `${name}:${benchmarkName}`;
      results[benchmarkName] = await this.benchmark(fullName, fn, options);
    }

    return results;
  }

  /**
   * Get benchmark results
   */
  getResults(name: string): BenchmarkResult[] {
    return this.results.get(name) || [];
  }

  /**
   * Get all benchmark results
   */
  getAllResults(): Map<string, BenchmarkResult[]> {
    return this.results;
  }

  /**
   * Clear benchmark results
   */
  clearResults(name?: string): void {
    if (name) {
      this.results.delete(name);
    } else {
      this.results.clear();
    }
  }

  /**
   * Get benchmark statistics
   */
  getStatistics(name: string): {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const results = this.results.get(name);

    if (!results || results.length === 0) {
      return null;
    }

    const durations = results.map((r) => r.duration).sort((a, b) => a - b);

    const min = durations[0] ?? 0;
    const max = durations[durations.length - 1] ?? 0;
    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)] ?? 0;

    const p95Index = Math.min(Math.floor(durations.length * 0.95), durations.length - 1);
    const p95 = durations[p95Index] ?? 0;

    const p99Index = Math.min(Math.floor(durations.length * 0.99), durations.length - 1);
    const p99 = durations[p99Index] ?? 0;

    return { min, max, mean, median, p95, p99 };
  }

  /**
   * Compare two benchmarks
   */
  compare(name1: string, name2: string): {
    faster: string;
    speedup: number;
    percentFaster: number;
  } | null {
    const stats1 = this.getStatistics(name1);
    const stats2 = this.getStatistics(name2);

    if (!stats1 || !stats2) {
      return null;
    }

    const mean1 = stats1.mean;
    const mean2 = stats2.mean;

    if (mean1 < mean2) {
      const speedup = mean2 / mean1;
      const percentFaster = ((mean2 - mean1) / mean2) * 100;

      return {
        faster: name1,
        speedup,
        percentFaster,
      };
    } else {
      const speedup = mean1 / mean2;
      const percentFaster = ((mean1 - mean2) / mean1) * 100;

      return {
        faster: name2,
        speedup,
        percentFaster,
      };
    }
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof performance !== "undefined" && "memory" in performance) {
      const perfMemory = (performance as Performance & { memory: { usedJSHeapSize: number } }).memory;
      return perfMemory?.usedJSHeapSize || 0;
    }
    return 0;
  }

  /**
   * Format benchmark result for display
   */
  formatResult(result: BenchmarkResult): string {
    const duration = result.duration.toFixed(2);
    const memory = (result.memory / 1024 / 1024).toFixed(2);

    return `${result.name}: ${duration}ms, ${memory}MB`;
  }

  /**
   * Format statistics for display
   */
  formatStatistics(name: string): string | null {
    const stats = this.getStatistics(name);

    if (!stats) {
      return null;
    }

    return `
${name} Statistics:
  Min: ${stats.min.toFixed(2)}ms
  Max: ${stats.max.toFixed(2)}ms
  Mean: ${stats.mean.toFixed(2)}ms
  Median: ${stats.median.toFixed(2)}ms
  P95: ${stats.p95.toFixed(2)}ms
  P99: ${stats.p99.toFixed(2)}ms
    `.trim();
  }
}

// Export singleton instance
export const benchmark = new PerformanceBenchmark();

/**
 * Decorator for automatic benchmarking
 */
export function Benchmark(name: string, _options?: BenchmarkOptions) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const fullName = `${name}.${propertyKey}`;
      return benchmark.benchmark(fullName, () =>
        originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

/**
 * Measure function execution time
 */
export async function measureTime<T>(
  _name: string,
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  const duration = endTime - startTime;

  return { result, duration };
}

/**
 * Measure memory usage
 */
export async function measureMemory<T>(
  _name: string,
  fn: () => Promise<T> | T
): Promise<{ result: T; memory: number }> {
  const memoryBefore = benchmark["getMemoryUsage"]();
  const result = await fn();
  const memoryAfter = benchmark["getMemoryUsage"]();
  const memory = memoryAfter - memoryBefore;

  return { result, memory };
}

/**
 * Performance thresholds for alerts
 */
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE: {
    GOOD: 100, // ms
    ACCEPTABLE: 500,
    POOR: 1000,
  },
  DATABASE_QUERY: {
    GOOD: 10,
    ACCEPTABLE: 50,
    POOR: 100,
  },
  RENDER_TIME: {
    GOOD: 16, // 60fps
    ACCEPTABLE: 33, // 30fps
    POOR: 100, // 10fps
  },
  MEMORY_USAGE: {
    GOOD: 50 * 1024 * 1024, // 50MB
    ACCEPTABLE: 100 * 1024 * 1024, // 100MB
    POOR: 200 * 1024 * 1024, // 200MB
  },
};

/**
 * Check if performance is acceptable
 */
export function checkPerformance(
  type: keyof typeof PERFORMANCE_THRESHOLDS,
  value: number
): "good" | "acceptable" | "poor" {
  const thresholds = PERFORMANCE_THRESHOLDS[type];

  if (value <= thresholds.GOOD) {
    return "good";
  }
  if (value <= thresholds.ACCEPTABLE) {
    return "acceptable";
  }
  return "poor";
}
