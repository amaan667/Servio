 
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit';
import { NextRequest } from 'next/server';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limit store between tests
    const store = (checkRateLimit as unknown as { rateLimitStore?: Map<string, unknown> }).rateLimitStore;
    store?.clear();
  });

  it('should allow requests within rate limit', () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    const result = checkRateLimit(request, RATE_LIMITS.public);
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThan(RATE_LIMITS.public.uniqueTokenPerInterval);
  });

  it('should block requests exceeding rate limit', () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    
    // Exhaust rate limit
    for (let i = 0; i < RATE_LIMITS.public.uniqueTokenPerInterval; i++) {
      checkRateLimit(request, RATE_LIMITS.public);
    }
    
    // Next request should be blocked
    const result = checkRateLimit(request, RATE_LIMITS.public);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should have stricter limits for AI endpoints', () => {
    expect(RATE_LIMITS.ai.uniqueTokenPerInterval).toBeLessThan(RATE_LIMITS.authenticated.uniqueTokenPerInterval);
  });
});

