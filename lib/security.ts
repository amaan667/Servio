/**
 * Security Service
 * Provides rate limiting, CSRF protection, input validation, and audit logging
 */

import { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'crypto';

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
  metadata?: Record<string, any>;
  timestamp: string;
}

class SecurityService {
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  private csrfTokens = new Map<string, { token: string; expires: number }>();

  /**
   * Rate limiting implementation
   */
  async checkRateLimit(identifier: string, config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }): Promise<boolean> {
    const now = Date.now();
    const key = `rate_limit:${identifier}`;
    const stored = this.rateLimitStore.get(key);

    if (!stored || now > stored.resetTime) {
      // Reset or create new entry
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs
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
    const token = randomBytes(32).toString('hex');
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
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
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
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Audit logging
   */
  async logAudit(entry: Omit<AuditLogEntry, 'timestamp'>) {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    console.log('[AUDIT]', auditEntry);

    // TODO: Store in database
    // await supabase.from('audit_logs').insert(auditEntry);
  }

  /**
   * Get client IP address
   */
  getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return request.ip || 'unknown';
  }

  /**
   * Get user agent
   */
  getUserAgent(request: NextRequest): string {
    return request.headers.get('user-agent') || 'unknown';
  }

  /**
   * Hash sensitive data
   */
  hashData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate secure random string
   */
  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }
}

export const security = new SecurityService();

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(request: NextRequest, config?: RateLimitConfig) {
  const ip = security.getClientIP(request);
  const isAllowed = await security.checkRateLimit(ip, config);
  
  if (!isAllowed) {
    return new Response('Too Many Requests', { 
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': config?.maxRequests.toString() || '100',
        'X-RateLimit-Remaining': '0'
      }
    });
  }
  
  return null;
}

/**
 * CSRF protection middleware
 */
export function csrfMiddleware(request: NextRequest, userId: string) {
  if (request.method === 'GET') {
    return null; // Skip CSRF for GET requests
  }

  const token = request.headers.get('x-csrf-token');
  if (!token) {
    return new Response('CSRF token required', { status: 403 });
  }

  if (!security.validateCSRFToken(userId, token)) {
    return new Response('Invalid CSRF token', { status: 403 });
  }

  return null;
}

/**
 * Input validation middleware
 */
export function validateInputMiddleware(request: NextRequest) {
  const contentType = request.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    // TODO: Implement JSON body validation
    // This would parse the body and validate against schemas
  }
  
  return null;
}
