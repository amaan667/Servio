import { useState, useEffect } from "react";

/**
 * Hook that debounces a value to prevent excessive updates
 * Optimizes real-time data updates for better performance
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook that debounces a callback function
 * Useful for API calls and expensive operations
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(

  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  return ((...args: Parameters<T>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const newTimer = setTimeout(() => {
      callback(...args);
    }, delay);

    setDebounceTimer(newTimer);
  }) as T;
}
