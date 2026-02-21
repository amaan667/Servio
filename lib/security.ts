/**
 * Security Service
 * Provides rate limiting, CSRF protection, input validation, and audit logging
 */

import { NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface AuditLogEntry {
  action: string;
  userId?: string;
  venueId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

class SecurityService {
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  private csrfTokens = new Map<string, { token: string; expires: number }>();

  /**
   * Rate limiting implementation
   */
  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }
  ): Promise<boolean> {
    const now = Date.now();
    const key = `rate_limit:${identifier}`;
    const stored = this.rateLimitStore.get(key);

    if (!stored || now > stored.resetTime) {
      // Reset or create new entry
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }

    if (stored.count >= config.maxRequests) {
      return false;
    }

    stored.count++;
    this.rateLimitStore.set(key, stored);
    return true;
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(userId: string): string {
    const token = randomBytes(32).toString("hex");
    const expires = Date.now() + 3600000; // 1 hour

    this.csrfTokens.set(userId, { token, expires });
    return token;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(userId: string, token: string): boolean {
    const stored = this.csrfTokens.get(userId);

    if (!stored || Date.now() > stored.expires) {
      this.csrfTokens.delete(userId);
      return false;
    }

    return stored.token === token;
  }

  /**
   * Input sanitization
   */
  sanitizeInput(
    input: unknown
  ): string | number | boolean | null | Record<string, unknown> | unknown[] {
    if (typeof input === "string") {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
        .replace(/javascript:/gi, "") // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, "") // Remove event handlers
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitizeInput(item));
    }

    if (typeof input === "object" && input !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input as string | number | boolean | Record<string, unknown> | unknown[] | null;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Audit logging
   */
  async logAudit(entry: Omit<AuditLogEntry, "timestamp">) {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // Future: Store audit logs in database for compliance tracking
    // await supabase.from('audit_logs').insert(auditEntry);
  }

  /**
   * Get client IP address
   */
  getClientIP(_request: NextRequest): string {
    const forwarded = _request.headers.get("x-forwarded-for");
    const realIP = _request.headers.get("x-real-ip");

    if (forwarded) {
      const first = forwarded.split(",")[0];
      return (first ?? forwarded).trim();
    }

    if (realIP) {
      return realIP;
    }

    return _request.ip || "unknown";
  }

  /**
   * Get user agent
   */
  getUserAgent(_request: NextRequest): string {
    return _request.headers.get("user-agent") || "unknown";
  }

  /**
   * Hash sensitive data
   */
  hashData(data: string): string {
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Generate secure random string
   */
  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString("hex");
  }
}

export const security = new SecurityService();

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(_request: NextRequest, config?: RateLimitConfig) {
  const ip = security.getClientIP(_request);
  const isAllowed = await security.checkRateLimit(ip, config);

  if (!isAllowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "60",
        "X-RateLimit-Limit": config?.maxRequests.toString() || "100",
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  return null;
}

/**
 * CSRF protection middleware
 */
export function csrfMiddleware(_request: NextRequest, userId: string) {
  if (_request.method === "GET") {
    return null; // Skip CSRF for GET requests
  }

  const token = _request.headers.get("x-csrf-token");
  if (!token) {
    return new Response("CSRF token required", { status: 403 });
  }

  if (!security.validateCSRFToken(userId, token)) {
    return new Response("Invalid CSRF token", { status: 403 });
  }

  return null;
}

/**
 * Input validation middleware
 */
export function validateInputMiddleware(_request: NextRequest) {
  const contentType = _request.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    // Future: Implement JSON body validation with Zod schemas
  }

  return null;
}
