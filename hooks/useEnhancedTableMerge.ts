import { useState, useCallback } from "react";
import { getTableState, getMergeScenario } from "@/lib/table-states";

interface Table {
  id: string;
  label: string;
  seat_count: number;
  status: string;
  session_id?: string | null;
  order_id?: string | null;
  total_amount?: number | null;
  order_status?: string | null;
  opened_at?: string | null;
  customer_name?: string | null;
  reserved_now_id?: string | null;
  reserved_now_start?: string | null;
  reserved_now_name?: string | null;
  reserved_later_id?: string | null;
  reserved_later_start?: string | null;
  reserved_later_name?: string | null;
}

interface MergeResult {
  success: boolean;
  data?: unknown;
  error?: string;
  scenario?: string;
  description?: string;
}

export function useEnhancedTableMerge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performMerge = useCallback(
    async (
      sourceTableId: string,
      targetTableId: string,
      venueId: string,
      confirmed: boolean = false
    ): Promise<MergeResult> => {
      try {
        setIsLoading(true);
        setError(null);

        const { apiClient } = await import("@/lib/api-client");
        const response = await apiClient.post("/api/table-sessions/enhanced-merge", {
          source_table_id: sourceTableId,
          target_table_id: targetTableId,
          venue_id: venueId,
          confirmed,
        });

        const result = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: result.error || "Merge failed",
            scenario: result.scenario,
            description: result.description,
          };
        }

        return {
          success: true,
          data: result.data,
          scenario: result.scenario,
          description: result.description,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unexpected error occurred";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const validateMerge = useCallback((sourceTable: Table, targetTable: Table) => {
    const sourceState = getTableState(sourceTable);
    const targetState = getTableState(targetTable);
    const mergeScenario = getMergeScenario(sourceTable, targetTable);

    return {
      allowed: mergeScenario.allowed,
      requiresConfirmation: mergeScenario.requiresConfirmation,
      warning: mergeScenario.warning,
      description: mergeScenario.description,
      scenario: mergeScenario.type,
      sourceState: sourceState.state,
      targetState: targetState.state,
    };
  }, []);

  const getTableStateInfo = useCallback((table: Table) => {
    return getTableState(table);
  }, []);

  return {
    performMerge,
    validateMerge,
    getTableStateInfo,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
