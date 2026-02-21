/**
 * Unit tests for security utilities
 * Tests for rate limiting, CSRF protection, input sanitization, and validation
 */

import { describe, it, expect } from "vitest";
import {
  security,
  rateLimitMiddleware,
  csrfMiddleware,
  validateInputMiddleware,
} from "@/lib/security";
import { NextRequest } from "next/server";

describe("SecurityService", () => {
  describe("Rate Limiting", () => {
    it("should allow requests within limit", async () => {
      const identifier = "test-user-1";
      const config = { windowMs: 60000, maxRequests: 5 };

      for (let i = 0; i < 5; i++) {
        const result = await security.checkRateLimit(identifier, config);
        expect(result).toBe(true);
      }
    });

    it("should block requests exceeding limit", async () => {
      const identifier = "test-user-2";
      const config = { windowMs: 60000, maxRequests: 3 };

      // Allow first 3 requests
      for (let i = 0; i < 3; i++) {
        await security.checkRateLimit(identifier, config);
      }

      // 4th request should be blocked
      const result = await security.checkRateLimit(identifier, config);
      expect(result).toBe(false);
    });

    it("should reset rate limit after window expires", async () => {
      const identifier = "test-user-3";
      const config = { windowMs: 100, maxRequests: 2 };

      // Use up limit
      await security.checkRateLimit(identifier, config);
      await security.checkRateLimit(identifier, config);

      // Should be blocked
      let result = await security.checkRateLimit(identifier, config);
      expect(result).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      result = await security.checkRateLimit(identifier, config);
      expect(result).toBe(true);
    });

    it("should handle different identifiers independently", async () => {
      const config = { windowMs: 60000, maxRequests: 2 };

      // User 1 uses up limit
      await security.checkRateLimit("user-1", config);
      await security.checkRateLimit("user-1", config);

      // User 1 should be blocked
      let result = await security.checkRateLimit("user-1", config);
      expect(result).toBe(false);

      // User 2 should still be allowed
      result = await security.checkRateLimit("user-2", config);
      expect(result).toBe(true);
    });
  });

  describe("CSRF Protection", () => {
    it("should generate CSRF token", () => {
      const userId = "user-123";
      const token = security.generateCSRFToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("should validate correct CSRF token", () => {
      const userId = "user-456";
      const token = security.generateCSRFToken(userId);

      const isValid = security.validateCSRFToken(userId, token);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect CSRF token", () => {
      const userId = "user-789";
      const token = security.generateCSRFToken(userId);

      const isValid = security.validateCSRFToken(userId, "wrong-token");
      expect(isValid).toBe(false);
    });

    it("should reject expired CSRF token", async () => {
      const userId = "user-expired";
      const token = security.generateCSRFToken(userId);

      // Wait for token to expire (1 hour)
      await new Promise((resolve) => setTimeout(resolve, 3601000));

      const isValid = security.validateCSRFToken(userId, token);
      expect(isValid).toBe(false);
    });
  });

  describe("Input Sanitization", () => {
    it("should sanitize string input", () => {
      const input = '<script>alert("xss")</script>Hello World';
      const sanitized = security.sanitizeInput(input);

      expect(sanitized).toBe("Hello World");
      expect(sanitized).not.toContain("<script>");
    });

    it("should remove javascript: protocol", () => {
      const input = 'javascript:alert("xss")';
      const sanitized = security.sanitizeInput(input);

      expect(sanitized).not.toContain("javascript:");
    });

    it("should remove event handlers", () => {
      const input = '<div onclick="alert("xss")">Click me</div>';
      const sanitized = security.sanitizeInput(input);

      expect(sanitized).not.toContain("onclick");
    });

    it("should sanitize array input", () => {
      const input = ['<script>alert("xss")</script>', "normal text", 'javascript:alert("xss")'];
      const sanitized = security.sanitizeInput(input);

      expect(sanitized).toEqual(["normal text", "normal text", ""]);
    });

    it("should sanitize object input", () => {
      const input = {
        name: '<script>alert("xss")</script>John',
        email: "john@example.com",
        bio: 'javascript:alert("xss")Developer',
      };
      const sanitized = security.sanitizeInput(input);

      expect(sanitized.name).toBe("John");
      expect(sanitized.email).toBe("john@example.com");
      expect(sanitized.bio).toBe("Developer");
    });

    it("should pass through non-string primitives", () => {
      expect(security.sanitizeInput(123)).toBe(123);
      expect(security.sanitizeInput(true)).toBe(true);
      expect(security.sanitizeInput(null)).toBe(null);
    });
  });

  describe("Email Validation", () => {
    it("should validate correct email format", () => {
      expect(security.validateEmail("user@example.com")).toBe(true);
      expect(security.validateEmail("user.name@example.com")).toBe(true);
      expect(security.validateEmail("user+tag@example.co.uk")).toBe(true);
    });

    it("should reject invalid email format", () => {
      expect(security.validateEmail("invalid")).toBe(false);
      expect(security.validateEmail("invalid@")).toBe(false);
      expect(security.validateEmail("@example.com")).toBe(false);
      expect(security.validateEmail("user@")).toBe(false);
      expect(security.validateEmail("user@.com")).toBe(false);
    });
  });

  describe("Password Validation", () => {
    it("should validate strong password", () => {
      const result = security.validatePassword("StrongP@ssw0rd!");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject password less than 8 characters", () => {
      const result = security.validatePassword("Short1!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must be at least 8 characters long");
    });

    it("should reject password without uppercase letter", () => {
      const result = security.validatePassword("lowercase1!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one uppercase letter");
    });

    it("should reject password without lowercase letter", () => {
      const result = security.validatePassword("UPPERCASE1!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one lowercase letter");
    });

    it("should reject password without number", () => {
      const result = security.validatePassword("NoNumber!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one number");
    });

    it("should reject password without special character", () => {
      const result = security.validatePassword("NoSpecial123");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one special character");
    });

    it("should return all validation errors", () => {
      const result = security.validatePassword("weak");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("Data Hashing", () => {
    it("should hash data consistently", () => {
      const data = "sensitive-data";
      const hash1 = security.hashData(data);
      const hash2 = security.hashData(data);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(data);
    });

    it("should produce different hashes for different data", () => {
      const hash1 = security.hashData("data-1");
      const hash2 = security.hashData("data-2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Secure Token Generation", () => {
    it("should generate token of specified length", () => {
      const token = security.generateSecureToken(16);
      expect(token.length).toBe(32); // hex encoding doubles length
    });

    it("should generate different tokens each time", () => {
      const token1 = security.generateSecureToken();
      const token2 = security.generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe("Client IP Extraction", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = new NextRequest("http://example.com", {
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
      });

      const ip = security.getClientIP(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = new NextRequest("http://example.com", {
        headers: { "x-real-ip": "192.168.1.2" },
      });

      const ip = security.getClientIP(request);
      expect(ip).toBe("192.168.1.2");
    });

    it("should return unknown when no IP headers present", () => {
      const request = new NextRequest("http://example.com");

      const ip = security.getClientIP(request);
      expect(ip).toBe("unknown");
    });
  });

  describe("User Agent Extraction", () => {
    it("should extract user agent from header", () => {
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      const request = new NextRequest("http://example.com", {
        headers: { "user-agent": userAgent },
      });

      const extracted = security.getUserAgent(request);
      expect(extracted).toBe(userAgent);
    });

    it("should return unknown when no user agent header", () => {
      const request = new NextRequest("http://example.com");

      const extracted = security.getUserAgent(request);
      expect(extracted).toBe("unknown");
    });
  });
});

describe("Rate Limit Middleware", () => {
  it("should return null when rate limit not exceeded", async () => {
    const request = new NextRequest("http://example.com");
    const config = { windowMs: 60000, maxRequests: 10 };

    const result = await rateLimitMiddleware(request, config);
    expect(result).toBeNull();
  });

  it("should return 429 response when rate limit exceeded", async () => {
    const request = new NextRequest("http://example.com");
    const config = { windowMs: 60000, maxRequests: 1 };

    // First request should pass
    await rateLimitMiddleware(request, config);

    // Second request should be rate limited
    const result = await rateLimitMiddleware(request, config);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it("should include rate limit headers in response", async () => {
    const request = new NextRequest("http://example.com");
    const config = { windowMs: 60000, maxRequests: 5 };

    // Use up limit
    for (let i = 0; i < 5; i++) {
      await rateLimitMiddleware(request, config);
    }

    const result = await rateLimitMiddleware(request, config);
    expect(result?.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(result?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result?.headers.get("Retry-After")).toBe("60");
  });
});

describe("CSRF Middleware", () => {
  it("should skip CSRF check for GET requests", () => {
    const request = new NextRequest("http://example.com", {
      method: "GET",
    });

    const result = csrfMiddleware(request, "user-123");
    expect(result).toBeNull();
  });

  it("should return 403 when CSRF token missing", () => {
    const request = new NextRequest("http://example.com", {
      method: "POST",
    });

    const result = csrfMiddleware(request, "user-123");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("should return 403 when CSRF token invalid", () => {
    const request = new NextRequest("http://example.com", {
      method: "POST",
      headers: { "x-csrf-token": "invalid-token" },
    });

    const result = csrfMiddleware(request, "user-123");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("should return null when CSRF token valid", () => {
    const userId = "user-456";
    const token = security.generateCSRFToken(userId);

    const request = new NextRequest("http://example.com", {
      method: "POST",
      headers: { "x-csrf-token": token },
    });

    const result = csrfMiddleware(request, userId);
    expect(result).toBeNull();
  });
});

describe("Input Validation Middleware", () => {
  it("should return null for non-JSON requests", () => {
    const request = new NextRequest("http://example.com", {
      headers: { "content-type": "text/plain" },
    });

    const result = validateInputMiddleware(request);
    expect(result).toBeNull();
  });

  it("should return null for JSON requests", () => {
    const request = new NextRequest("http://example.com", {
      headers: { "content-type": "application/json" },
    });

    const result = validateInputMiddleware(request);
    expect(result).toBeNull();
  });
});
