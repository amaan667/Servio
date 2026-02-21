/**
 * useBulkMenuOperations Hook
 *
 * React hook for bulk menu item operations with progress tracking,
 * loading states, and error handling.
 */

import { useState, useCallback } from "react";
import { BulkOperationResult } from "@/lib/bulk-operations/types";

export interface UseBulkMenuOperationsOptions {
  venueId: string;
  onSuccess?: (result: BulkOperationResult) => void;
  onError?: (error: Error) => void;
}

export interface UseBulkMenuOperationsReturn {
  isLoading: boolean;
  progress: { completed: number; total: number; percent: number } | null;
  operationId: string | null;
  result: BulkOperationResult | null;
  error: Error | null;
  cancel: () => void;
  createItems: (
    items: Array<{
      name_en?: string;
      name_ar?: string;
      description_en?: string;
      description_ar?: string;
      price?: number;
      category?: string;
      is_available?: boolean;
    }>,
    options?: { dryRun?: boolean }
  ) => Promise<BulkOperationResult | null>;
  updateItems: (
    updates: Array<{
      id: string;
      data: Record<string, unknown>;
    }>,
    options?: { dryRun?: boolean; skipMissing?: boolean }
  ) => Promise<BulkOperationResult | null>;
  deleteItems: (
    ids: string[],
    options?: { dryRun?: boolean; skipMissing?: boolean }
  ) => Promise<BulkOperationResult | null>;
  reset: () => void;
}

export function useBulkMenuOperations(
  options: UseBulkMenuOperationsOptions
): UseBulkMenuOperationsReturn {
  const { venueId, onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    percent: number;
  } | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [result, setResult] = useState<BulkOperationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const cancel = useCallback(() => {
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setOperationId(null);
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const createItems = useCallback(
    async (
      items: Array<{
        name_en?: string;
        name_ar?: string;
        description_en?: string;
        description_ar?: string;
        price?: number;
        category?: string;
        is_available?: boolean;
      }>,
      opts?: { dryRun?: boolean }
    ): Promise<BulkOperationResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/bulk/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueId, items, dryRun: opts?.dryRun }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Bulk create failed");
        }

        const data = await response.json();
        setOperationId(data.operationId);
        setResult(data);
        onSuccess?.(data);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [venueId, onSuccess, onError]
  );

  const updateItems = useCallback(
    async (
      updates: Array<{ id: string; data: Record<string, unknown> }>,
      opts?: { dryRun?: boolean; skipMissing?: boolean }
    ): Promise<BulkOperationResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/bulk/menu-items", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            updates,
            dryRun: opts?.dryRun,
            skipMissing: opts?.skipMissing,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Bulk update failed");
        }

        const data = await response.json();
        setOperationId(data.operationId);
        setResult(data);
        onSuccess?.(data);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [venueId, onSuccess, onError]
  );

  const deleteItems = useCallback(
    async (
      ids: string[],
      opts?: { dryRun?: boolean; skipMissing?: boolean }
    ): Promise<BulkOperationResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/bulk/menu-items", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            ids,
            dryRun: opts?.dryRun,
            skipMissing: opts?.skipMissing,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Bulk delete failed");
        }

        const data = await response.json();
        setOperationId(data.operationId);
        setResult(data);
        onSuccess?.(data);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [venueId, onSuccess, onError]
  );

  return {
    isLoading,
    progress,
    operationId,
    result,
    error,
    cancel,
    createItems,
    updateItems,
    deleteItems,
    reset,
  };
}
