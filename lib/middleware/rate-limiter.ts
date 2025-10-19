/**
 * Rate Limiting Middleware
 * Protects API routes from abuse and ensures fair usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Simple in-memory rate limiter (use Redis in production for distributed systems)
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later',
};

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: NextRequest): string {
  // Try to get IP from various headers (for proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // Add user ID if authenticated
  const userId = req.headers.get('x-user-id');
  
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest) => {
      const clientId = getClientId(req);
      const now = Date.now();
      
      // Get or create rate limit entry
      let entry = store[clientId];
      
      if (!entry || entry.resetTime < now) {
        // Create new entry or reset expired one
        entry = {
          count: 0,
          resetTime: now + config.windowMs,
        };
        store[clientId] = entry;
      }
      
      // Increment count
      entry.count++;
      
      // Check if limit exceeded
      if (entry.count > config.maxRequests) {
        logger.warn('Rate limit exceeded', {
          clientId,
          count: entry.count,
          maxRequests: config.maxRequests,
          path: req.url,
        });
        
        return NextResponse.json(
          {
            error: config.message || 'Too many requests',
            retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': Math.max(0, config.maxRequests - entry.count).toString(),
              'X-RateLimit-Reset': entry.resetTime.toString(),
            },
          }
        );
      }
      
      // Execute handler
      const response = await handler(req);
      
      // Add rate limit headers to response
      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count).toString());
      response.headers.set('X-RateLimit-Reset', entry.resetTime.toString());
      
      return response;
    };
  };
}

/**
 * Strict rate limit for sensitive operations (login, signup, etc.)
 */
export const STRICT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later',
};

/**
 * Standard rate limit for most API routes
 */
export const STANDARD_RATE_LIMIT: RateLimitConfig = {
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  message: 'Too many requests, please slow down',
};

/**
 * High rate limit for public endpoints
 */
export const HIGH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 300, // 300 requests per minute
  message: 'Rate limit exceeded',
};

