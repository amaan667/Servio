/**
 * @fileoverview Request Deduplication
 * Prevents duplicate in-flight requests
 */

import { logger } from '@/lib/monitoring/structured-logger';

interface PendingRequest {
  promise: Promise<unknown>;
  timestamp: number;
}

/**
 * Request Deduplicator
 * Prevents duplicate in-flight requests by caching promises
 */
export class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private ttl: number; // Time to live for pending requests in milliseconds

  constructor(ttl: number = 5000) {
    this.ttl = ttl;
  }

  /**
   * Execute a request with deduplication
   */
  async execute<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if there's already a pending request with the same key
    const existing = this.pendingRequests.get(key);

    if (existing) {
      // Check if the pending request is still valid
      const age = Date.now() - existing.timestamp;
      if (age < this.ttl) {
        logger.debug('Deduplicating request', { key, age });
        return existing.promise as Promise<T>;
      } else {
        // Remove expired pending request
        this.pendingRequests.delete(key);
      }
    }

    // Create new request
    const promise = requestFn();

    // Store the promise
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    // Clean up after the request completes
    promise.finally(() => {
      // Remove from pending requests after a short delay
      // to allow for rapid successive requests
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, 100);
    });

    return promise;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Clear expired pending requests
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      const age = now - request.timestamp;
      if (age > this.ttl) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Check if a request is pending
   */
  isPending(key: string): boolean {
    const existing = this.pendingRequests.get(key);
    if (!existing) {
      return false;
    }

    const age = Date.now() - existing.timestamp;
    return age < this.ttl;
  }
}

// Singleton instance
let deduplicatorInstance: RequestDeduplicator | null = null;

/**
 * Get request deduplicator singleton
 */
export function getRequestDeduplicator(): RequestDeduplicator {
  if (!deduplicatorInstance) {
    deduplicatorInstance = new RequestDeduplicator();
  }
  return deduplicatorInstance;
}

/**
 * Execute a deduplicated request
 */
export async function deduplicatedRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const deduplicator = getRequestDeduplicator();
  return deduplicator.execute(key, requestFn);
}

/**
 * Create a deduplicated fetch wrapper
 */
export function createDeduplicatedFetch(
  baseFetch: typeof fetch = fetch
): typeof fetch {
  const deduplicator = new RequestDeduplicator();

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    // Create a cache key from the request
    const cacheKey = createCacheKey(input, init);

    return deduplicator.execute(cacheKey, () => baseFetch(input, init)) as Promise<Response>;
  };
}

/**
 * Create cache key from request
 */
function createCacheKey(input: RequestInfo | URL, init?: RequestInit): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || 'GET';
  const body = init?.body ? JSON.stringify(init.body) : '';

  // Only deduplicate GET requests by default
  if (method !== 'GET') {
    return `${method}:${url}:${Date.now()}`;
  }

  return `${method}:${url}:${body}`;
}

/**
 * React hook for request deduplication
 */
export function useRequestDeduplication() {
  const deduplicator = getRequestDeduplicator();

  const execute = React.useCallback(
    async <T>(key: string, requestFn: () => Promise<T>): Promise<T> => {
      return deduplicator.execute(key, requestFn);
    },
    [deduplicator]
  );

  const isPending = React.useCallback(
    (key: string): boolean => {
      return deduplicator.isPending(key);
    },
    [deduplicator]
  );

  const clear = React.useCallback(() => {
    deduplicator.clear();
  }, [deduplicator]);

  return { execute, isPending, clear };
}

// Import React dynamically to avoid issues
import React from 'react';
