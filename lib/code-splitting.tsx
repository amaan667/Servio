import { errorToContext } from "@/lib/utils/error-to-context";

/**
 * Code Splitting Utilities
 * Provides lazy loading and code splitting helpers
 */

import { lazy, ComponentType, Suspense } from "react";
import { logger } from "@/lib/logger";

/**
 * Create a lazy-loaded component with loading state
 */
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
) {
  return lazy(importFn);
}

/**
 * Preload a lazy component
 */
export function preloadComponent(
  importFn: () => Promise<{ default: ComponentType<unknown> }>
): void {
  importFn();
}

/**
 * Create a lazy route component
 */
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
  </div>
);

export function createLazyRoute<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
) {
  return createLazyComponent(importFn);
}

/**
 * Lazy load with retry
 */
export function lazyWithRetry<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  retries = 3
): ComponentType<P> {
  return lazy(async () => {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (_error) {
        lastError = _error as Error;
        logger.error(
          `Failed to load component (attempt ${i + 1}/${retries}):`,
          errorToContext(_error)
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw lastError;
  }) as unknown as ComponentType<P>;
}
