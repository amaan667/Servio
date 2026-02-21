/**
 * BaseService Tests
 * Tests for common service functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseService } from "@/lib/services/BaseService";
import { cache } from "@/lib/cache";

// Create a concrete implementation for testing
class TestService extends BaseService {
  async testMethod() {
    return "test";
  }
}

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    invalidate: vi.fn(),
  },
}));

describe("BaseService", () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    vi.clearAllMocks();
  });

  describe("getCacheKey", () => {
    it("should generate cache key with prefix and parts", () => {
      const key = service["getCacheKey"]("test", "part1", "part2", 123);
      expect(key).toBe("test:part1:part2:123");
    });
  });

  describe("withCache", () => {
    it("should return cached value if available", async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      vi.mocked(cache.get).mockResolvedValue("cached-value" as never);

      const result = await service["withCache"]("test-key", async () => "new-value", 300);

      expect(result).toBe("cached-value");
      expect(cache.get).toHaveBeenCalledWith("test-key");
      process.env.NODE_ENV = orig;
    });

    it("should execute callback and cache result if not cached", async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(cache.set).mockResolvedValue(true);

      const callback = vi.fn().mockResolvedValue("new-value");

      const result = await service["withCache"]("test-key", callback, 300);

      expect(result).toBe("new-value");
      expect(callback).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith("test-key", "new-value", { ttl: 300 });
      process.env.NODE_ENV = orig;
    });

    it("should skip caching in test mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      const callback = vi.fn().mockResolvedValue("test-value");

      const result = await service["withCache"]("test-key", callback, 300);

      expect(result).toBe("test-value");
      expect(cache.get).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("invalidateCache", () => {
    it("should delete cache entry", async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      vi.mocked(cache.delete).mockResolvedValue(true);

      await service["invalidateCache"]("test-key");

      expect(cache.delete).toHaveBeenCalledWith("test-key");
      process.env.NODE_ENV = orig;
    });

    it("should skip in test mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      await service["invalidateCache"]("test-key");

      expect(cache.delete).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("handleError", () => {
    it("should handle PGRST116 error code", () => {
      const error = { code: "PGRST116", message: "Not found" };
      expect(() => service["handleError"](error, "test")).toThrow("Resource not found");
    });

    it("should handle 23505 error code", () => {
      const error = { code: "23505", message: "Duplicate" };
      expect(() => service["handleError"](error, "test")).toThrow("Resource already exists");
    });

    it("should rethrow other errors", () => {
      const error = new Error("Generic error");
      expect(() => service["handleError"](error, "test")).toThrow("Generic error");
    });
  });
});
