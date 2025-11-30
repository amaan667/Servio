/**
 * Optimistic UI Utilities
 * 
 * Best Practices:
 * - Use for mutations that are likely to succeed
 * - Provide rollback on error
 * - Show immediate feedback to users
 * 
 * Performance: Reduces perceived latency by updating UI immediately
 */

import { useCallback } from "react";

export interface OptimisticUpdate<T> {
  previousData: T;
  optimisticData: T;
  rollback: () => void;
}

/**
 * Create optimistic update handler
 * 
 * @example
 * const handleUpdate = useOptimisticUpdate(
 *   currentData,
 *   setData,
 *   async (optimisticData) => {
 *     const result = await updateItem(optimisticData);
 *     return result;
 *   }
 * );
 */
export function useOptimisticUpdate<T>(
  currentData: T,
  setData: (data: T) => void,
  mutationFn: (data: T) => Promise<T>
) {
  return useCallback(
    async (optimisticData: T): Promise<T> => {
      // Store previous data for rollback
      const previousData = currentData;

      // Optimistically update UI
      setData(optimisticData);

      try {
        // Perform actual mutation
        const result = await mutationFn(optimisticData);
        setData(result);
        return result;
      } catch (error) {
        // Rollback on error
        setData(previousData);
        throw error;
      }
    },
    [currentData, setData, mutationFn]
  );
}

/**
 * Optimistic update with error handling
 */
export async function withOptimisticUpdate<T>(
  currentData: T,
  setData: (data: T) => void,
  optimisticData: T,
  mutationFn: (data: T) => Promise<T>
): Promise<T> {
  const previousData = currentData;

  // Optimistically update UI
  setData(optimisticData);

  try {
    // Perform actual mutation
    const result = await mutationFn(optimisticData);
    setData(result);
    return result;
  } catch (error) {
    // Rollback on error
    setData(previousData);
    throw error;
  }
}

