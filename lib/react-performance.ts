/**
 * React Performance Utilities
 * Provides memoization and optimization helpers
 */

import { memo, useMemo, useCallback, ComponentType } from "react";

/**
 * Create a memoized component with comparison function
 */
export function createMemoizedComponent<P extends object>(
  Component: ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean
): ComponentType<P> {
  return memo(Component, areEqual) as unknown as ComponentType<P>;
}

/**
 * Memoize expensive calculations
 */
export function useExpensiveCalculation<T>(factory: () => T, deps: React.DependencyList): T {
  return useMemo(factory, deps);
}

/**
 * Memoize callback functions
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps) as T;
}

/**
 * Memoize object to prevent unnecessary re-renders
 */
export function useStableObject<T extends object>(obj: T): T {
  return useMemo(() => obj, Object.values(obj));
}

/**
 * Memoize array to prevent unnecessary re-renders
 */
export function useStableArray<T>(arr: T[]): T[] {
  return useMemo(() => arr, arr);
}

/**
 * Check if props are equal (shallow comparison)
 */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (a[key as keyof T] !== b[key as keyof T]) {
      return false;
    }
  }

  return true;
}

/**
 * Deep comparison for objects
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}

/**
 * Memoize component with custom comparison
 */
export function createDeepMemoizedComponent<P extends object>(
  Component: ComponentType<P>
): ComponentType<P> {
  return memo(Component, deepEqual) as unknown as ComponentType<P>;
}

/**
 * Memoize component with shallow comparison
 */
export function createShallowMemoizedComponent<P extends object>(
  Component: ComponentType<P>
): ComponentType<P> {
  return memo(Component, shallowEqual) as unknown as ComponentType<P>;
}
